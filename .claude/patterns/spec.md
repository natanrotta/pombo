# Task Spec — Spec-Driven Development (Authority)

**This project follows Spec-Driven Development (SDD): no non-trivial implementation starts without a written contract.** The contract is a **Task Spec** file in `.claude/specs/`, created at the start of the task and verified at the end by the spec-compliance gate (`/finish-task` Phase 4.6). The spec is the single source of truth for *what* the task delivers; the patterns docs remain the source of truth for *how* code is written.

Why this exists: the two failure modes this protocol kills are (1) **silent scope cuts** — an acceptance criterion quietly dropped mid-implementation, and (2) **inflated code** — features, abstractions, and refactors nobody asked for. Both are invisible in a green test suite; both are visible against a written contract.

---

## When a spec is required

| Task shape | Contract required |
|---|---|
| Trivial (typo, one-liner, single-file change the user fully specified) | **No file.** State a one-sentence contract inline before editing ("Contract: change X to Y in file Z, nothing else"). |
| Non-trivial, **worktree mode** | **Yes — mandatory.** Written by `/triage` (standard) or `/architect` (L-size / High-risk). |
| Non-trivial, **inline mode** | **Yes — mandatory.** Written by the implementing specialist at Step 0.75 (micro-spec, ≤40 lines) if `/triage` didn't run. Compliance is self-enforced via the babysit loop — inline mode has no `/finish-task` Phase 4.6 gate. |
| Read-only work (questions, audits, debugging without edits) | No. |

"Non-trivial" = anything that touches ≥2 files, creates a file, changes behavior, or requires a decision the user didn't already make.

## Naming, location, lifecycle

- **Location:** `.claude/specs/<slug>.md`, where `<slug>` is the branch slug (branch name minus `feature/`/`fix/`/`refactor/` prefix) or, in inline mode, a 3–6 word kebab-case task slug.
- **Status lifecycle:** `draft` (written, open questions pending) → `approved` (user answered the batched questions, or there were none) → `implemented` (set by `/finish-task` Phase 4.6 after the compliance check passes).
- **The spec is committed with the PR.** `.claude/specs/` is the permanent record of contracts — it documents *why* the code is shaped the way it is. Never delete shipped specs; never retrofit old ones.
- **Mid-task pivots are appended to the `Decisions log`**, never silently absorbed. If the user changes scope mid-task, the spec changes first, then the code.

---

## Canonical template

Sections 1–3 are mandatory for every spec. Sections 4–7 scale with task size: a micro-spec (inline mode, S/M task) may compress them to a few bullets; an `/architect` spec expands them with its full Phase 4–5 detail (entities, endpoints, security tables). The `Decisions log` is always present, even if empty.

```markdown
# Task Spec — <slug>

| | |
|---|---|
| **Status** | draft \| approved \| implemented |
| **Branch** | `<branch>` |
| **Date** | YYYY-MM-DD |
| **Size / Risk** | S/M/L / Low/Medium/High |
| **Specialist** | /backend \| /frontend \| /fullstack \| /ai-backend |

## 1. Goal
[One paragraph. The user outcome, not the implementation. If you can't say it in one paragraph, the task isn't shaped yet.]

## 2. Scope
**In:** [concrete behaviors that ship in this PR]
**Out (deferred):** [explicitly named — never "etc."]

## 3. Acceptance criteria
- **AC-1** — [testable, observable: "User can X and sees Y". Each AC must be verifiable by a test or a manual check.]
- **AC-2** — ...

## 4. Contracts & interfaces
[API shapes (verb + path + request/response), entity fields, ErrorCodes, events, env vars. The `{ ok, data }` envelope and type-mirroring rules from patterns/backend.md apply — reference them, don't restate.]

## 5. Reuse map (DRY first)
| Need | Existing piece | Path | Action (extend / call / mirror) |

## 6. Files plan
**Create:** ... **Modify:** ...

## 7. Test plan
[Which spec file covers which AC. Backend specs are mandatory (R24). E2E only if the task is explicitly an e2e task — e2e is off-band.]

## 8. Diff budget
[Anti-bloat guardrail: expected file count, "no new dependencies", "no drive-by refactors outside §6". The babysit loop and the reviewer check the diff against this.]

## Decisions log
- [YYYY-MM-DD] [decision — source: user answer / triage / specialist judgment. Batched-question answers land here. Mid-task pivots land here.]
```

Optional sections (recommended for M/L tasks; `/triage` always includes them): **`Baseline rules in scope`** (the R-IDs this task activates, with a one-sentence tie-in each) and **`Risks & edge cases`** (architectural + UX risks, top edge cases that bite).

---

## Who writes it, who reads it

| Phase | Actor | Responsibility |
|---|---|---|
| Intake | `/triage` | Synthesizes the three perspective briefs + user answers into the spec (status `approved`). The AC section is seeded by the Product brief's success metric + MVP cut. |
| Intake (L / High-risk) | `/architect` | Writes the full spec at Gate 2 approval (status `approved`). |
| Intake (inline, no triage) | Implementing specialist | Step 0.75: writes the micro-spec before any code, states it in the conversation, proceeds (no approval gate — the user corrects if wrong). |
| Implementation | Specialist | Implements **against the ACs**. Anything not covered by an AC does not get built. Anything that contradicts an AC goes back to the spec first. |
| Babysit loop | Specialist + `code-auditor` + `code-reviewer` | Manual walk includes the spec-compliance checklist (below). The reviewer receives the spec path and reports `SC-*` findings. |
| Finish | `/finish-task` Phase 4.6 | Walks AC ↔ code ↔ test mapping; flips status to `implemented`; the PR body links the spec and checks off the ACs. |

## Spec-compliance checklist (used by babysit + Phase 4.6)

1. Every AC maps to implementing code **and** a test (or a documented manual verification for pure-UI polish).
2. Every behavior change in the diff maps back to an AC (or to the Decisions log). Unmapped surface = scope creep (`SC-H2`).
3. No speculative abstractions: interfaces with one implementation, options nobody passes, configs nobody reads (`SC-H3`).
4. The diff respects the budget in §8: file count, no new deps, no drive-by refactors (`SC-M1`).
5. Scope cuts are explicit: an AC that didn't ship moved to **Out (deferred)** + Decisions log — never silently dropped (`SC-H1`).

The full `SC-*` code family lives in `patterns/code-review-checklist.md` § Spec compliance.

---

## What this doc is NOT

- Not a replacement for the patterns docs — `backend.md`/`frontend.md` still own *how* code is written; this doc owns *what* gets agreed before writing.
- Not bureaucracy for trivial fixes — the one-sentence inline contract exists precisely so the lightweight path stays lightweight.
- Not a planning theater: a spec that nobody verifies is dead weight. The spec only earns its cost because Phase 4.6 and the `SC-*` review codes close the loop.
