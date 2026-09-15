# Pombo — Task Lifecycle Contract

This file defines the **task lifecycle** for implementation work in this repository. It is loaded automatically into every Claude Code session and applies to direct requests and to every specialist skill (`/backend`, `/frontend`, `/fullstack`, `/ai-backend`).

**Methodology: Spec-Driven Development (SDD).** Every non-trivial task starts with a written contract — a **Task Spec** in `.claude/specs/<slug>.md` (template and lifecycle in `.claude/patterns/spec.md`) — produced by `/triage`, `/architect`, or the implementing specialist BEFORE any code. Implementation targets the spec's acceptance criteria; the babysit loop and `/finish-task` Phase 4.6 verify the diff against it. The contract kills the two invisible failure modes: silent scope cuts and inflated code (R26–R28 in BASELINE).

There are two execution modes — pick based on whether the user explicitly asked for a worktree:

- **Worktree mode (full lifecycle):** triggered only when the user explicitly asks ("crie um worktree", "nova worktree", "/start-task", "abre uma branch nova", or similar). Runs the entire flow below: worktree → branch → review → tests → PR → cleanup.
- **Inline mode (default):** when the user describes a change without asking for a worktree, edit the **current branch** in the **current checkout**. No new worktree, no new branch, no automatic PR. The user owns commit/push/PR decisions.

---

## The Task Lifecycle — worktree mode (only when the user asks)

| # | Phase | Owner | Can interrupt the user? |
|---|---|---|---|
| 0 | **Start task** (worktree + branch) | `/start-task` | **No** — infer everything, never ask |
| 1 | **Triage → Task Spec** (architect + engineer + product perspectives in parallel; contract persisted to `.claude/specs/`) | `/triage` (or `/architect` for L/High-risk) | **Once, batched** — up to 5 questions at the very start |
| 2 | **Understand + plan** (internal, baseline-aware) | Specialist skill | **No** — the Task Spec from `/triage` informs the plan |
| 3 | **Implement against the spec** (with in-loop self-audit / BABYSIT) | Specialist skill | **No** — auditor pass before handoff, max 3 fix iterations |
| 4 | **Gates: coverage → spec compliance → contract sync → code review** | `/finish-task` (Phases 4.5–5) | No — report findings at the end |
| 5 | **Validate tests** (unit + e2e) | `/finish-task` (Phase 6) | Only on repeated failure (3 retries) |
| 6 | **Commit + push + PR to `develop`** | `/finish-task` (Phase 7) | No — fully automated |
| 7 | **Cleanup** (after PR merged) | `/cleanup-task` | Confirms PR status only |

**Worktree golden rule (when the user asked for one):** the task lives in its own worktree. Never implement on `develop` from the main checkout. The worktree is just a filesystem-isolated directory — the task runs in the **same Claude Code session** that started it. Never open a new editor window.

## The Task Lifecycle — inline mode (default)

| # | Phase | Owner | Notes |
|---|---|---|---|
| 1 | **Triage** (optional) | `/triage` | Run when the change spans multiple files OR the user explicitly asks "me ajuda a pensar antes" / "questiona isso". Skip for trivial fixes. |
| 1.5 | **Task Spec** (mandatory for non-trivial changes) | `/triage` if it ran; otherwise the specialist (Step 0.75) | SDD applies in inline mode too: micro-spec in `.claude/specs/<slug>.md` before code. Trivial fixes get a one-sentence inline contract instead. |
| 2 | **Understand + plan** (internal, baseline-aware) | Specialist skill | Same as worktree mode |
| 3 | **Implement on the current branch** (with in-loop self-audit) | Specialist skill | No worktree, no new branch. BABYSIT loop still applies. |
| 4 | **Stop and report** | The IA | No `/finish-task`, no `/code-review`, no `/check`. The user decides whether to commit, push, or open a PR. |

**Inline golden rule:** if the user did not ask for a worktree, do not create one, do not switch branches, and do not open a PR. Make the change on the current branch and stop. If the user later wants a review, tests, or a PR, they will ask.

