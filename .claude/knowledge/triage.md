# Triage — Accumulated Knowledge

> Living notes for the `/triage` skill and its subagents: routing/estimation calibration learned with use.

## Routing / sizing calibration
- 2026-09-16 — Infra/scripts/docs sweeps (`infra/`, `scripts/`, workflows, READMEs) route to `/devops`, not to an implementing specialist. The engineer sizes them L by file count (~40 files), but the risk is Low when `apps/*/src` stays untouched: ask the user in the ONE batch whether to proceed on the triage spec instead of auto-escalating to `/architect` (they chose proceed). Give each divergence its own AC so none is dropped silently.
- 2026-09-16 — Doc sweeps: verify every cited `yarn`/`make` command mechanically (script names vs `package.json`/`Makefile`) and every route/port claim against the source — the docs had drifted to non-existent commands (`yarn backend:prisma:migrate`) and an old stack (React 18/Chakra 2).
