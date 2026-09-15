---
description: Run all monorepo quality validations and automatically fix any issues found.
---

# Quality Check — Pombo

Run all monorepo quality validations and automatically fix any issues found.

This skill is invoked by `/finish-task` after `/code-review` to confirm the code passes type, lint, format, and test gates before opening the PR.

**Loop philosophy.** This skill enforces the "loop until clean" half of the BABYSIT contract. Combined with the per-specialist self-audit loop (auditor pass) and `/finish-task` Phase 6 (test-validation loop), it guarantees that no code reaches PR review without a green local validation. The contract is: *fix the code, not the gate*.

---

## Workspace Layout

- Root scripts use Turborepo to fan out into both apps (`apps/api`, `apps/web`)
- API tests = Vitest, sempre via turbo (`yarn turbo run test --filter=@pombo/api`) — ver a nota na seção 4
- Web tests = Playwright (`yarn workspace @pombo/web test:e2e`)
- API lint auto-fixes (`--fix` flag); web lint does NOT auto-fix

---

## Steps

Execute sequentially. If a step fails, analyze the errors, fix them in source, and re-run before moving on. Up to **3 retry attempts per step**; if still failing, surface the failure to the user via `AskUserQuestion`. **Never** disable a rule, weaken an assertion, or comment out a test to make a step pass — fix the underlying code.

### 1. Type-check

```
yarn type-check
```

If it fails: read each file with errors, fix the typing issues (do not use `any` — use `unknown` and narrow), re-run.

### 2. Lint

```
yarn lint
```

This runs both apps via Turborepo. The API auto-fixes inline; the web app reports issues but does not auto-fix. If the web app fails:
- Read the error output and fix the source manually
- **Never** disable a rule unless you have explicit user approval
- Run `yarn lint` again to confirm

**Scoped-diff guard:** because the API lint auto-fixes the whole package, check `git status` afterwards — if lint touched files **outside** the task's scope (not in the Task Spec's files plan), revert those hunks (`git checkout -- <file>`). The PR diff stays scoped to the contract (SC-M1).

### 3. Format

```
yarn format:check
```

If it fails:

```
yarn format
```

Then re-run `yarn format:check` to confirm.

### 4. Backend tests (Vitest)

```
yarn turbo run test --filter=@pombo/api
```

Via turbo, **nunca** `yarn workspace @pombo/api test`: o script do workspace é um
`vitest run` pelado, e a API resolve `@pombo/shared-types` pelo `main` do pacote
(`packages/shared-types/dist`). Chamado direto, o vitest roda contra o dist que
estiver no disco — se ele estiver velho, os símbolos novos chegam como `undefined`
e a suíte quebra longe da causa. `turbo run test` honra o `dependsOn: ["^build"]`
declarado em `turbo.json` e rebuilda o shared-types antes de testar.

If it fails: analyze the failing test, identify root cause, fix the **code** (not the test, unless the test is genuinely outdated). Re-run. **Never** disable a test or weaken assertions to make it pass.

### 5. E2E tests (Playwright) — only if frontend files changed

```
yarn workspace @pombo/web test:e2e
```

When to run: any change under `apps/web/**`. Backend-only PRs can skip e2e for speed.

If it fails: read the failure screenshots / traces (Playwright stores them under `apps/web/playwright-report/` and `apps/web/test-results/`), fix selectors or flow logic, re-run. Never `waitForTimeout` to "fix" a flake — fix the real selector / wait condition.

---

## Reference

For backend test patterns (factories, mocks, conventions), defer to `.claude/patterns/backend.md` § Tests and the `/test` skill.
For e2e patterns (page objects, fixtures, selector priority), defer to `.claude/patterns/frontend.md` § Tests and the `/test-e2e` skill.

---

## Final Summary

Present:

| Check | Status | Attempts | Fixes applied |
|-------|--------|----------|---------------|

If everything passes on the first try: "All checks passed without issues."

If there were fixes: briefly list what was changed in each file (file:line + nature of fix).

---

## Telemetry

If you applied any fix during the loop that maps to a BASELINE rule (R1–R28) or a code-review checklist code (B-C/F-H/X-C/SC), append a line to `.claude/learning/violations.md` per `learning/protocol.md` § Pattern-Adoption Telemetry. This drives BASELINE evolution: codes that recur across many tasks get promoted into hooks or BASELINE itself.

$ARGUMENTS