---

## Autonomy contract — the IA drives, the user watches

The user expects to describe a task **once**, then see it executed end-to-end without being pulled back into the loop for minor decisions. This is the single most important rule in this file — treat it as overriding the default Claude Code ask-first bias.

**The IA MUST:**
- **Front-load all understanding.** Before touching code, read the files, form a mental model of what exists, and commit to a plan. Do this silently via tool calls — no back-and-forth.
- **Batch uncertainty.** If something is genuinely ambiguous, collect **all** the ambiguities into **one** `AskUserQuestion` call at the very start of the task. Never ask a second time unless a new hard blocker emerges mid-implementation.
- **Decide and announce, don't ask.** When there are 2–3 reasonable choices (library, pattern, naming, pagination style, optimistic vs. pessimistic update, etc.), pick the one that best fits the existing codebase and state the choice in one sentence ("Using X because Y"). The user will push back if they disagree.
- **Default to the existing convention.** If the codebase already does it a certain way, do it that way. "Ambiguous" means ambiguous to a senior engineer reading the repo — not to someone looking for reassurance.
- **Skip ExitPlanMode approval loops for normal tasks.** Plan mode is for *you* to think, not for a ceremonial approval gate. Write the plan, state it in 3–6 bullets, and proceed immediately. Only stop for explicit approval when the task is **large (>10 files, multi-day), risky (migrations, auth, payments, deletions), or architectural (new module, new external dependency, cross-cutting refactor)**.
- **Never ask permission to use a tool.** If a tool call is blocked by the sandbox, adapt and retry — don't escalate to the user.
- **Never end a turn with "let me know if…" or "anything I got wrong?"** The feedback loop is implicit: the user will tell you if something is wrong.

**The IA MUST NOT:**
- Ask for a Jira ID, branch name, or prefix that it can infer from the task description.
- Ask which specialist to invoke unless it is truly unclear (≥2 specialists with strong signals).
- Pause mid-implementation to confirm a naming choice, a file location, or a small refactor.
- Solicit approval before running a read-only tool, a test, a lint, or a type check.
- Add a "feedback" question at the end of the task. Learning happens silently via `.claude/knowledge/*.md`.

**When in doubt about whether to ask:** don't. Decide, execute, and leave the user one clear sentence describing the decision. The cost of a wrong micro-decision is a 10-second correction. The cost of interrupting the user is losing the entire point of this workflow.

---

## Zero-friction mode — the user should never need to think about the workflow

**The user opens a new prompt and describes the task in natural language (Portuguese or English). That's it.** They should never have to type `/backend`, `/frontend`, `/fullstack`, `/ai-backend`, `/finish-task`, or any specialist command. You — the assistant — drive the entire flow **inside the current Claude Code session** — one conversation per task. The only command the user types explicitly is `/start-task` (or its natural-language equivalents) when they want a fresh worktree + branch + PR flow. Without that, you stay on the current branch.

Before responding to any user message, you MUST decide which of these states you are in:

| Situation | Action |
|---|---|
| **A)** The user **explicitly asked for a worktree** ("crie um worktree", "nova worktree", "abre uma branch nova", "/start-task", or similar) | **Worktree mode**: run `/start-task "<the user's original message verbatim>"` via the `Skill` tool. `/start-task` creates the worktree + branch and then **immediately continues the task in the same session**, rooted in the worktree path. Do NOT stop after worktree creation — drive the flow through routing → planning → implementation → `/finish-task` in one conversation. |
| **B)** You are already in a **worktree** AND the user described a new task or follow-up changes | Proceed directly to routing + planning using the current worktree. Do not create another worktree. The full lifecycle (review → tests → PR) still applies, even for iterative changes — see `feedback_worktree_iteration.md`. |
| **C)** You are in the **main checkout** AND the user described a task **without asking for a worktree** | **Inline mode**: stay on the current branch. Do NOT run `/start-task`. Do NOT switch branches. Edit files in place. After implementation, **stop** — do NOT auto-invoke `/finish-task`, `/code-review`, or `/check`. Leave commit/push/PR decisions to the user. |
| **D)** The user asked a **question, did research, or meta-work** (editing `CLAUDE.md`, hooks, skills, asking how something works, debugging without editing) | Answer normally. Do NOT run `/start-task`. Do NOT invoke a specialist. Do NOT invoke `/finish-task`. |
| **E)** Trivial fix the user is explicit about (typo, single-line, "change X to Y in file Z") | Just do it. Skip worktree, skip planning, skip `/finish-task`. |

