# DevOps / Infra — Accumulated Knowledge (single source)

> Living notes for the `/devops` skill: the deploy topology, runbook and backlog. Command cheat-sheet:
> `DEPLOY.md`. Artifacts: `infra/` (`infra/README.md`). One-time activation: `infra/RUNBOOK.md`. Ops: `Makefile`.
> **Status (2026-09-16):** the skeleton is complete and consistent with the app; production is **not live yet** —
> when it goes up, record the real provider, hosts and domains in "Live environment" below.

## Live environment
- (not provisioned yet — provider · APP/DATA host IPs · API/web domains · R2 bucket · healthchecks check)

## Architecture
- **Web:** static build (`yarn build:web` → `apps/web/dist` + `version.json`) on a CDN / static host (Cloudflare Pages), deployed on push to `main`.
- **APP host (public):** Caddy (80/443, host network, Cloudflare Origin Certificate, "Full (strict)") → API container on `127.0.0.1:3333` + node-exporter on `10.8.0.1:9100`. Compose: `infra/app/`.
- **DATA host (never public):** Postgres 15 + Redis 7 (AOF, password) + node-exporter, all bound to the WireGuard IP `10.8.0.2`. Compose: `infra/data/`.
- **Tunnel:** WireGuard `10.8.0.0/24` (APP `.1`, DATA `.2`), `51820/udp`.
- **Both hosts** keep the repo checkout at `/opt/pombo/app` (every script default, the workflow and the Makefile assume it).
- **The API is one process** — HTTP + BullMQ workers + cron + the WhatsApp gateway — and runs as **ONE replica**:
  - it owns the WhatsApp sockets (`WHATSAPP_ENABLED=true`); a Postgres **advisory lock** makes a second owner impossible (it exits on lock loss);
  - it runs `prisma migrate deploy` on boot (`apps/api/docker-entrypoint.sh`);
  - scaling out = extra replicas with `WHATSAPP_ENABLED=false` + `RUN_MIGRATIONS=false`, migrations as a deploy step, and cron/queue duplication reviewed first.
- **Graceful shutdown:** SIGTERM → drain HTTP, close sockets **without** logout, close queues. App ceiling `SHUTDOWN_TIMEOUT_MS` (≤ 60 000, schema-enforced) < compose `stop_grace_period: 60s`.

## Verified in code (re-check when touching)
- Health: `GET /healthz` → `ok` (no DB, the container HEALTHCHECK) · `GET /api/health` → `{ ok, version, uptimeSeconds, gateway?: { devices: { total, connected } } }`. A disconnected device never flips health (no restart storm).
- Version: `APP_VERSION` (+ `GIT_COMMIT`) stamped by `build-api.yml`; must stay **commented** in `.env.prod`.
- Env contract: `apps/api/src/core/config/schema/` (Zod, exits 1 on boot). `env-example.spec.ts` gates BOTH `apps/api/.env.example` and `infra/.env.prod.example` in both directions (`RUN_MIGRATIONS` is the only container-only key) and pins `NODE_ENV=production` + `WHATSAPP_ENABLED=true` in the prod template.
- Ports: container `API_PORT` default `3333`; local dev `4444` (web `4000`); e2e API `3334` / web `3001` / Postgres `5433` / Redis `6380`; local Postgres `5442` / Redis `6389`.
- Proxy: `app.set("trust proxy", 1)`; Caddy sets `X-Forwarded-For` = `CF-Connecting-IP`.
- Bodies: `express.json({ limit: "10kb" })`; no inbound webhook verifies a raw body today; no SSE endpoint today (the Caddy `flush_interval -1` is future-proofing).
- Outbound webhooks are customer URLs (HMAC-signed) → an SSRF surface owned by `/security`.

