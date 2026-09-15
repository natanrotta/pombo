# Task Spec — Claude workflow parity with cuidda

| Field | Value |
|---|---|
| **Status** | implemented |
| **Branch** | `claude/refactor-agents-ia-structure-6a794a` |
| **Date** | 2026-09-14 |
| **Size / Risk** | L / Low (`.claude/**` + `CLAUDE.md` + `.gitignore` only — no application code) |
| **Specialist** | none (meta-work on the Claude Code setup itself) |

## 1. Goal

Bring Pombo's Claude Code agent/skill structure (`.claude/**` + `CLAUDE.md`) to parity with the `cuidda` repository, which carries the newest version of the shared workflow (SDD, triage, babysit loop, telemetry, observability skill, AI specialist). The two projects share the same stack and must offer the same programming experience: same agents, same flows, same anti-pattern codes — while every doc stays anchored on Pombo's **real** code (multi-tenant `account_id`, WhatsApp gateway domain, ports `4000`/`4444`, Chakra 2.8, no AI infra yet).

## 2. Scope

**In**
- Port every structural/methodology improvement cuidda made since the July 2026 fork: new checklist codes (`B-C13`, `F-H29`, `F-H30`), BASELINE `R23`, the explicit-DI-token rule, cross-module primitive exception, `/ai-backend` specialist + routing, `/bugsnag` skill + `bugsnag-analyst` agent + `BS-*` catalog + CLI + secrets template, `launch.json`, the turbo test note in `/check`, the e2e reliability notes, the `--to-schema` Prisma 7 flag in `migration-safety`.
- Re-anchor every pattern doc, agent and skill on Pombo's real code (which is already multi-tenant by `account_id`, contrary to what the boilerplate-era docs said): reference module `devices`, real middleware ladder, real cookies, real seed user, real modules/namespaces/query keys, real security surfaces (WhatsApp session keys, outbound webhooks, public API tokens).
- Fix stale paths (`boilerplate` main checkout → `/Users/natanrotta/Documents/repositories/pombo`; worktree convention `pombo-worktrees`).
- Align `.gitignore` with cuidda: commit `.claude/specs/` and `.claude/plans/`; ignore `.claude/worktrees/` and `.claude/*.lock`.
- New empty knowledge files for the new skills (`ai-backend`, `bugsnag`).

**Out**
- Cuidda-domain skills with no Pombo counterpart: `/help-doc`, `/soluti-signature`, `/zapi`, `patterns/help.md`, `H-*` codes, the `docs` Playwright project, Stripe fixtures.
- Cuidda's accumulated knowledge entries and violations ledger (project-specific lessons — Pombo keeps its own).
- The React 19 + Chakra v3 migration cuidda did (`knowledge/chakra-v3-migration-brief.md`). Pombo stays on React 18 + Chakra 2.8; the docs describe v2. Migration is a separate decision.
- A Baileys/WhatsApp domain-expert skill (the Pombo analogue of cuidda's `/zapi`) — valuable, but new authoring, not a port.
- Application code, README, `docs/` layout, CI workflows.

## 3. Acceptance criteria

- AC-1 Every file that exists in both repos under `.claude/{agents,commands,hooks,patterns,learning}` and `CLAUDE.md` carries cuidda's structural changes (verified against the normalized diff), with domain vocabulary translated to Pombo.
- AC-2 New files exist and are Pombo-native: `agents/bugsnag-analyst.md`, `commands/{ai-backend,bugsnag}.md`, `patterns/bugsnag.md`, `scripts/bugsnag/bugsnag.sh` (executable, `bash -n` clean), `.secrets/bugsnag.env.example`, `knowledge/{ai-backend,bugsnag}.md`, `launch.json`.
- AC-3 No doc describes Pombo as single-owner (`owner_id`/`ensureOwner`) anymore; tenancy is `account_id` with scoped repository reads and `NotFoundError` on miss, matching `IDevicesRepository`.
- AC-4 No cuidda-only vocabulary remains outside the explicit "Out" list: `grep -ri 'cuidda\|patient\|clinical\|PHI\|LGPD\|stripe\|copilot\|hostinger' .claude CLAUDE.md` returns only the intentional mentions in this spec and in `/ai-backend`'s generic "copilot-style" wording.
- AC-5 Hooks still parse (`bash -n .claude/hooks/*.sh`) and `settings.json` is valid JSON.
- AC-6 `.gitignore` no longer ignores `.claude/specs/*` / `.claude/plans/*`, and ignores `.claude/worktrees/` + `.claude/*.lock`.
- AC-7 Pombo's own knowledge entries and `learning/violations.md` are preserved untouched (except the cross-owner → cross-tenant wording in `knowledge/security.md`).

## 4. Files plan

| Action | Files |
|---|---|
| Edit | `CLAUDE.md`, `.gitignore`, `.claude/patterns/{BASELINE,spec,code-review-checklist,backend-modules,backend,frontend,e2e,security}.md`, `.claude/learning/protocol.md`, `.claude/hooks/post-edit-{backend,frontend}.sh`, all 10 `.claude/agents/*.md`, all 19 `.claude/commands/*.md`, `.claude/knowledge/security.md` |
| Create | `.claude/agents/bugsnag-analyst.md`, `.claude/commands/{ai-backend,bugsnag}.md`, `.claude/patterns/bugsnag.md`, `.claude/scripts/bugsnag/bugsnag.sh`, `.claude/.secrets/bugsnag.env.example`, `.claude/knowledge/{ai-backend,bugsnag}.md`, `.claude/launch.json`, this spec |
| Delete | `.claude/scripts/.gitkeep`, `.claude/specs/.gitkeep`, `.claude/plans/.gitkeep` (folders now tracked with content / no longer ignored) |

## 5. Test plan

Docs-only change: no unit/e2e tests. Verification = AC-4 grep sweep, AC-5 `bash -n` + `python -m json.tool`, and a manual read of the three highest-leverage files (`CLAUDE.md`, `patterns/BASELINE.md`, `patterns/backend.md`) against the real code they cite.

## 6. Diff budget

≈45 files touched, ≈2.5k lines net. Anything beyond the Files plan is scope creep (R27).

## 7. Decisions log

- D1 — `/ai-backend` is ported even though Pombo has no AI infra: routing parity matters, and the skill now opens with a "Status in Pombo" section that turns the cuidda inventory into a target shape. It never asserts that `ILlmProvider` exists.
- D2 — `/bugsnag` is ported with the topology as placeholders: Pombo's error reporters exist (API + web) but the account's project names/keys are unknown here. First use runs `bugsnag.sh projects` and fills `knowledge/bugsnag.md`.
- D3 — `migration-safety` keeps Pombo's Axis 1 (regenerate `_first`): Pombo squashes into a single baseline (dev-zero), the opposite of cuidda's incremental history. Only the Prisma 7 flag (`--to-schema`) is corrected.
- D4 — `/devops` keeps Pombo's generic wording: the production topology is not on the air yet; cuidda's version is its own provider inventory.
- D5 — Specs and plans become tracked (cuidda convention) so `/finish-task` PR bodies can link them.
