# BASELINE — Non-negotiables (Authority)

**One-page summary of the rules that every implementation task must respect.** This file is the fast-load compass: read it at task start, cite which rules apply to your scope, and self-audit against it before declaring done.

For full architectural context, defer to:
- `.claude/patterns/spec.md` (Spec-Driven Development — the Task Spec contract every non-trivial task starts with)
- `.claude/patterns/backend.md` (canonical backend lifecycle)
- `.claude/patterns/frontend.md` (canonical frontend lifecycle)
- `.claude/patterns/code-review-checklist.md` (full anti-pattern catalog with B-C/F-H/X-C/SC codes)

---

## How to use this doc

Every specialist (`/backend`, `/frontend`, `/fullstack`, `/ai-backend`) MUST do this at the start of every task:

1. Read this file fully (it is intentionally short).
2. Output a one-line **Baseline activation** statement listing the rule IDs that apply to the current task.
   > **Baseline activated:** R1 (multi-tenancy), R6 (response envelope), R10 (semantic tokens). Out of scope: R12, R14.
3. Re-check the activated rules during the in-loop self-audit (see § BABYSIT loop below).
4. If a rule is genuinely impossible to apply, document the exception in the PR body — never silently violate it.

If you cannot tie at least 3 baseline rules to your task, you almost certainly missed scope. Re-read the task.

---

## DRY-first protocol (read BEFORE writing any new file)

Before creating ANYTHING new, walk this 5-question gate:

1. **Does a shared component / hook / utility already cover this?**
   - Backend: `.claude/patterns/backend.md` § Reuse-First Catalog (entities, repos, providers, helpers).
   - Frontend: `.claude/patterns/frontend.md` § Reuse-First Catalog (`PageHeader`, `EntityCard`, `SectionCard`, `EmptyState`, `AppModal`, `useDetailPageController`, `FormField`, ...) **and** the Chakra v3 snippets in `src/components/ui/*`.
2. **Can the existing thing be extended (one extra prop, one extra method) instead of cloned?** Extension wins.
3. **If extension is impossible, is the new thing reusable?** Place it in `shared/` (FE) or `modules/<domain>/application/service/` (domain-scoped) / `shared/util/` (generic, no domain) (BE) — never inside a feature module if any other module could need it.
4. **Did you grep for the same string / behavior in the codebase?** If 2+ files implement the same logic, consolidate before adding the third.
5. **Are you mirroring an existing pattern in style?** Naming, file layout, error-handling shape, response shape — copy the canonical reference module (`devices` — `apps/api/src/modules/devices` on the backend, `apps/web/src/modules/devices` on the frontend) before improvising.

A new file that fails questions 1–3 is a code smell. Stop and reconsider.

---

## Baseline rules (cite by ID)

### Backend (`apps/api/src/**`)

| ID | Rule | Anchor |
|----|------|--------|
| R1 | Every Prisma query (read AND write) on a multi-tenant table filters by `account_id`, taken from `req.auth.accountId` (or `req.apiAuth.accountId` on the public API) — never from the body. | `B-C1` |
| R2 | Every read filters `deleted_at: null`. Soft delete is the default. | `B-C2` |
| R3 | Cross-tenant access is impossible by construction: request-driven repository methods take `accountId` and return `null` on a miss; the use case throws `NotFoundError` (never `ForbiddenError`). Never launder an `accountId` from a system-triggered (`*Internal`) read into a scoped query. | `B-C3`, `B-H11`, `B-H16` |
| R4 | Errors use `AppError` subclasses with `ErrorCode`. **Never** `throw new Error(...)`. | `B-C4` |
| R5 | Logging via `ILoggerProvider` (Pino). **Never** `console.*`. **Never** log PII (phone numbers, message text, contact/group names) or secrets (tokens, WhatsApp session keys, webhook secrets). | `B-C5`, `B-H12` |
| R6 | Success response: `{ ok: true, data }`. Error response: `{ ok: false, error: { message, code, details? } }`. Paginated: `{ data, meta: { page, limit, total, totalPages } }`. | `B-C8` |
| R7 | Use cases receive DTOs, return DTOs. They **never** touch `Request` / `Response`. | `B-C9` |
| R8 | Domain ← Application ← Infrastructure (one-way). No back-imports. | `B-C10` |
| R9 | Every Prisma `catch` calls `mapPrismaError(error)`. Every new repo / provider / service is registered in `core/container/index.ts` (module repo bindings via `register<Domain>Module`). | `B-H3`, `B-H5` |

