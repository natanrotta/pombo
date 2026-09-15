---
description: Code review skill. Thin wrapper that delegates to the `code-reviewer` subagent so the review runs in an isolated context and never pollutes the orchestrator's window. Anchored on the project anti-pattern checklist; produces a structured severity-grouped report with actionable suggestions.
---

# /code-review — Pombo

This skill is a **thin orchestrator**. The actual review is performed by the `code-reviewer` subagent (`.claude/agents/code-reviewer.md`), which loads the patterns docs once in an isolated context window. Your job here is to (1) figure out the scope, (2) invoke the subagent with that scope, (3) relay its report back, and (4) ensure telemetry is written.

The heavy lifting — checklist walks, severity rubric, design-observations, proposed-checklist-additions — lives in the subagent. Do not duplicate it here.

---

## Why this is a wrapper

- **Isolated context.** The subagent reads `patterns/code-review-checklist.md`, `patterns/backend.md`, `patterns/frontend.md`, `patterns/BASELINE.md`, and the Task Spec once, in its own window. The orchestrator's context stays clean.
- **Composability.** `/code-review` can be invoked standalone, from `/finish-task` Phase 5, or as level 2 of the BABYSIT loop in every specialist — all routes hit the same subagent.
- **Pairs with `code-auditor`.** The auditor is mechanical (grep-able patterns); the reviewer is semantic (judgment). Both subagents share the checklist but cover different layers.

---

## Workflow

### Phase 1 — Determine the scope

Look in `$ARGUMENTS` first. If absent, infer from context:

1. **Currently in a babysit loop?** Use the in-progress diff: `git diff --name-only origin/develop...HEAD`. Default.
2. **`/finish-task` Phase 5?** Same as above — `/finish-task` passes the diff explicitly.
3. **User asked to review something specific?** Use that scope (file path, module, PR range).

If the scope is genuinely ambiguous, ask **one** batched question via `AskUserQuestion`:

> "Review what? (a) current task diff vs develop, (b) a specific file or module, (c) a PR range."

Otherwise proceed without asking.

### Phase 2 — Invoke the subagent

Spawn the `code-reviewer` subagent via the `Agent` tool. Prompt template:

```
Scope: <diff list OR file path OR module path OR range>
Mode: <full | quick — default full>
Task Spec: <.claude/specs/<slug>.md — pass it whenever the scope is a task diff; the reviewer judges SC-* against it>
Context: <one sentence on what the implementer was trying to do, if known from the conversation>
```

Capture the subagent's full report.

### Phase 3 — Relay the report

Print the subagent's report **verbatim** to the user / calling skill. Do not paraphrase, summarize, or re-score severity — the subagent owns those decisions.

### Phase 4 — Telemetry verification

The subagent appends Critical/High findings to `.claude/learning/violations.md` itself (per `learning/protocol.md` § Pattern-Adoption Telemetry). After the report, verify with a `Bash` `git diff --name-only` that the file was updated. If not, append the missing lines yourself:

```
| YYYY-MM-DD | <code> | code-reviewer | <one-sentence context> |
```

One line per Critical/High finding, even ones that will be auto-fixed immediately.

### Phase 5 — Follow-up

If the user asks for a fix after the report, **do not patch the code yourself in this skill**. Either:

- Recommend invoking `/backend` / `/frontend` / `/fullstack` / `/ai-backend` to apply the fix; or
- If the user explicitly wants it done in this turn and the fix is unambiguous, exit this skill and hand the fix to the appropriate specialist.

`/code-review` itself stays read-only.

---

## Hard rules

1. **Always delegate to the subagent.** Do not run the checklist walk inline — that defeats the isolated-context benefit.
2. **Do not re-score severity.** Whatever the subagent labels Critical is Critical. The skill is a wrapper, not a second opinion.
3. **Telemetry is non-negotiable.** Every Critical/High must end up in `learning/violations.md`. If the subagent forgot, you write the lines.
4. **One subagent invocation per call** unless the scope was so large the subagent itself asked to split — in which case follow its recommendation.

---

## Example invocations

```
/code-review
```

(infers scope from current diff)

```
/code-review apps/api/src/modules/phones
```

```
/code-review files=apps/api/src/.../register-device.use-case.ts mode=quick
```

$ARGUMENTS
