# Self-Learning Protocol

Shared protocol for accumulating wisdom (not logs) across skill and agent executions. Based on Reflexion (NeurIPS 2023), A-MEM (NeurIPS 2025), and Progressive Summarization.

---

## Authority vs Wisdom vs Telemetry

This project has **three** kinds of persistent context:

| Source | Lives in | Status | Updated by |
|--------|----------|--------|-----------|
| **Patterns + BASELINE** | `.claude/patterns/{BASELINE,backend,frontend,code-review-checklist}.md` | **Authoritative** — these define how the codebase IS shaped (the non-negotiables, request lifecycle, semantic tokens, anti-patterns) | Deliberate edits + PR review |
| **Knowledge** | `.claude/knowledge/<skill>.md` | **Wisdom** — execution-time insights, gotchas, dead-ends, quirks observed in prior runs | This protocol (auto-curated by skills) |
| **Violations** | `.claude/learning/violations.md` | **Telemetry** — auto-incremented count of every Critical/High finding the auditor surfaces during the babysit loop | The babysit loop (specialists) + `/check` + `/code-review` |

**Rules:**
- Knowledge files **complement** the patterns docs — they never override or restate them.
- If your insight is generally true about the codebase architecture, propose it as a patch to a patterns doc instead of saving it to knowledge.
- Knowledge files capture: things that surprised you, second-order effects, dead-ends to avoid, model-specific quirks. They do NOT capture: the canonical layer structure, the response envelope shape, the hook decision tree (those live in patterns).
- The violations file is **not** wisdom — it's raw counts. It feeds the recurring-violations surfacing step (below) which decides what gets promoted into BASELINE or a hook.

---

## How It Works

Each skill/agent has a knowledge file at `.claude/knowledge/<skill-name>.md`. On every execution:

1. **Load** existing knowledge (Step 0)
2. **Apply** lessons to the current context
3. **Reflect** on what was learned (Step N-1)
4. **Capture** unsolicited user feedback when it arrives (Step N — never solicit it)

---

## Step 0 — Load Knowledge

Read `.claude/knowledge/<skill-name>.md` if it exists.

**Forced activation** (mandatory): After reading, produce a summary of the 3 most relevant entries for THIS specific task:

> **Knowledge activated:** (1) [entry], (2) [entry], (3) [entry]

This ensures deep processing rather than skimming.

Application rules:
- Apply lessons from past executions to THIS task
- Avoid repeating known dead-ends
- Prioritize `[High]` confidence entries over `[Low]` ones
- Ignore entries marked `[STALE]` unless directly relevant
- If the file does not exist, proceed normally — it will be created at the end

---

## Step 0.5 — BASELINE Activation (implementing specialists only)

Read `.claude/patterns/BASELINE.md`. Output a one-line activation statement listing the rule IDs that apply to THIS task:

> **Baseline activated:** R[id] ([short name]), R[id] ([short name]). Out of scope: R[id], R[id].

This is mandatory for `/backend`, `/frontend`, `/fullstack`, `/ai-backend`, `/test`, `/test-e2e`. Read-only specialists (`/architect`, `/brainstorm`, `/code-review`, `/normalize`, `/triage` subagents) cite BASELINE rules in their output but do not need to "activate" — they are not the ones writing code.

The activation statement primes the in-loop self-audit: at delivery time you re-check exactly the IDs you activated, plus any new ones the auditor surfaces.

---

## Step N-1 — Learn from This Execution

After delivering the result, reflect and write to `.claude/knowledge/<skill-name>.md`. The write rule depends on task size:

### Task size triggers the write path

