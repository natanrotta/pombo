# Task Spec — project-structure-standardization-11bee2

| | |
|---|---|
| **Status** | implemented |
| **Branch** | `claude/project-structure-standardization-11bee2` |
| **Date** | 2026-09-16 |
| **Size / Risk** | L (~25 files, mostly docs/infra) / Low–Medium (no API runtime change; touches the deploy path) |
| **Specialist** | `/devops` — every touched surface is root config, CI, `infra/`, `scripts/` or deploy docs |

## 1. Goal
The operator can follow `README.md`, `DEPLOY.md`, `infra/README.md`, the `Makefile` and the `yarn` ops scripts literally, and every command, path, port and env var matches what the app actually is today: a module-first, multi-tenant WhatsApp gateway API (single replica that owns the sockets) plus a React 19 / Chakra v3 web app. Drift between the env schema and the production env template is caught by a test, the same way `apps/api/.env.example` already is.

## 2. Scope
**In:** fix every divergence found in the audit (Decisions log + ACs below); one local compose file; one deploy-config file shared by `make` and `yarn`; the `infra/.env.prod.example` ↔ schema gate; docs rewritten against the real code.
**Out (deferred → backlog in `.claude/knowledge/devops.md`):** PITR/pgBackRest; origin firewall allowlist (edge IPs only) / authenticated origin pulls; rootless Docker or socket-proxy for the runner; a CI workflow for the static web deploy; pgvector (not used by the schema); scoping `yarn drop:all` to Pombo containers; any change to `/healthz`, `/api/health`, ports or the Zod schema.

## 3. Acceptance criteria
- **AC-1** — `infra/.env.prod.example` documents every `envObjectSchema` key (active or commented), ships `WHATSAPP_ENABLED=true` for the single gateway replica, and carries no key the schema doesn't read (container-only keys like `RUN_MIGRATIONS` are an explicit allowlist). `env-example.spec.ts` fails on drift in both directions for BOTH templates.
- **AC-2** — `make runner-setup` passes the repo URL the script requires (derived from `GH_REPO`) and fails fast with a clear message when `GH_REPO`/`APP_HOST` are unset.
- **AC-3** — One deploy-target file: `infra/deploy.env` (gitignored) + `infra/deploy.env.example`. The `Makefile` reads it (origin-gated `eval`, not a literal `-include`, so the shell wins) and `scripts/lib/deploy-cli.mjs` loads it when present; an exported shell var always wins. Makefile targets that need a host fail fast instead of running `ssh root@`.
- **AC-4** — Host paths are `/opt/pombo/app` everywhere (`infra/status.sh` included); `infra/status-app.sh` reports only fields `/api/health` returns (`version`, `uptimeSeconds`, `gateway`) and its public URL comes from `API_URL`.
- **AC-5** — `docker-compose.yml` is gone; `yarn docker:up|down|reset` target `docker-compose.local.yml`; no file references the removed compose.
- **AC-6** — Comments in `docker-compose.smoke.yml`, `apps/api/Dockerfile`, `prisma.config.ts`, the Caddy/compose files describe the real invocations, paths (`src/core/config`) and ports (container `3333`, local dev `4444`); no `make smoke`, no Stripe, no pgvector claim.
- **AC-7** — `apps/web/.playwright/` is ignored and the committed report is untracked.
- **AC-8** — `deploy-api.yml` logs out of GHCR on the self-hosted runner (`if: always()`); `node-exporter` is pinned to a version in both composes; actionlint passes.
- **AC-9** — `scripts/*.mjs` comments and printed steps match the workflows (runner, no SSH, no auto-rollback, arrow-key confirmation, deploy steps `[1/4]…[4/4]` = pre-flight/pull/cutover/verify); no `build:admin`/`Adm`/"boilerplate" leftovers; `monitor-status` skips unconfigured targets instead of probing an empty URL.
- **AC-10** — `README.md`, `apps/api/readme.md`, `apps/web/README.md`, `DEPLOY.md`, `infra/README.md`, `infra/RUNBOOK.md`, `infra/backup/*` describe the real app (7 modules, multi-tenant, Postgres 15, systemd timers, `DAILY_RETENTION_COUNT`, runner + `API_URL` variable, WhatsApp data instead of "patient/clinical") and every `yarn`/`make` command they cite exists.
- **AC-11** — `.claude/commands/devops.md` and `.claude/knowledge/devops.md` describe the real flow (guided `yarn` commands, dispatch-only build, runner cutover, `postgres:15`, single-replica gateway) with a filled runbook + backlog.
- **AC-12** — No API/web runtime change: the only diff under `apps/*/src` is the spec file; `yarn type-check && yarn lint && yarn test` stay green.

## 4. Contracts & interfaces
No HTTP/DB contract changes. New operator file: `infra/deploy.env` (`API_URL`, `WEB_URL`, `SITE_URL`, `APP_HOST`, `DATA_HOST`, `SSH_USER`, `IMAGE`, `GH_REPO`). Repo variable `API_URL` (unchanged).