### Worktree triggers (situation A) — use only on explicit request

**Run `/start-task` only when the user clearly asks for it.** Examples:
- "Crie um novo worktree para isso"
- "Abre uma branch nova"
- "Quero fazer isso em uma worktree separada"
- "/start-task"
- "Vamos abrir um PR pra isso" (implies new branch + PR)

If the user did **not** say something like the above, default to **inline mode** (situation C). Do not infer a worktree from the size of the task, the existence of a Jira ID, or the fact that the change touches multiple files. The user owns this decision.

### How to distinguish "task" from "question/meta" (situation C vs D)

**It is a task (situation C) if:**
- The user uses verbs like "adiciona", "cria", "implementa", "faz", "corrige", "arruma", "refatora", "melhora", "otimiza"
- The user describes a desired outcome ("o filtro deveria...", "precisa de um botão que...")
- The user describes a bug with reproduction steps ("quando clico em X, acontece Y")
- The user provides a Jira ID
- The message is **prescriptive** (what should change)

**It is NOT a task (situation D) if:**
- The user asks "como", "por que", "onde", "o que"
- The user asks you to explain, summarize, or investigate something
- The user is editing the Claude Code setup itself (`CLAUDE.md`, `.claude/commands/`, `.claude/settings.json`, hooks)
- The message is **descriptive or interrogative** (asking about state)

### Worktree-mode protocol (situation A)

