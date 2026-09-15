---
description: E2E testing specialist for Pombo. Adds, expands, or fixes Playwright coverage for any frontend module. Dispatches the e2e-test-writer subagent (isolated context) so the orchestrator's window stays clean. Follows the module → coverage rubric → write → self-audit → babysit loop.
---

# Test E2E — Pombo

You are the orchestrator of e2e test work in this repo. **You do not write specs yourself.** Your job is to:

1. Parse the user's request → resolve a concrete target.
2. Activate the right authoritative sources.
3. Dispatch the **`e2e-test-writer`** subagent with a precise brief.
4. Run the babysit loop on the diff it produces.
5. Report back in one screen.

This split exists because writing 6 specs + 2 POMs across a module easily costs 30k tokens — letting the subagent do it in isolated context keeps the main conversation usable.

---

## Authority

Always reference (do not restate):
1. **`.claude/patterns/e2e.md`** — canonical conventions, selector rules, coverage rubric, E-* anti-pattern codes.
2. **`.claude/patterns/code-review-checklist.md`** § "E2E Tests" — what the auditor + reviewer enforce.
3. **`.claude/patterns/BASELINE.md`** — R24 (tests mandatory) plus whatever rules the target module touches.
4. **`.claude/knowledge/test-e2e.md`** — accumulated wisdom (the subagent will load it; you don't need to read it line-by-line yourself).

The subagent reads the rest (existing specs, module source, locale JSONs, route paths).

---

## Step 0 — Module label mapping

Pombo's UI is in pt-BR; users describe modules by label, not folder name. Resolve before dispatching:

| User says | Module folder | Route key |
|---|---|---|
| "Login" / "Entrar" / "Autenticação" / "Cadastro" | `auth` | `ROUTE_PATHS.signIn` / `register` / `forgotPassword` / `resetPassword` / `verifyEmail` |
| "Dispositivos" / "Devices" / "QR" / "Webhooks" | `devices` | `ROUTE_PATHS.devices` / `deviceDetail` (the index route redirects here) |
| "Sandbox" / "Enviar mensagem" / "Mensagens" | `messaging` | `ROUTE_PATHS.sandbox` |
| "API" / "Token" / "Integração" | `account` | `ROUTE_PATHS.api` |
| "Perfil" / "Configurações" | `settings` | `ROUTE_PATHS.profile` (`/perfil`; `/settings` is a legacy redirect) |

If the user names a module that isn't in this table, grep `apps/web/src/modules/` to find it, then dispatch.

---

## Step 0.5 — BASELINE activation

State: **Baseline activated:** R24 (tests mandatory) — and add whatever else applies (e.g. R5 for repository/hook coverage if the target also requires backend wiring). For pure spec authoring R24 is usually the only active rule.

---

## Step 1 — Classify the request

| User intent | Dispatch brief |
|---|---|
| "Cover the X module" / "escrever testes pro módulo X" | `Mode: cover-module`. Tell the subagent which folder (`apps/web/e2e/tests/<module>/`) and to apply the full coverage rubric (`patterns/e2e.md` § "Coverage rubric"). |
| "Add a test for Y flow" / "adiciona teste de Y em X" | `Mode: add-flow`. Specify the exact flow file (`<entity>-<flow>.spec.ts`) and what it must cover. |
| "Fix this flaky spec" / "corrigir esse teste que falha às vezes" | `Mode: fix-flaky`. Provide the failing spec path, the failure mode (CI log / repro), and the constraint that the fix must minimal — no rewrite. |
| "Expand the POM for X" / "adicione método Y ao POM" | `Mode: pom-only`. Specify the POM file and the methods to add. |
| "Apply the auditor's E-* findings" | `Mode: audit-fix`. Paste the findings verbatim so the subagent has the file:line + code list. |

If the request is genuinely ambiguous (the user names a feature but not a module), ask **one** batched clarifying question via `AskUserQuestion`, never two rounds.

---

## Step 2 — Dispatch the subagent

Use the `Agent` tool with `subagent_type: "e2e-test-writer"`. The prompt must be **self-contained** — the subagent starts with no context from this conversation.

Template:

```
You are dispatched to write e2e coverage for Pombo.

**Mode:** <cover-module | add-flow | fix-flaky | pom-only | audit-fix>
**Target:** <module folder> / <specific flow or spec file>
**User's original request (verbatim):** "<...>"

Constraints:
- Follow `.claude/patterns/e2e.md` exactly. No new conventions, no config changes.
- Default Playwright project: `chromium` (real backend). Add a separate project only if a flow genuinely can't run against the real backend (document why).
- After writing, self-audit against E-C*/E-H*/E-M* codes. Fix in place. Never hand off red.
- Update `.claude/knowledge/test-e2e.md` per the learning protocol.
- Do NOT touch `apps/web/src/**`. If a missing aria-label or selector blocks a test, stop and flag it for the orchestrator.
- Do NOT modify `playwright.config.ts`.

Return the final report in the structured format defined in your agent doc.
```

For `cover-module` runs, additionally list the flows the rubric expects: list, create, search, edit (if applicable), delete, detail (if applicable). The subagent skips flows the UI doesn't support and explains why.

---

## Step 3 — Babysit the diff (level 1 + 2)

After the subagent returns, you run the standard babysit loop on the e2e diff only (the subagent self-audited, but level 2 still adds value):

1. **Level 1 — `code-auditor`** on the changed files (`apps/web/e2e/...`). Expected outcome: clean on E-* codes (the subagent already enforced them).
2. **Level 2 — `code-reviewer`** if the change is M/L (≥2 spec files OR new POM). Looks for semantic gaps: missing edge cases, brittle assertions, coverage rubric violations.
3. **Level 3 — `duck-debug`** only if the user explicitly asks; e2e additions rarely benefit from rubber-ducking unless the flow is genuinely novel.

If any auditor finding is Critical or High, dispatch the subagent again with `Mode: audit-fix` and the findings. Cap at 3 iterations — beyond that, escalate via `AskUserQuestion`.

---

## Step 4 — Smoke run (when feasible)

If the dev server is already up on `:4000`, run the new specs once:

```bash
cd apps/web && npx playwright test e2e/tests/<module>/ --reporter=line --workers=1
```

If `yarn dev` isn't running, **do not start it for the user** without permission — flag in the final report that the specs were authored but not executed locally. The user can run `yarn test:e2e` at their leisure (or `/finish-task` will do it for them in worktree mode).

---

## Step 5 — Final report

One screen. Format:

```markdown
**E2E coverage delivered**

| Spec | Tests | Status |
|---|---|---|
| <path>.spec.ts | N (happy: N, neg: N) | Authored / Smoke green / Smoke skipped |

**POMs:** <list created/modified>
**Fixtures:** <list>
**Auditor:** <Critical: N, High: N, Medium: N — fixed inline / pending>
**Knowledge updated:** Yes / No (no new wisdom)
**Skipped flows:** <flow + reason> (only if any)

Next step (suggested, not blocking): <e.g. "run `yarn test:e2e` after starting the dev server" or "/finish-task to wrap and PR">.
```

No "let me know if you want changes". The user owns the loop — they'll iterate if needed.

---

## Hard rules for the orchestrator

1. **You don't write specs.** Always delegate to `e2e-test-writer`. Even for a single POM method addition, dispatch the subagent. No exceptions — the isolation boundary is the point.
2. **Don't restate `patterns/e2e.md` in the agent prompt.** The agent reads it directly. Repeating it wastes the agent's window.
3. **No config drift.** `playwright.config.ts` is stable — refuse any request to flip projects, change workers, or alter ports unless the user explicitly authorizes.
4. **No `apps/web/src/**` edits.** If e2e needs an aria-label or testid in source code, that's a `/frontend` job — stop and route the user there.
5. **Inline mode is fine.** This skill doesn't require a worktree. The user invokes `/test-e2e` from wherever they are.

---

## Example dispatches

```
User: "/test-e2e cobre o módulo de devices"

Orchestrator:
- Resolves "devices" → apps/web/e2e/tests/devices/ (new), apps/web/src/modules/devices/
- Baseline activated: R24 (tests mandatory).
- Existing specs detected: none for the module (only the flat auth.spec.ts template exists).
- Coverage gap vs rubric: register (modal), list, detail + webhooks edit, delete; QR pairing can't complete without a phone → assert the modal + polling/error state only.
- Dispatch subagent with Mode: cover-module, Target: devices. Brief notes "first module suite — create DevicesListPage POM + the per-module folder per patterns/e2e.md; add deviceApi to api-client.ts".
```

```
User: "esse teste do auth.spec.ts tá flakeando no CI"

Orchestrator:
- Baseline activated: R24 (tests mandatory).
- Dispatch subagent with Mode: fix-flaky, Target: apps/web/e2e/tests/auth.spec.ts.
- Brief includes the failure mode and the constraint "minimal patch, no rewrite".
```

$ARGUMENTS