### Frontend (`apps/web/src/**`)

| ID | Rule | Anchor |
|----|------|--------|
| R10 | Semantic tokens only (`bg.*`, `text.*`, `border.*`, `status.*`). **No hardcoded hex.** Chakra **v3**: `colorPalette` (not `colorScheme`); compound components come from the snippets in `src/components/ui/*`. | `F-C2` |
| R11 | **No yellow / orange / amber.** Purple for warnings, red for errors, accent (green) for success. | `F-C3` (hard project rule) |
| R12 | Components never call `httpClient` directly. Always: hook → repository → httpClient. | `F-C1`, `F-C7` |
| R13 | New repository → registered in `core/di/repositories.ts`. New query key → added to `core/query/queryKeys.ts` (factory: `all` / `list` / `search` / `detail` / `linked*`). | `F-H1`, `F-H2` |
| R14 | Every mutation has `onError`. `invalidateQueries` is selective — never `queryKeys.X.all` unless every sub-key is genuinely affected. | `F-C5`, `F-C6` |
| R15 | Routes via `ROUTE_PATHS` constants. UI strings via i18n in all 3 locales (pt-BR, en, es). | `F-C8`, `F-C9`, `F-H15` |
| R16 | Forms use `FormField` / `SelectField` / `TextAreaField` / `NumberField` / `PasswordField` (RHF + Zod for validated forms; `useFormState` for simple modals). Never raw `<Input>` in feature code — the one exception is an RHF `register()` input, which pairs `<Field>` + `<Input>` directly. | `F-H5`, `F-H6` |
| R17 | Loading = skeleton (never bare `<Spinner />` for primary content). Empty = `<EmptyState>` with CTA. | `F-H8`, `F-H9` |
| R18 | Use the right shared hook from the decision tree (`useDetailPageController`, `useFormState`, `useAutoSave`, `useConfirm`, `useNotify`, ...). Every `useQuery`/`useMutation` lives in a module hook, never inline in a page. | `F-H3`, `F-H4`, `F-H29` |
| R19 | List items / mapped components are `memo()`. Handlers passed to memoized children are `useCallback`. | `F-H10`, `F-H11` |

### Cross-cutting

