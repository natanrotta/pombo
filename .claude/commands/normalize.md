---
description: Read-only normalization audit. Scans an existing module / file / PR for drift against the project patterns and returns a severity-graded report (uses the code-auditor subagent in an isolated context). Use when the user wants to know "what should we clean up here" without implementing anything.
---

# Normalize — Pombo

You orchestrate a **read-only normalization audit** by dispatching the `code-auditor` subagent with a clear scope, then presenting the report and offering a focused fix path.

This skill **does not modify files**. Its only deliverable is a report. After the report, the user decides which findings to fix and which specialist (`/backend`, `/frontend`, `/fullstack`, or `/ai-backend`) to invoke for the implementation.

---

## Inputs

`$ARGUMENTS` may be empty, a path, a module, or a free-form description. Resolve as follows:

| Input | Resolution |
|---|---|
| Empty | Ask the user **one** question: "Which scope? (a) the changed files in this branch vs `develop`, (b) a specific module or file, (c) the most recent PR. Pick one." |
| `apps/api/src/...` or `apps/web/src/...` (file or directory) | Use as-is. |
| Module name (`devices`, `messaging`, `webhooks`, `auth`, ...) | Resolve to both `apps/api/src/modules/<name>` and `apps/web/src/modules/<name>` if either exists. |
| `pr` / `branch` / `diff` | Run `git diff --name-only origin/develop...HEAD` (in the worktree) and pass the file list as the scope. |
| `knowledge` | **Different mode** — run the Knowledge Consolidation Pass + Recurring-Violations Surfacing instead of a code audit. See § Knowledge mode below. |
| Anything else | Ask one batched clarifying question. |

If the resolved scope expands to **>40 files**, refuse and propose a narrower target (one module, or "the changed files in this branch").

---

## Workflow

### Step 1 — Resolve scope

1. If `$ARGUMENTS` is unclear, ask one batched question and wait.
2. If `pr` / `branch` / `diff`: `git fetch origin develop --prune` then `git diff --name-only origin/develop...HEAD`. If the diff is empty, abort with "Nothing to normalize — branch matches develop."
3. Print the resolved scope inline so the user sees what will be audited:

   > Auditing N files in `<scope>`. Mode: `full` (Critical + High + Medium + Low + Coverage).

### Step 2 — Dispatch the auditor

Invoke the `code-auditor` subagent (via the `Agent` tool with `subagent_type: code-auditor`). Pass:

- The exact list of files (or the module path) as the scope.
- The mode (default `full`; if `>20 files`, suggest `quick`).
- A reminder that the report follows the format in `.claude/agents/code-auditor.md` § Step 3.

The subagent runs in an isolated context. It does its own reading. You don't pre-read the files yourself.

### Step 3 — Relay the report

Print the auditor's report verbatim to the user (it's already structured: What's right → Critical → High → Medium → Low → Coverage gaps → Summary).

After the report, append:

```markdown
### Suggested next steps
- Critical first (`N` items). Each one would block PR merge per `code-review-checklist.md`.
- For Critical/High items concentrated in a single layer, hand off to:
  - Backend → `/backend`
  - Frontend → `/frontend`
  - Both → `/fullstack`
  - AI infra → `/ai-backend`
- For coverage gaps, hand off to `/test`.
```

### Step 4 — Offer to dispatch the fix

Ask exactly one batched question via `AskUserQuestion` (only when there is at least one Critical/High finding):

> "Which findings should I fix now?"
> Options: `All Critical`, `All Critical + High`, `Pick specific items`, `None — I'll handle manually`.

If the user picks a fix mode:
- For `Pick specific items`, follow up with the list (one message, numbered).
- Hand off to the right specialist via the `Skill` tool, passing the relevant findings as the task description.
- The specialist applies the fixes and ends with `/finish-task` per the standard lifecycle.

If the user picks `None`, stop. Do not implement anything.

---

## Knowledge mode (`/normalize knowledge`)

The maintenance pass for the learning layer — the only mode of this skill that writes files (and only under `.claude/`). Follow `.claude/learning/protocol.md` §§ "Knowledge Consolidation Pass" and "Recurring-Violations Surfacing" to the letter:

1. **For each `.claude/knowledge/<skill>.md`:** prune the `Routine Tasks Log` (>30 days), promote `[High]`-validated entries to `Consolidated Principles`, merge near-duplicates, mark/remove `[STALE]`, enforce the 80-line cap.
2. **For `.claude/learning/violations.md`:** group entries by code; any code with ≥5 entries in the last 30 days is a promotion candidate (→ hook heuristic, BASELINE tightening, or module-specific knowledge entry). Present the candidates and the recommended target via **one** `AskUserQuestion`; apply only what the user approves; mark promoted lines with `[PROMOTED YYYY-MM-DD]`.
3. Report a compact summary: lines pruned, entries promoted, candidates surfaced.

Run monthly, when any knowledge file exceeds 80 lines, or whenever `/finish-task` Phase 8's promotion radar recommends it.

---

## Hard rules

1. **Read-only for code.** This skill **never** edits application files. Implementation goes through `/backend`, `/frontend`, `/fullstack`, or `/ai-backend`. The single exception: `knowledge` mode curates `.claude/knowledge/*` and `.claude/learning/violations.md` markers, per the protocol.
2. **No `/finish-task` from this skill.** A pure audit produces no diff, so there is nothing to finish. Only the downstream specialist (if dispatched) ends with `/finish-task`.
3. **Don't echo files into the conversation.** The auditor reads them in its own context — keep main context lean.
4. **Severity matches the checklist.** Don't paraphrase the auditor's severities; relay them verbatim.

---

## Output budget

- Step 1 (scope): 1–2 lines.
- Step 2 (dispatch): 1 line ("Dispatching code-auditor over `<scope>`...").
- Step 3 (report): the auditor's report verbatim, then ~5 lines of next-steps.
- Step 4 (offer): one `AskUserQuestion`.

Total visible output should be under ~700 lines. If the auditor returns more, ask the user whether to trim or split.

$ARGUMENTS