## 5. Reuse map (DRY first)
| Need | Existing piece | Path | Action |
|---|---|---|---|
| Template ↔ schema gate | `documentedKeys` + two-direction asserts | `apps/api/src/core/config/env-example.spec.ts` | extend to `infra/.env.prod.example` |
| Canonical env list | local template | `apps/api/.env.example` | mirror into the prod template |
| Host path | `APP_DIR=/opt/pombo/app/infra/app` | `Makefile`, `deploy-api.yml` | mirror into `status.sh` |
| Local stack | `docker-compose.local.yml` | root | becomes the only local compose |
| Module/stack facts | patterns docs | `.claude/patterns/backend-modules.md`, `frontend.md` | cite in READMEs |

## 6. Files plan
**Create:** `infra/deploy.env.example`. **Delete:** `docker-compose.yml`; untrack `apps/web/.playwright/report/index.html`.
**Modify:** `.gitignore`, `package.json`, `Makefile`, `docker-compose.smoke.yml`, `apps/api/Dockerfile`, `apps/api/prisma.config.ts`, `apps/api/src/core/config/env-example.spec.ts`, `.github/workflows/{deploy-api,build-api}.yml`, `docker-compose.local.yml`, `infra/{.env.prod.example,README.md,RUNBOOK.md,status.sh,status-app.sh}`, `infra/app/*`, `infra/data/docker-compose.data.yml`, `infra/backup/*`, `scripts/{deploy,rollback,make-tag,monitor-status,gen-web-version}.mjs`, `scripts/lib/deploy-cli.mjs`, `README.md`, `DEPLOY.md`, `apps/api/readme.md`, `apps/web/README.md`, `.claude/commands/devops.md`, `.claude/knowledge/devops.md`.

## 7. Test plan
AC-1 → `env-example.spec.ts` (new `describe.each` over both templates). AC-12 → full `yarn type-check && yarn lint && yarn test`. AC-8 → actionlint. AC-2/3/4 → `make -n` dry runs + `bash -n` on scripts + `node --check` on `.mjs`. AC-5/10 → grep that every cited `yarn <script>` exists and no ref to the removed compose remains.

## 8. Diff budget
~25–30 files, dominated by docs. No new dependencies (Node's built-in `process.loadEnvFile`). No refactor of the deploy flow beyond the listed fixes.

## Baseline rules in scope
- R21: env template mirrors the Zod schema (gate added). R22: placeholders only, no real secret. R26–R28 (always on): spec first, minimal diff, every change traces to an AC.

## Risks & edge cases
- **Architectural:** deleting the default compose breaks a bare `docker compose` in the repo root — scripts always pass `-f`. Same project name → the existing `postgres_data` volume is reused.
- **Operational:** a host already provisioned at `/opt/pombo/repo` would need `DATA_DIR=` — prod is not live yet (knowledge doc), so noted in the RUNBOOK only.
- **Edge cases that bite:** partial doc fix (every cited command is checked); Makefile inline-comment whitespace in vars (keep the `strip`); an exported empty var must not be overridden by the file.

## Decisions log
- 2026-09-16 Process: proceed with this triage spec (no `/architect` escalation) — risk is low, no runtime change.
- 2026-09-16 Compose: delete `docker-compose.yml`, retarget `docker:*` to `docker-compose.local.yml`.
- 2026-09-16 Env gate: extend `env-example.spec.ts` to `infra/.env.prod.example` in this PR.
- 2026-09-16 Deploy config: one `infra/deploy.env` shared by `Makefile` (origin-gated loader) and `deploy-cli` (auto-load; shell env wins).
- 2026-09-16 Host path: standardize on `/opt/pombo/app` (orchestrator decision — prod not live yet).
- 2026-09-16 Implementation findings folded in (same ACs): `docker-compose.caddy.yml` never passed `API_DOMAIN` to Caddy (AC-6 — now required via `${API_DOMAIN:?}`); `make deploy-direct` pulled a private image without a registry login (AC-8 — GHCR login with the operator's `gh` token + logout trap); `infra/data/secrets/` was not gitignored (AC-7 family); `backup-promote.sh` now uses the same dump-name filter as `backup-db.sh`/`backup-check.sh` (AC-10); `deploy-api.yml` passes the token through `env:` instead of inlining it (AC-8); "VPS-APP/VPS-DATA" normalized to "host de APP/DATA" (AC-10); `monitor-status` drops the pgvector probe and shows the gateway block (AC-9).
- 2026-09-16 Deferred (out of the infra sweep — runtime/test code): leftover patient/clinical/"boilerplate"/"single-user" wording inside `apps/api/src`, `apps/web/e2e`, `apps/web/vite.config.ts`, `packages/shared-types` — logged in the knowledge backlog.
- 2026-09-16 Babysit (auditor + reviewer + security: 0 Critical / 0 High) — applied: runner registration token and `app-status` API_URL now travel over stdin (not ssh argv); `deploy-direct` prefers a dedicated `GHCR_TOKEN` (read:packages) over the ambient `gh` token; `infra/deploy.env` values outside `[A-Za-z0-9._:/@-]` are discarded by the Makefile loader; `github.repository_owner` goes through `env:` in both workflows; stale "admin → system-status" dropped from the backup README.
- 2026-09-16 /finish-task: coverage ✓ · spec compliance 12/12 ✓ · contract sync ✓ · final review 0 Critical/High (2 optional Lows left: `process.loadEnvFile` stability note, char filter for `make VAR=` values) · type-check/lint/unit ✓ · e2e skipped (apps/web diff = README + untracked generated report, no code).