| ID | Rule | Anchor |
|----|------|--------|
| R20 | Backend response field renames update the frontend entity in the same PR. New backend `ErrorCode` ships with translations in all 3 locales AND a frontend toast. | `X-C1`, `X-C2`, `X-H1`, `X-H5` |
| R21 | New env var → registered in `apps/api/src/core/config/env.ts` Zod schema. Migrations consider rollback for non-empty production tables. | `X-H4`, `X-C3` |
| R22 | **No secrets in commits.** API keys, tokens, DB URLs with creds → environment only. | `X-C4` |
| R23 | LLM calls always via an `ILlmProvider` port (never a vendor SDK/`fetch` in a use case). Embeddings via an embedding service. Retrieval filtered by `account_id` (+ the conversation's entity). Usage/cost logged via an AI-usage repository. (Pombo has no AI infra yet — the first AI task builds this foundation; see `/ai-backend`.) | `B-C13` |

### Tests (mandatory in this project)

| ID | Rule | Anchor |
|----|------|--------|
| R24 | Every new/modified `*.use-case.ts`, `*.entity.ts`, `*.dto.ts`, `*.controller.ts` ships with a co-located `*.spec.ts`. Enforced by `.claude/hooks/check-test-coverage.sh`. | `patterns/backend.md` § Tests |
| R25 | Mock at the **repository** boundary, not the Prisma client. Real DB for integration tests. | `B-H14` |

### Spec & scope — SDD (mandatory in this project)

| ID | Rule | Anchor |
|----|------|--------|
| R26 | **Spec-first.** Every non-trivial task starts with a Task Spec in `.claude/specs/<slug>.md` (template + lifecycle in `patterns/spec.md`) — written by `/triage`, `/architect`, or the specialist (Step 0.75) BEFORE any code. Trivial tasks state a one-sentence inline contract instead. | `SC-H4` |
| R27 | **Deliver the contract — nothing more.** Minimal diff, ruthless YAGNI: no speculative abstractions (interface with one impl, option nobody passes), no features beyond the ACs, no drive-by refactors outside the spec's files plan, no dead code, no new dependency the spec doesn't justify. Extension of an existing piece beats a new near-duplicate. | `SC-H2`, `SC-H3`, `SC-M1`–`SC-M3` |
| R28 | **Traceability.** Every acceptance criterion maps to code + test; every behavior change in the diff maps back to an AC or to the spec's Decisions log. Scope cuts are moved to "Out (deferred)" explicitly — never silently dropped. | `SC-C1`, `SC-H1` |

---

## BABYSIT loop (during development)

Specialists do not "implement, then hand off and hope". They self-audit in a **3-level** tight loop before handoff. Each level adds judgment depth — level 1 is fast and mechanical, level 3 is slow and design-aware. Together they catch the full spectrum of drift while the context is hot, not at the PR review three days later.

1. **Activate baseline** at start: cite the applicable rule IDs (above). Locate (or write — R26) the Task Spec; implementation targets its acceptance criteria.
2. **Implement** the change. Anything not covered by an AC does not get built (R27); anything that contradicts an AC changes the spec first (Decisions log), then the code.
3. **Level 1 — `code-auditor` (mechanical, ~5s, max 3 iterations).**
   - List the files you touched (`git diff --name-only origin/develop...HEAD`).
   - Invoke the `code-auditor` subagent (`Agent` tool, read-only). It greps the diff for known anti-pattern codes (B-C1 `account_id` missing, F-C2 hex literals, F-C7 raw `fetch`, X-H4 unregistered env var, X-C3 forgotten baseline migration, ...).
   - If Critical or High findings exist → fix in place → re-invoke. Up to 3 iterations.
   - After the third red iteration, escalate via `AskUserQuestion`.
4. **Level 2 — `code-reviewer` (semantic, ~30s, max 2 iterations).**
   - Only after level 1 is clean.
   - Invoke the `code-reviewer` subagent (`Agent` tool, read-only), passing the Task Spec path. It reads the diff with judgment: lógica errada, race latente, side-effect em no-op input, ghost filter / dead state, dead-API surface, broken implicit contract entre módulos, naming que esconde intenção — e spec-compliance (`SC-*`): AC sem código, código sem AC (scope creep), abstração especulativa.
   - If Critical or High findings exist → fix → re-invoke. Up to 2 iterations.
   - After the second red iteration, escalate via `AskUserQuestion`.
5. **Level 3 — `/duck-debug` (Rubber Duck Debugging, optional — only for M/L tasks).**
   - Only after levels 1 and 2 are clean.
   - **Skip** if the diff is trivial (typo / rename / one-liner / test-only / styling-only). **Run** if any of: ≥4 files; new module / repository / use case; `domain/` modified; Prisma migration; auth / multi-tenant / PII / WhatsApp-session / webhook-signature surface; cross-layer contract change.
   - Invoke `/duck-debug` via the `Skill` tool. It orchestrates a 2-round dialogue between `duck-explainer` (verbalizes the change in 5 sections, no code blocks) and `duck-challenger` (reads only the explanation in Round 1, asks 3-7 naive-but-cirurgical questions, emits verdict CLEAN / GAPS / DESIGN-SMELL).
   - **GAPS** → fix the listed gaps → rerun `/duck-debug` (max 2 reruns).
   - **DESIGN-SMELL** → escalate via `AskUserQuestion`.
6. **Handoff** to `/finish-task` only when all activated levels return clean.
7. **Telemetry** — every Critical/High finding the auditor or reviewer reports — and every gap the challenger confirms — is logged to `.claude/learning/violations.md` (see `learning/protocol.md`). Recurring violations get promoted into BASELINE, hooks, or knowledge entries.

The three levels are complementary, not redundant: regex (L1) catches the literal violations; senior judgment (L2) catches the latent ones; verbalization (L3) catches the unspoken assumptions. Run L1 and L2 every task; run L3 when the cost (one minute of dialogue) is justified by the change's size or risk.

---

## What this doc is NOT

- Not a tutorial. The patterns docs explain how to do things; this doc tells you what NOT to skip.
- Not exhaustive. Edge cases live in the code-review checklist.
- Not stable forever. When the same violation appears in `learning/violations.md` with high frequency, promote the rule here (or tighten the existing one).
