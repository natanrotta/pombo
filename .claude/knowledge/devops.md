# DevOps / Infra — Accumulated Knowledge (single source)

> Living notes for the `/devops` skill: the real deploy topology, runbook, and backlog **as you build it**.
> The boilerplate ships a representative `infra/` skeleton; replace the specifics below with your actual
> provider, hosts, and domains as production takes shape. Command cheat-sheet: `DEPLOY.md`. Ops: `Makefile`.

## Architecture (reference — adapt to your provider)
- Static frontends behind a CDN + an API and its data stores on isolated hosts joined by a private network / tunnel.
- A proxy/CDN at the edge hides the origin IP (origin cert) and terminates TLS.
- The database host never exposes `5432`/`6379` to the internet — app↔DB only over the private network.
- Backup is 3-2-1: encrypted daily dump, offsite, with a dead-man switch — and only "real" after a tested restore drill.

## Golden rules
1. Database first when provisioning (with backup on day one), then app host, then frontends, then validation.
2. Secrets live in `.env` (`chmod 600`) / Docker secrets on the server — never in the image (except the stamped `APP_VERSION`), never in logs/commits/front.
3. Health: `/healthz` (text `ok`) + `/api/health` (JSON with `version`).

## CI/CD (reference)
- Workflows: `ci.yml` (type-check · lint · unit tests on every PR / push to develop+main — nothing ships), `build-api.yml` (dispatched by `yarn make-tag`: tests → docker build → boot smoke of the exact image → push `:vX.Y` + `:latest` → git tag), `deploy-api.yml` (dispatched by `yarn deploy` / `yarn rollback` on the self-hosted `pombo-app` runner: pre-flight → pull → `compose up --wait` → `/api/health` version check; "PRODUCTION UNTOUCHED" whenever it fails before the cutover).
- ONE `apps/api/Dockerfile` (stages `base → deps → build / prod-deps → runtime`, plus `dev` for docker-compose.local.yml). Runtime is non-root (`node`), prod deps only, `dist/` without test code, node as PID 1 via `docker-entrypoint.sh` (`exec node`) so SIGTERM reaches the graceful shutdown; `RUN_MIGRATIONS=false` skips migrate-on-boot for extra replicas. The root `.dockerignore` keeps `.env*`, `apps/web`, `.git` and `node_modules` out of the context.
- `yarn make-tag` builds + stamps a versioned image and creates the git tag.
- `yarn deploy` / `yarn rollback` pull a tag on the host and verify the version via `/api/health`.
- `yarn monitor-status` shows service health.

## Runbook — when to run what
- (fill in as your deploy matures)

## Gaps / backlog
- (none yet)