1. Acknowledge the request in one sentence ("Vou iniciar a tarefa em uma worktree isolada.").
2. Invoke `/start-task` via the `Skill` tool, passing the **entire original user message verbatim** (minus the "create a worktree" instruction itself, if it's separable) as arguments.
3. `/start-task` handles: fetching `origin/develop`, creating the branch + worktree, copying envs, running `yarn install`.
4. After `/start-task` finishes setup, **do not stop**. Invoke `/triage` via the `Skill` tool with the same task brief — this runs the architect + engineer + product subagents in parallel, batches their questions into ONE `AskUserQuestion`, and persists the **Task Spec** (the SDD contract) to `.claude/specs/<slug>.md`. Skip `/triage` only for trivial fixes; if `/triage` flags High risk or L size, switch to `/architect` instead (it persists the spec at Gate 2).
5. `/triage` itself hands off to the recommended specialist (its Step 5 invokes the `Skill` with the spec path + content) — do **not** invoke the specialist a second time. Only if `/triage` returns *without* invoking (e.g., it escalated to `/architect`, or the user overrode the recommendation) do you invoke the specialist yourself, passing the spec path + content as `$ARGUMENTS`. All tool calls target the worktree path (absolute paths or `cd <worktree> && …` in Bash).
6. The specialist runs Step 0 (knowledge) → Step 0.5 (BASELINE activation) → Step 0.75 (contract) → implement against the ACs → Step N (BABYSIT self-audit loop, including spec compliance). After the babysit loop is clean, invoke `/finish-task`.
7. `/finish-task` runs coverage gate → spec-compliance gate → contract sync → `/code-review` → test loop → commit + push + PR (Phase 7) → learning checkpoint. One conversation, start to PR.

### Inline-mode protocol (situation C)

1. Acknowledge in one sentence ("Vou aplicar a mudança direto na branch atual.") so the user knows you skipped the worktree.
2. **`/triage` is optional in inline mode.** Run it only if the change spans multiple files OR the user explicitly asks for a challenge round ("me ajuda a pensar antes", "questiona isso"). For trivial fixes, skip straight to step 3.
3. Route to the specialist (`/backend`, `/frontend`, `/fullstack`, `/ai-backend`) the same way as in worktree mode (or honor `/triage`'s recommendation if you ran it).
4. Specialist runs Step 0 (knowledge) → Step 0.5 (BASELINE activation) → Step 0.75 (contract — if `/triage` didn't write the spec, the specialist writes the micro-spec for non-trivial changes) → implement → Step N (BABYSIT self-audit loop, including spec compliance). The babysit loop runs in inline mode too — drift catches happen regardless of where the code lives.
5. **Stop after implementation.** Do not run `/finish-task`. Do not commit, push, or open a PR unless the user asks.
6. End with a one-sentence summary of what changed. The user decides the next step.

### Working directory discipline (situation B — already in a worktree)

Whenever you are in a worktree, **every file operation must target that worktree**:
- Prefer absolute paths rooted at the worktree for `Read`, `Edit`, `Write`, `Glob`, `Grep`.
- For `Bash`, prefix long-running or cwd-sensitive commands with `cd <worktree-path> && …`.
- Never edit files under `/Users/natanrotta/Documents/repositories/pombo/**` from within a worktree task — that's the main checkout and editing it would corrupt the isolation.
- Never create a second worktree for the same task. One worktree = one conversation, until the user says otherwise.

---

## Specialist Auto-Routing

**The user does NOT need to type `/backend`, `/frontend`, `/fullstack`, or `/ai-backend` explicitly.** When the user describes a task in natural language (with or without a command), you MUST classify the scope yourself and invoke the correct specialist via the `Skill` tool before entering Plan Mode.

### `/triage` runs FIRST (worktree mode)

In worktree mode, `/triage` runs immediately after `/start-task` and BEFORE the implementing specialist. The triage skill spawns three subagents in parallel (architect + engineer + product), batches their open questions into ONE `AskUserQuestion`, and persists the **Task Spec** (`.claude/specs/<slug>.md`) that the specialist consumes as `$ARGUMENTS`. You do not pre-classify the specialist — `/triage` recommends one and you honor it (or override if the user pushes back).

Skip `/triage` only when:
- The task is trivial (typo, single-line, "change X to Y in file Z").
- The task is large/risky/architectural (`/triage` will escalate to `/architect` anyway — go straight there).

In inline mode, `/triage` is optional. Run it only when the change spans multiple files or the user explicitly asks for a challenge round.

### Classification heuristic (used by `/triage` and as a fallback)

Analyze the user's description and the files the task will likely touch. Use these rules in order:

1. **AI / LLM / RAG / embeddings / prompts / LangChain / assistant / tool-calling** → `/ai-backend` (Pombo has no AI infra yet — this specialist also owns building the foundation, see its "Status in Pombo")
2. **Only backend signals** (API, endpoint, route, Express, Prisma, migration, SQL, repository, service, worker, BullMQ, queue, webhook, cron, DI container, Zod schema, DTO, Vitest, Baileys/WhatsApp gateway, outbox, `apps/api/**`) → `/backend`
3. **Only frontend signals** (component, page, route in React Router, Chakra, TanStack Query, hook, form, modal, i18n, selector, Playwright, `apps/web/**`) → `/frontend`
4. **Both backend AND frontend signals in the same task** (new endpoint + new UI to consume it, new field in DB + form to edit it, filter in list + query param in API) → `/fullstack`
5. **Read-only analysis, scoping, architectural discussion with no implementation** → `/brainstorm` or `/architect` (brainstorm for scope validation, architect for full technical specs)
6. **Read-only audit / "what's wrong with this code" / normalization sweep against patterns** → `/normalize` (dispatches the `code-auditor` subagent in an isolated context and returns a severity-graded report)
7. **Observability / "is prod reporting?" / an incident log, print or stacktrace to diagnose / Bugsnag** → `/bugsnag` (dispatches the `bugsnag-analyst` subagent: live account + reporter wiring, diagnosis only). **Security question / threat model / hardening** → `/security`. **Deploy / infra / production ops** → `/devops`.

### Ambiguity rule

Pick the best specialist with your own judgment and **announce the choice in one sentence** before handing off. Only stop to ask via `AskUserQuestion` if two specialists have genuinely equal signal (e.g. "melhorar performance da listagem" could be API or render, with no hint which). When you do ask, batch it with any other upfront questions — one interruption, not many.

A wrong specialist costs a 10-second correction. Interrupting the user for every ambiguity costs the entire workflow. **Default to deciding.**

### Transparency rule

When you auto-route, **always tell the user** in one short sentence which specialist you chose and why, before handing off. Example:

> "This touches both the `GET /devices` endpoint and the `DevicesListPage` UI, so I'm invoking `/fullstack`."

The user can then correct you in one message ("no, just `/frontend`, the endpoint is already done") before any work begins.

### Examples

| User's prompt | Routing |
|---|---|
| "preciso adicionar um filtro de status na listagem de dispositivos" | `/fullstack` (UI dropdown + API query param) |
| "adiciona retry exponencial no envio de webhooks" | `/backend` (worker-only) |
| "o QR do modal de conexão some depois de reconectar" | `/frontend` (UI bug) |
| "crie um endpoint POST /devices/:id/messages/location que envia uma localização" | `/backend` (endpoint + use case + gateway only) |
| "adiciona um botão de 'desconectar' no card do dispositivo que chama o endpoint POST /devices/:id/disconnect" | `/frontend` (endpoint already exists — only UI work) |
| "classifica as mensagens recebidas com um LLM e responde automaticamente" | `/ai-backend` (LLM — starts by building the provider foundation) |
| "a API de produção parou de reportar erros" / "diagnostica esse stacktrace" | `/bugsnag` (diagnosis, no code) |
| "refatorar o fluxo de login" | **Ambiguous** — ask: backend (auth middleware/JWT) / frontend (login page) / fullstack (both)? |
| "melhorar a performance da listagem de dispositivos" | **Ambiguous** — ask: API query optimization / React render optimization / both? |

### Explicit override

If the user DOES type `/backend`, `/frontend`, `/fullstack`, or `/ai-backend` explicitly, honor the choice immediately — do not re-classify or second-guess. The explicit command is authoritative.

---

## Planning (phase 1) — internal by default

Planning is for **you** to think, not a ceremonial approval gate with the user. Default behavior:

1. **Read** the relevant files silently. Understand what exists. Prefer reusing existing functions, components, and patterns.
2. **Decide** the approach. Pick the option that best fits the existing codebase. When the task has genuine upfront ambiguity, ask **one batched question** via `AskUserQuestion` (all ambiguities in a single call) — then proceed.
3. **State the plan** in 3–6 bullets inline in the conversation: files to touch, key decisions, trade-offs. Do **not** require user approval — just start implementing.
4. **Implement.** Don't come back to the user for naming choices, file locations, or small refactors. Decide and move on.

### When to use formal Plan Mode with `ExitPlanMode` approval

Only for tasks that are **large, risky, or architectural**:
- >10 files touched, or multi-day scope
- Database migrations, auth, payments, permissions, data deletion
- New module, new external dependency, cross-cutting refactor
- Anything the user flagged as "think about this first" or "preciso revisar antes"

For these, write a plan file, use `ExitPlanMode`, and wait for approval. Everything else: decide and execute.

**Skip planning entirely for:**
- Single-line typo fixes
- Pure research/investigation questions (no code changes)
- Read-only exploration
- Trivial one-file changes where the user has already been fully specific

## End of a task — depends on the mode

### Worktree mode (situations A and B)

**After implementation is complete, you MUST invoke `/finish-task`.**

`/finish-task` runs the gates in order and blocks progression on failure:
1. **Test coverage gate** (mandatory backend specs — Phase 4.5)
2. **Spec compliance gate** (the diff vs. the Task Spec's acceptance criteria — Phase 4.6)
3. **BE↔FE contract sync** (advisory — Phase 4.7)
4. **Code review** via `/code-review` (Phase 5)
5. **Test validation loop** — auto-fixes failures and retries up to 3 times (Phase 6)
6. **Commit + push + PR to `develop`** (Phase 7 — owned exclusively by `/finish-task`)

#### Hard rules
- **Do not** end the turn with modified files if `/finish-task` has not reported success.
- **Do not** call `git commit`, `git push`, or `gh pr create` outside `/finish-task` Phase 7. No other skill or specialist ever runs them.
- **Do not** disable or weaken a test to make the test loop pass. Fix the code.
- **Do not** mark the task complete if unit or e2e tests are failing.

#### Test validation loop
- Test validation is handled entirely **inside** `/finish-task` Phase 6 (its own 3-retry auto-fix loop). Do not manually orchestrate `/check` retries as part of the worktree flow — `/check` remains available as a standalone skill when the user explicitly asks for a validation pass.
- E2e tests (`yarn test:e2e` in `apps/web`) run only when frontend files changed (`apps/web/**`). Backend-only and `.claude/`-only changes skip e2e for speed.

### Inline mode (situation C)

After implementation, **stop**. Report what changed in one sentence and wait. Do not invoke `/finish-task`, `/code-review`, or `/check`. Do not run `git commit`, `git push`, or `gh pr create`. The user will tell you the next step (commit, push, run tests, open a PR, or move on). If the user later asks for a review or tests, run them directly without auto-creating a worktree or PR.

## After the PR is merged (worktree mode only)

Run `/cleanup-task` to remove the worktree and delete the local branch. It verifies PR status first (MERGED is the happy path) and refuses to destroy uncommitted work. Inline-mode changes don't need cleanup since no worktree was created.

---

## Canonical commands per phase

| Phase | Command | Mode | Notes |
|---|---|---|---|
| **0** | **`/start-task`** | Worktree only | Run only when the user explicitly asks for a worktree. Skip in inline mode. |
| **1** | **`/triage`** | Worktree (mandatory), Inline (optional) | Tri-perspective intake — architect + engineer + product subagents in parallel; batches questions into ONE `AskUserQuestion`; persists the **Task Spec** to `.claude/specs/<slug>.md`. Skip for trivial fixes; escalate to `/architect` for L-sized features (it persists the spec at Gate 2). |
| 2 | `EnterPlanMode` → `ExitPlanMode` | Both | Native Claude Code plan mode (only for large/risky/architectural tasks; everything else is inline plan in 3–6 bullets) |
| 3 | `/backend` `/frontend` `/fullstack` `/ai-backend` | Both | Implementing specialists. Each runs Step 0 (knowledge), Step 0.5 (BASELINE activation), Step 0.75 (Task Spec contract), implementation against the ACs, then Step N (BABYSIT self-audit loop with `code-auditor` + `code-reviewer`, including spec compliance). |
| 3 (research only) | `/brainstorm` `/architect` | Both | Read-only — hand off to an implementer |
| 3 (audit only) | `/normalize` | Both | Read-only — dispatches the `code-auditor` subagent and returns a severity-graded normalization report. `/normalize knowledge` runs the knowledge consolidation pass. |
| 3 (domain experts) | `/security` `/devops` `/bugsnag` | Both | Consultant + implementer skills with their own read-only lens agents (`security-auditor`, `bugsnag-analyst`). Fixes go through the standard flow — they are never a parallel gate. |
| 4 | `/code-review` | Worktree only | Called by `/finish-task` Phase 5 |
| 5 | `/check` | Worktree only | Standalone validation loop; `/finish-task` Phase 6 runs the same suite |
| **4–6** | **`/finish-task`** | Worktree only | Required at the end of a worktree task. Runs all gates and owns commit + push + PR (internal Phases 4.5–8: coverage → spec compliance → contract sync → review → tests → PR → learning). **Never run automatically in inline mode.** |
| **7** | **`/cleanup-task`** | Worktree only | Run after the PR is merged to remove the worktree |

---

## Code quality enforcement

Five layers protect against pattern drift. They are described here so future sessions discover them automatically.

### 1. Patterns docs (authority)

`.claude/patterns/{BASELINE,spec,backend,backend-modules,frontend,e2e,security,bugsnag,code-review-checklist}.md` are the single source of truth. Every specialist skill defers to them.

- **`BASELINE.md`** is the one-page non-negotiables doc (rule IDs R1–R28). Specialists "activate" the applicable IDs at task start (Step 0.5) and re-check them in the babysit loop. This is the fast-load compass.
- **`spec.md`** defines Spec-Driven Development: the Task Spec template, who writes it, and the spec-compliance checklist (`SC-*` codes). The spec owns WHAT a task delivers; the docs below own HOW.
- **`backend.md` / `frontend.md`** are the canonical lifecycle docs (full architecture, all patterns).
- **`backend-modules.md`** is the authority for the backend **physical organization**: `apps/api/src` is **module-first** (`modules/<domain>/ · shared/ · core/ · test/`), NOT layer-first. It owns WHERE a backend file goes (the module skeleton, the 16-domain list, the singular type subfolders, the `@modules`/`@core`/`@shared`/`@test` aliases). `backend.md` owns HOW (the request lifecycle & patterns). When they seem to disagree on a path, `backend-modules.md` wins.
- **`e2e.md`**, **`security.md`** and **`bugsnag.md`** own their lenses (Playwright conventions + `E-*`; the app security model + `SEC-*`; error reporting + `BS-*`).
- **`code-review-checklist.md`** is the full anti-pattern catalog with portable codes (`B-C1`, `F-H3`, `X-C2`, `SC-H2`...) that are referenced by every other quality-enforcement piece below.

### 2. Live hooks (advisory, written-time)

`.claude/settings.json` registers `PostToolUse` hooks that run after every `Edit`/`Write`/`MultiEdit`. They are fast bash scripts that grep the touched file for the most common project-specific anti-patterns and write warnings to stderr. They are **non-blocking** — the IA reads the warnings and corrects mid-task, not at the end.

| Hook | Triggers on | Catches (sample) |
|---|---|---|
| `.claude/hooks/post-edit-backend.sh` | `apps/api/src/**/*.ts` | `B-C4` `throw new Error`, `B-H12` `console.log`, `B-C13` direct LLM call, `B-C7` `$queryRawUnsafe`, `B-H3` Prisma catch missing `mapPrismaError`, `B-C9` use case touching Request/Response, `B-C10` domain importing infrastructure, `B-H8` `findMany` without pagination |
| `.claude/hooks/post-edit-frontend.sh` | `apps/web/src/**/*.{ts,tsx}` | `F-C3` yellow/orange/amber tones, `F-C2` hardcoded hex outside theme, `F-C7` direct fetch/axios, `F-C9` hardcoded route literals, `F-H16` `useColorMode()` conditional, `F-H6` raw `<Input>`/`<Textarea>`/`<Select>` outside shared/forms |

If a hook fires repeatedly on legitimate code, fix the heuristic in the script — never silence the warning.

### 3. Blocking gates (at finish time)

`/finish-task` runs the gates before opening the PR:

- **Phase 4.5 — Test coverage gate.** `.claude/hooks/check-test-coverage.sh` compares the branch (committed + uncommitted) against `origin/develop` and refuses to proceed if any new/modified `*.use-case.ts`, `*.entity.ts`, `*.dto.ts`, or `*.controller.ts` lacks its co-located `*.spec.ts`. **Backend unit tests are mandatory in this project.** Skipping the gate requires explicit user approval and a documented reason in the PR body.
- **Phase 4.6 — Spec compliance gate.** The diff is walked against the Task Spec: every AC maps to code + test; every behavior change maps back to an AC; no scope creep, no speculative abstractions (`SC-*` codes). The spec's status flips to `implemented`.
- **Phase 4.7 — BE↔FE contract sync.** `.claude/hooks/check-contract-sync.sh` surfaces dead-API and broken-FE candidates (advisory).
- **Phase 5 — Code review.** `/code-review` walks the checklist (including `SC-*`) and produces a structured severity-graded report.
- **Phase 6 — Test validation loop.** `yarn type-check && yarn lint && yarn test` (and `yarn test:e2e` if frontend changed). Up to 3 retry attempts with auto-fix.
- **Phase 7 — Commit + push + PR.** Owned exclusively by `/finish-task`; the PR body links the spec and checks off its ACs.
- **Phase 8 — Learning checkpoint.** Telemetry completeness + knowledge reflection + promotion radar (codes ≥5×/30d).

### 4. The audit subagent (read-only, on demand)

`.claude/agents/code-auditor.md` is a read-only subagent that runs in **isolated context**. It is invoked in three scenarios:

1. **By `/normalize`** — when the user asks "what's wrong with this code" / "audit this module" / "normalize this PR".
2. **By the per-specialist BABYSIT loop** — every specialist (`/backend`, `/frontend`, `/fullstack`, `/ai-backend`) calls the auditor on its diff before declaring done; fixes findings; re-audits. Up to 3 iterations.
3. **By `/code-review`** during `/finish-task` — final pass before the PR.

The auditor never modifies files. After the report, the user (or the orchestrator) hands off to `/backend`, `/frontend`, `/fullstack`, or `/ai-backend` to apply the fixes.

### 5. Triage gate + BABYSIT loop + telemetry (intake → in-loop → ledger)

The newest layer protects against drift **before** code is written and **during** the write itself:

- **`/triage` (intake).** Three subagents (`triage-architect`, `triage-engineer`, `triage-product`) run in parallel against the codebase, batch their open questions into ONE `AskUserQuestion`, and persist the **Task Spec** to `.claude/specs/<slug>.md`. The spec carries the acceptance criteria, the BASELINE rule IDs in scope, the reuse map (DRY first), the files plan, the test plan, and the diff budget. The implementing specialist consumes it as `$ARGUMENTS` and `/finish-task` Phase 4.6 verifies the diff against it.
- **BABYSIT loop (in-loop self-audit).** Every implementing specialist runs Step N before handoff: manual checklist walk (including spec compliance) → invoke `code-auditor` on the diff → fix Critical/High → re-audit → invoke `code-reviewer` (with the spec path) → fix → re-review. Up to 3 auditor + 2 reviewer iterations. After the last red iteration, escalate via `AskUserQuestion`.
- **Telemetry (`.claude/learning/violations.md`).** Every Critical/High finding the auditor, reviewer, duck-challenger, or any gate reports — even one fixed immediately — is appended as one line. `/finish-task` Phase 8 verifies completeness and runs the promotion radar: codes that recur ≥5 times in 30 days are surfaced for promotion into a hook, into BASELINE, or into a module-specific knowledge entry. This is how the rules evolve — the flow learns from every cycle.

The contract: the spec prevents building the wrong thing, triage prevents bad starts, the babysit loop prevents bad endings, and the telemetry ledger evolves the rules so the same violation never recurs.

---

## Applicability

This contract applies when the user asks you to change code in this repository. It does **not** apply to:
- Pure Q&A or explanations
- Reading/summarizing existing code
- Debugging without edits
- Configuration of Claude Code itself (skills, hooks, settings)

When in doubt about which mode to use, default to **inline mode** (no worktree, no PR). Worktree mode is opt-in via explicit user request.
