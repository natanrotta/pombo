---
description: Tri-perspective intake gate. Runs Architect + Engineer + Product subagents in parallel against the codebase, batches every open question into ONE AskUserQuestion, and persists the unified Task Spec (the SDD contract) to .claude/specs/. Use BEFORE invoking an implementing specialist on any non-trivial task in worktree mode (and optionally in inline mode when the user wants the challenge).
---

# Triage — Pombo Pre-Dev Gate

You are the **triage orchestrator**. Your job is to run three perspectives over the user's task in parallel — architect, engineer, product — collect their open questions into a single batched `AskUserQuestion`, and produce the **Task Spec** (the Spec-Driven Development contract, `.claude/patterns/spec.md`) the implementing specialist will build against.

This is the **lightweight 80% gate** — fast, parallel, structured. Reserved for production-shaped tasks. Not a substitute for `/architect` (heavy formal spec) or `/brainstorm` (divergent design exploration).

---

## When to use

| Mode | Run `/triage`? |
|---|---|
| **Worktree mode**, non-trivial task (anything beyond a typo / one-line change) | **Yes — mandatory** as Phase 1.5 between `/start-task` and the implementing specialist |
| **Worktree mode**, trivial fix the user is explicit about | Skip |
| **Inline mode**, user describes a real change | Optional — run only if the change spans multiple files OR the user asks "me ajuda a pensar antes" / "questiona isso" |
| **Question / meta-work / debugging without edits** | Skip |
| **Architectural feature** (new module, migration, auth, payments) | Skip `/triage`, go straight to `/architect` |

If unsure, run it — the cost is low and the brief is reused by the specialist for free.

---

## Inputs

`$ARGUMENTS` is the user's task brief — the same text that would normally route directly to a specialist. Verbatim, no edits.

If `$ARGUMENTS` is empty, ask the user once: "Qual é a tarefa que você quer triar?" Then proceed.

---

## Workflow

### Step 1 — Spawn the three perspectives in parallel

Use a **single message with three `Agent` tool calls** so they run concurrently. Each subagent gets the same `task_brief`, so they have equal context.

```
Agent({
  description: "Architect triage",
  subagent_type: "triage-architect",
  prompt: "task_brief: \"<the user's brief verbatim>\"\n\nProduce your structured brief per your skill definition. Be surgical and time-boxed."
})

Agent({
  description: "Engineer triage",
  subagent_type: "triage-engineer",
  prompt: "task_brief: \"<the user's brief verbatim>\"\n\nProduce your structured brief per your skill definition. Be surgical and time-boxed."
})

Agent({
  description: "Product triage",
  subagent_type: "triage-product",
  prompt: "task_brief: \"<the user's brief verbatim>\"\n\nProduce your structured brief per your skill definition. Be surgical and time-boxed."
})
```

Wait for all three to return. They should each respond in under 5 minutes; if one is significantly slower, that's a signal the task is bigger than triage can handle — see the escalation rule below.

### Step 2 — Show the three briefs

Print each brief verbatim under a labeled header so the user can see the three perspectives:

```markdown
# Triage briefs

## Architect
<architect brief>

## Engineer
<engineer brief>

## Product
<product brief>
```

Do not paraphrase. The user reads the three briefs as-is. If a brief failed to follow its template, note it but proceed.

### Step 3 — Batch the open questions

Each subagent surfaced up to 2–3 open questions. Collect them all (deduplicate when two ask the same thing in different words), then present them in a single `AskUserQuestion` call with at most **5 questions total**. Each question MUST have a `(Recommended)` default.

If the three subagents collectively produced **zero** open questions, skip this step entirely — the brief is ready and you can go straight to Step 4.

If they produced **more than 5**, drop the lowest-impact ones (typically Engineer's "naming" questions go first; Product's "MVP cut" questions stay).

After the user answers, capture each answer (including `default` choices) in a confirmation block:

```markdown
## Triage decisions

| # | Topic | Decision |
|---|-------|----------|
| 1 | [topic] | [user answer] |
```

### Step 4 — Produce the Task Spec (the contract)

Synthesize the three briefs + the answered questions into the canonical contract and **persist it to `.claude/specs/<slug>.md`** (slug = branch slug in worktree mode; 3–6 word kebab-case task slug in inline mode). This is the SDD artifact defined in `.claude/patterns/spec.md` — the implementing specialist builds against it and `/finish-task` Phase 4.6 verifies the diff against it.

Write **exactly** this structure (the spec.md template, populated from the three perspectives):