## CI/CD
- `ci.yml` — every PR + push to `develop`/`main`: type-check · lint · unit tests · actionlint. Ships nothing.
- `build-api.yml` — dispatched by `yarn make-tag` only: `[1/5]` validate `vX.Y` (refuse existing tag) · `[2/5]` API type-check + tests · `[3/5]` `docker buildx --load` (target `runtime`) · `[4/5]` boot-smoke of that exact image (`docker-compose.smoke.yml`) · `[5/5]` push `ghcr.io/<owner>/pombo-api:vX.Y` + `:latest`, git tag.
- `deploy-api.yml` — dispatched by `yarn deploy` / `yarn rollback`, runs on the self-hosted runner `[self-hosted, pombo-app]` on the APP host: `[1/4]` pre-flight · `[2/4]` GHCR login + pull · `[3/4]` `compose up -d --wait` · `[4/4]` external `/api/health` version check · always: GHCR logout + image prune. Needs the repo **variable** `API_URL`. Fails before `[3/4]` = "PRODUCTION UNTOUCHED". Never auto-reverts.
- Fallback without runner: `make deploy-direct TAG=…` (SSH; GHCR login over stdin with `GHCR_TOKEN` — a `read:packages`-only token — or the operator's `gh` token; logout on exit). The Makefile only accepts `[A-Za-z0-9._:/@-]` values from `infra/deploy.env` (they end up in shell/ssh commands); secrets never travel in ssh argv.
- ONE `apps/api/Dockerfile`: `base → deps → build / prod-deps → runtime` (+ `dev` for `docker-compose.local.yml`). Runtime: non-root `node`, prod deps only, `dist/` without tests, `exec node` as PID 1. The root `.dockerignore` keeps `.env*`, `apps/web`, `infra`, `.git`, `node_modules` out of the context.

## Operator configuration
- **Your machine:** `infra/deploy.env` (gitignored; template `infra/deploy.env.example`) — `API_URL`, `WEB_URL`, `SITE_URL`, `APP_HOST`, `DATA_HOST`, `SSH_USER`, `GH_REPO`, `IMAGE`. Read by `scripts/lib/deploy-cli.mjs` (`process.loadEnvFile`) and by the `Makefile`; shell env / `make VAR=` win.
- **APP host:** `infra/.env.prod` (640, group `ghrunner`) · `infra/app/.env` with `API_DOMAIN` · `/etc/caddy/certs/origin.{crt,key}`.
- **DATA host:** `infra/data/secrets/db_password.txt` · `infra/data/.env` (`REDIS_PASSWORD`) · `/etc/pombo/backup.env` · rclone config (root, `no_check_bucket = true`).
- **Local dev:** one compose — `docker-compose.local.yml` (`yarn services:up|down`, `yarn docker:reset`).

## Provision from scratch
- **A) DATA host:** Docker + WireGuard (`infra/wireguard/wg0.data.conf.example`, ufw: only 51820/udp + SSH from your IP) → checkout at `/opt/pombo/app` → secrets → `docker compose -f infra/data/docker-compose.data.yml up -d` → backup (`infra/RUNBOOK.md` › B) **before any real data** → `make db-status`.
- **B) APP host:** Docker + WireGuard (APP side, ufw 80/443 + 51820/udp + SSH from your IP) → checkout → `.env.prod` from the template → `make runner-setup` → Caddy (`API_DOMAIN`, origin cert) → `yarn make-tag` + `yarn deploy` → `make app-status`.
- **C) Web:** static host project on `main` — build `yarn build:web`, output `apps/web/dist`, `VITE_*` vars, custom domain.
- **D) Validation:** `yarn monitor-status` all green · `make restore-drill` passes · the public origin refuses direct DB/Redis/9100 (`nc -vz`).

## Runbook — when to run what
- **New env var:** add it to the schema + `apps/api/.env.example` + `infra/.env.prod.example` (the spec fails otherwise) → set it in the host's `.env.prod` → redeploy (`make deploy-direct TAG=<live>` re-reads the env).
- **New migration:** ship it in a release — the container applies it on boot. Keep it additive: `yarn rollback` does not revert schema.
- **Release:** merge `develop → main` → `yarn make-tag` → `yarn deploy` → `yarn monitor-status`.
- **Deploy failed, "PRODUCTION UNTOUCHED":** runner offline or `.env.prod` unreadable → `make runner-setup` or `make deploy-direct`.
- **Deploy failed after the cutover:** read the pulled logs → `yarn rollback` to the suggested version.
- **Recreated `.env.prod`:** re-run `make runner-setup` (the group grant is lost).
- **Quarterly:** `make restore-drill AGE_KEY=…`.

## Gaps / backlog
- Origin firewall: accept 80/443 only from Cloudflare IP ranges (or Authenticated Origin Pulls) — until then `CF-Connecting-IP` can be spoofed by a direct hit, weakening IP rate limits. **Gate before real traffic.**
- External uptime monitor on `/healthz` — **gate before real traffic.**
- Runner in the `docker` group = root-equivalent on the APP host (accepted risk) → rootless Docker or a socket proxy.
- PITR / pgBackRest (tier 2) when the data justifies it; S3 bucket versioning + lifecycle for media.
- A CI workflow for the static web deploy (today: the static host's Git integration).
- Caddy access log is written inside the container (`/var/log/caddy`, no volume) — mount it or log to stdout.
- `restore-drill.sh` leaves the downloaded dump / test container behind when it fails midway (no `trap`).
- `yarn drop:all` removes every Docker container on the machine, not only Pombo's.
- `caddy:2-alpine` and the Postgres/Redis images float on their major tags (node-exporter is pinned).
- Leftover terms from another project (patient/clinical/PHI) remain inside `apps/api/src` (error-reporter redaction keys, logger comments, some specs) — runtime code, out of the infra sweep.