Use the **same M/L heuristic** as `/duck-debug` (intentional parity — when the task is big enough to deserve a duck, it's big enough to deserve a learning entry):

- **Small (S)** — typo, rename, one-liner, single-file edit, test-only, styling-only, dependency bump. **Write is optional.** Apply the strict quality gate below: if all three "did I learn …?" questions answer "no", do not write. Filler is noise.
- **Medium/Large (M/L)** — ≥3 files touched, OR new module, OR `domain/` modified, OR Prisma migration, OR auth/multi-tenant/PII/WhatsApp-session/webhook surface, OR cross-layer contract change. **Write is mandatory — minimum 1 line of reflection.** Even if the task was routine, capture something: what was the trickiest part, what would future-you forget, what assumption was load-bearing. A short honest "nothing surprising — this was a straight follow of patterns/backend.md § X" is acceptable.

### The three "did I learn …?" questions

After delivering the result, read the current KNOWLEDGE file (if it exists) and ask:

1. **Did I learn something about the tools/APIs I used?** (e.g., a query pattern that worked well, a dead-end)
2. **Did I discover something about the codebase/domain not in the docs?** (e.g., a code pattern, hidden dependency)
3. **Did I find incorrect assumptions in my existing knowledge?** (update or remove them)

**Small tasks:** if the answer to ALL is "no", do NOT write anything.

**M/L tasks:** if the answer to ALL is "no", you still write **one** terse line under a `## Routine Tasks Log` section, format:

```markdown
- [YYYY-MM-DD] <one phrase — what shape of task this was, which pattern section governed>. [Confidence: Low|Med|High that it stays routine]
```

The Routine Tasks Log is **transient** by design: the monthly Consolidation Pass (below) prunes every entry older than 30 days. Its job is to give the consolidation pass surface area to detect "this same shape of routine task shows up every week — there's a pattern here worth promoting".

If there IS something new, update the appropriate section of the knowledge file per the rules below.

### Write Rules

- **Curate, don't accumulate** — update existing insights with better information, don't just append
- **Write wisdom, not logs** — no ticket numbers, no "today I learned". Write as a tip for your future self
- **Keep it under 80 lines** — if exceeding 60 lines, trigger a consolidation pass:
  - Merge related entries
  - Promote repeated patterns to "Consolidated Principles"
  - Prune lowest-confidence entries

### Quality Gates (apply BEFORE writing any new entry)

- Is it **project-specific**? (generic advice should NOT be stored)
- Is it **actionable** in a future execution? (if not, don't store)
- Is it **not already captured** by an existing entry? (if duplicate, update the existing one instead)

### Contradiction Detection (apply BEFORE writing)

- Scan existing entries for anything that contradicts the new insight
- If found: **update or replace** the old entry — never leave two contradicting entries
- If a Dead End turns out to work in a new context, move it out and explain when it works

### Entry Format

Every entry MUST include:
- **Date**: `[YYYY-MM-DD]` when the insight was first observed or last validated
- **Confidence**: `[High]` (validated 3+ times), `[Med]` (observed twice), `[Low]` (single observation)
- **Cross-reference**: `(see: Section > Entry)` when related to another entry

### Confidence Promotion

- If a `[Low]` entry is confirmed in this execution, promote it to `[Med]`
- If a `[Med]` entry is confirmed again, promote it to `[High]`
- Update the date when promoting

### Stale Detection

- If you notice an entry older than 30 days that was NOT relevant to any recent execution, mark it `[STALE]`
- `[STALE]` entries survive one more cycle — if still not relevant, remove them

---

## Step N — Capture Feedback (silently — never solicit it)

**Do NOT ask the user for feedback at the end of a task.** The autonomy contract in the root `CLAUDE.md` forbids ending a turn with "anything I got wrong?" — the feedback loop is implicit: the user pushes back when something is wrong.

When the user **volunteers** feedback (a correction, a pushback, a "não era isso"), at any point in the task:

1. Incorporate it into the skill's KNOWLEDGE.md as an insight (same curation rules as Step N-1).
2. If the feedback points to a flaw in the skill's approach (not just this specific task), suggest updating the SKILL.md itself.
3. If the feedback reveals the Task Spec was wrong (not the code), append the correction to the spec's `Decisions log` — the contract evolves on the record, never silently.

---

## Pattern-Adoption Telemetry

Every Critical or High finding surfaced during the babysit loop (per-specialist auditor pass) or during `/code-review` is appended to `.claude/learning/violations.md`. Specialists also record the ones they fixed in `/check` if those fixes correspond to BASELINE rules or checklist codes.

### File format

`.claude/learning/violations.md` is a single-section ledger. Each line:

```
| YYYY-MM-DD | <code> | <fixed-by> | <one-sentence-context> |
```

| Column | What |
|--------|------|
| Date | When the finding was surfaced |
| Code | `R<id>` (BASELINE) or `B-C/F-H/X-C/E-/SC-` (checklist) |
| Fixed-by | Skill that fixed it (`/backend`, `/frontend`, `/fullstack`, `/ai-backend`, `/check`, `/code-review`, `duck-challenger`, a gate name) — or `accepted` if the user accepted it |
| Context | One terse sentence: what file, what scenario. Never PII. Never paths to real customer data. **Escape any `\|` inside this column** — a raw pipe breaks the markdown table. |

The ledger is append-only. Curation happens in the recurring-violations surfacing pass below — never edit historical entries.

### Who writes

- **Specialist babysit loop (Iterations 2–3):** every Critical/High the `code-auditor` or `code-reviewer` reports, even if you fix it on the spot, gets one line.
- **`/duck-debug`:** every gap the challenger confirms (GAPS / DESIGN-SMELL verdicts) gets one line.
- **`/check`:** every fix you apply that maps to a BASELINE rule or a checklist code gets one line.
- **`/code-review`:** every Critical/High the reviewer flags gets one line, with `Fixed-by` = the skill that ultimately addressed it (or `accepted` if the user explicitly accepted the deviation).
- **`/finish-task` gates:** spec-compliance (`SC-*`) and contract-sync (`X-H1`) findings get one line each; Phase 8 verifies completeness for the whole task and patches misses.
- **Triage subagents:** never write here — they are read-only and pre-implementation.

### Quality gate before writing

Skip the entry if:
- It's a Medium/Low/Nitpick — only Critical/High count.
- It's a duplicate of a line written in the same task (one task, one entry per code).
- The context would expose PII / customer data — rephrase or skip.

---

## Knowledge Consolidation Pass (manual, monthly)

The forced-write rule for M/L tasks (above) means knowledge files **will accumulate routine entries** in the `Routine Tasks Log` section. That's the intentional cost — without it, the files stay empty (which is what was happening before this rule landed). The consolidation pass is how we keep the cost from compounding.

### When to run

- **Monthly** by default. Run on the first weekday of the month, or whenever the user invokes `/normalize knowledge`.
- **On demand** when any knowledge file exceeds 80 lines (the protocol's hard cap).
- **After a big delivery** when the user wants to capture lessons before they fade.

### How to run

For each `.claude/knowledge/<skill>.md`:

1. **Prune the `Routine Tasks Log`.** Drop entries older than 30 days. Entries within 30 days that repeat the same shape (e.g. "added a column + migration + ErrorCode + i18n" four times) are signal — see step 3.
2. **Promote High-confidence patterns.** Any entry in `Code Patterns` / `Query Insights` / etc. with `[High]` confidence that has been validated 3+ times is a candidate for promotion into `Consolidated Principles` (or into `patterns/<skill>.md` if it's truly authoritative).
3. **Detect emerging patterns from routine entries.** If the routine log shows the same shape ≥3 times in the last 30 days, that's a workflow opportunity:
   - If it's a step that could be a hook: add it to `.claude/hooks/post-edit-*.sh`.
   - If it's a class of rule the auditor or reviewer should catch: propose a new checklist code in `patterns/code-review-checklist.md`.
   - If it's a sequence of operations that always co-occur: extract it into a sub-skill or template.
4. **Merge near-duplicate entries.** Two entries describing the same gotcha in different words → one entry with the clearer phrasing, both dates preserved.
5. **Mark `[STALE]` entries for removal.** Entries that haven't been referenced in 30+ days AND were never promoted: mark `[STALE]`. They survive one more pass; remove on the next if still untouched.
6. **Verify the 80-line cap holds.** If a file is still over after pruning, you missed merge candidates — go back to step 4.

### What the consolidation pass writes

Update each knowledge file in place. Do not produce a separate report — the change is visible in `git diff`. If the consolidation surfaces something worth a `patterns/*.md` patch or a new hook, write that as a separate `AskUserQuestion` recommending the change.

---

## Recurring-Violations Surfacing (manual, periodic)

Once the violations ledger has accumulated meaningful data (≥30 entries, or every 2 weeks), a maintainer (the user or an explicit `/normalize` invocation) reviews it:

1. **Group by code.** A code with ≥5 entries in 30 days is a candidate for promotion.
2. **Decide the promotion target:**
   - **Hook** — if the violation can be detected by a grep-able pattern, add a heuristic to `.claude/hooks/post-edit-{backend,frontend}.sh`.
   - **BASELINE** — if the violation is a non-negotiable that specialists keep missing despite the existing rule, tighten the rule wording in `BASELINE.md` (or promote a checklist High → BASELINE).
   - **Knowledge** — if the violation is context-dependent (only happens in certain modules), add a `Module-Specific Rules` entry to the relevant `knowledge/<skill>.md`.
3. **Mark promoted entries.** Add `[PROMOTED YYYY-MM-DD]` to the relevant lines so they don't re-trigger the next surfacing pass.

The goal of telemetry is **rule evolution**, not blame. Recurring violations mean the rule, the hook, or the doc is failing — fix that, not the agent.

---

## KNOWLEDGE.md Template

Create this file after the first execution. Sections are customized per skill.

```markdown
## Consolidated Principles
[Battle-tested rules promoted from other sections after 3+ validations. Most reliable insights.]

## [Custom Section 1]
[Skill-domain specific]

## [Custom Section 2]
[Skill-domain specific]

## Dead Ends
[Things that look promising but waste time — so you never try them again]
```

### Sections by Skill

| Skill | Sections |
|-------|----------|
| architect | Consolidated Principles, Field-Research Patterns, Decision-Round Heuristics, Estimation Calibration, Dead Ends |
| backend | Consolidated Principles, Code Patterns, Query Insights, DI & Wiring Gotchas, Dead Ends |
| frontend | Consolidated Principles, Component Patterns, Performance Tricks, Styling Gotchas, Dead Ends |
| fullstack | Consolidated Principles, Integration Patterns, Contract Alignment, Cross-Layer Gotchas, Dead Ends |
| ai-backend | Consolidated Principles, Prompt Patterns, RAG Insights, LLM Gotchas, Dead Ends |
| bugsnag | Project → key map, Runbook, Data Access API recipes, Saved searches, Gotchas |
| brainstorm | Consolidated Principles, Effective Approaches, Question Patterns, Scope Insights, Dead Ends |
| code-review | Consolidated Principles, Common Violations, Safe Patterns, Module-Specific Rules, False Positives |
| ui-design | Consolidated Principles, Layout Patterns, Accessibility Fixes, Component Reuse, Dead Ends |
| test | Consolidated Principles, Test Patterns, Mock Strategies, Factory Insights, Dead Ends |
| test-e2e | Consolidated Principles, Selector Strategies, Flaky Test Fixes, Page Object Patterns, Dead Ends |
| copywriting | Consolidated Principles, Headline Patterns, CTA Insights, Tone Calibration, Dead Ends |

---

## Design Principles

1. **Curate, don't accumulate** — Update/replace, don't just append. 80 lines max.
2. **Write wisdom, not logs** — No execution dates, no ticket numbers in content. Dates are only for staleness tracking.
3. **Forced activation** — The agent MUST summarize relevant entries before starting. Without this, agents skim past the knowledge file.
4. **Confidence scoring** — New entries start as `[Low]`, get promoted through validation. Prevents one-off observations from having equal weight to proven rules.
5. **Contradiction detection** — Check for conflicts before writing. Self-reinforcing errors are the #1 risk of reflective memory.
6. **Temporal decay** — Entries not accessed in 30+ days get marked `[STALE]`. Prevents knowledge rot from API/codebase changes.
7. **Quality gates** — Not every observation deserves storage. Must be project-specific, actionable, and non-duplicate.
8. **User feedback loop (passive)** — The human is the external critic that prevents confirmation bias. Their pushback is captured when it arrives; it is never solicited at the end of a task.
9. **Consolidation trigger** — At 60+ lines, merge related entries and promote patterns to Consolidated Principles.