```markdown
# Task Spec — <slug>

| | |
|---|---|
| **Status** | approved |
| **Branch** | `<branch>` |
| **Date** | YYYY-MM-DD |
| **Size / Risk** | [S/M/L from Engineer] / [Low/Medium/High from Architect] |
| **Specialist** | `[/backend | /frontend | /fullstack | /ai-backend]` — [one-sentence reason] |

## 1. Goal
[One paragraph — the user outcome, anchored on the Product brief's goal.]

## 2. Scope
**In:** [bullets from Product MVP cut, refined by answers]
**Out (deferred):** [bullets — explicit deferrals, never "TBD"]

## 3. Acceptance criteria
- **AC-1** — [testable, observable — seeded from the Product success metric + MVP behaviors. "User can X and sees Y."]
- **AC-2** — ...

## 4. Contracts & interfaces
[From the Architect brief: contract/migration impact, new ErrorCodes, env vars. Omit if none.]

## 5. Reuse map (DRY first)
[verbatim from Engineer's reuse map]

## 6. Files plan
**Create:** [from Engineer brief] **Modify:** [from Engineer brief]

## 7. Test plan
[verbatim from Engineer brief — every AC maps to at least one spec]

## 8. Diff budget
[file-count expectation from Engineer's estimate; "no new dependencies" unless a question decided otherwise; no drive-by refactors]

## Baseline rules in scope
- R[id]: [one-sentence note] (union of Architect's and Engineer's lists, dedup'd — R26–R28 are implicitly always on)

## Risks & edge cases
- **Architectural:** [from Architect] · **UX:** [from Product] · **Edge cases that bite:** [top 3 from Product]

## Decisions log
- [YYYY-MM-DD] [Triage decisions table from Step 3, one line per answered question; or "No open questions — three perspectives agreed."]
```

Cap the whole spec at **80 lines**. If it exceeds, you over-aggregated — trim. After writing the file, print it verbatim in the conversation so the user sees the contract.

### Step 5 — Hand off to the specialist

Invoke the recommended specialist via the `Skill` tool, passing the **spec path + full spec content** as `$ARGUMENTS`. The specialist's Step 0 (knowledge load), Step 0.5 (BASELINE activation), and Step 0.75 (contract) run on top of it.

```
Skill({
  skill: "[backend | frontend | fullstack | ai-backend]",
  args: "Task Spec: .claude/specs/<slug>.md\n\n<the spec content verbatim>"
})
```

After the specialist returns, the lifecycle continues normally (`/finish-task` for worktree mode; stop for inline mode).

---

## Escalation rules

- **Architect brief flags risk class High** → stop. Tell the user: *"Architect classified this as High risk (auth / payments / migration / new module). Recommend `/architect` for a full spec before implementation."* Wait for confirmation.
- **Engineer brief estimates size L** (≥16 files) → same escalation: route to `/architect`.
- **Product brief lists ≥5 edge cases that bite, OR the MVP cut is genuinely ambiguous** → loop back to Product with a follow-up clarification question (max 2 questions, one round). If still ambiguous, escalate to `/brainstorm` for divergent exploration.
- **Two of the three briefs disagree on layer/specialist** (e.g., Architect says backend, Engineer says fullstack) → flag the disagreement to the user as one of the open questions. Do not silently pick a side.

---

## Coordination with existing skills

| Skill | Relationship to `/triage` |
|---|---|
| `/start-task` | Runs first (worktree creation). `/triage` runs immediately after. |
| `/architect` | Heavyweight spec for L-sized / High-risk features. `/triage` escalates to it; never replaces it. |
| `/brainstorm` | Divergent design exploration BEFORE the task is shaped. `/triage` runs AFTER the task is shaped. |
| `/backend`, `/frontend`, `/fullstack`, `/ai-backend` | Consume the Task Spec from `/triage` as `$ARGUMENTS`. They run their own Step 0 (knowledge) + Step 0.5 (BASELINE) + Step 0.75 (contract) on top. |
| `/normalize` | Independent — for auditing existing code. `/triage` is for incoming work. |

---

## Self-Learning

After the specialist returns and the task completes (whether the user accepts the brief as-is or asks for changes), follow `.claude/learning/protocol.md`:

1. **Learn:** Did a specific question pattern reveal a useful decision? Did a perspective consistently surface the same gotcha for this kind of task? If yes, update `.claude/knowledge/triage.md`. Sections: `Consolidated Principles`, `Question Patterns`, `Perspective Disagreements`, `Common Escalations`, `Dead Ends`.
2. **Telemetry:** Any decision the specialist later overrides during implementation (or the code-review later flags) is logged to `.claude/learning/violations.md` as a triage-miss with the rule ID. This drives BASELINE evolution.
3. **Feedback:** Do **not** ask the user for feedback at the end of triage — they are about to implement. Learning happens silently.

---

## Hard rules

1. **Parallel by default.** Three subagents in one message, never sequentially.
2. **One question batch.** All open questions in a single `AskUserQuestion` call. Never loop into question-then-question.
3. **The spec is the contract.** The Task Spec file is what the specialist consumes and what `/finish-task` verifies — never paraphrase it on the way to the specialist; mid-task changes go to its Decisions log.
4. **No code, ever.** `/triage` never edits application files. The **only** file it writes is the Task Spec under `.claude/specs/`.
5. **Time-boxed.** ≤ 10 minutes from invocation to handoff. If it takes longer, the task is bigger than triage can handle — escalate.

$ARGUMENTS
