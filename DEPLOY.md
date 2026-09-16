# Deploy — Guide

Operate production **from your terminal**, without SSHing into a host. Four guided commands — each one prompts for what it needs (arrow-key selection, default = Cancel on anything that touches production), streams the run live, and verifies `/api/health`:

```bash
yarn make-tag         # build the version vX.Y (tests + boot-smoke → GHCR + git tag)
yarn deploy           # ship a version to production and verify /api/health
yarn rollback         # re-ship a previous version
yarn monitor-status   # health of the services on one screen (Backend · Banco · App · Site)
```

Nothing builds or ships the API on push — cutting and shipping a version is always explicit. Only the static web deploys on its own (CDN / static host, on push to `main`).

## Prerequisites (once)

- `gh auth login` — the commands dispatch the GitHub Actions workflows with your account.
- **Targets:** `cp infra/deploy.env.example infra/deploy.env` and fill `API_URL` (plus `WEB_URL` / `SITE_URL` / `APP_HOST` / `DATA_HOST` / `GH_REPO` for monitoring and the Makefile). The file is gitignored; a variable exported in your shell wins over it. Unset targets make the commands fail fast.
- The **self-hosted runner** on the APP host (`make runner-setup`, see `infra/RUNBOOK.md`) and the repository variable **`API_URL`**. Without the runner, `yarn deploy` ends with "PRODUCTION UNTOUCHED" → fallback `make deploy-direct`.
- Your SSH key on the hosts — for the DB block of `yarn monitor-status` and the Makefile targets.
- Optional: `gh auth refresh -h github.com -s read:packages` — lets your local Docker pull the private image (local boot-smoke in `yarn deploy`). For `make deploy-direct`, prefer exporting `GHCR_TOKEN` (a token with `read:packages` only) — otherwise your `gh` session token is used.
- Run the commands **from inside the repo**.

## How it works

1. **`yarn make-tag`** — shows the live version and the newest tag, asks for the bump (**minor** `v1.4 → v1.5`, **major** `→ v2.0`, or an exact `vX.Y`), runs the backend unit tests locally, then dispatches `build-api.yml`: `[1/5]` validate the version · `[2/5]` type-check + unit tests · `[3/5]` build the image (not pushed) · `[4/5]` **boot-smoke** of that exact image (ephemeral Postgres/Redis + migrate + `/healthz`) · `[5/5]` push `ghcr.io/<owner>/pombo-api:vX.Y` + `:latest` and create the git tag. A failure before `[5/5]` leaves **no image and no tag**.
2. **`yarn deploy`** — shows the live version, **lists the 3 most recent `vX.Y` tags** (or `latest`, or type another), optionally re-runs the boot-smoke locally, asks for confirmation, and dispatches `deploy-api.yml` on the APP host's runner: `[1/4]` pre-flight (tag, `API_URL`, compose file, `.env.prod` readable) · `[2/4]` pull from GHCR · `[3/4]` cutover — `docker compose up -d --wait` until the container is **healthy** (the old one drains its queues on SIGTERM; the new one migrates on boot) · `[4/4]` verify the exact version **from outside** at `/api/health`. Verdict: ✅ confirmed · ❌ failed at `[1/4]`/`[2/4]` = **PRODUCTION UNTOUCHED** · ❌ failed at `[3/4]`/`[4/4]` = production was touched → the command suggests `yarn rollback` (it never reverts on its own).
3. **`yarn rollback`** — lists the most recent tags **other than the live one** and re-ships the chosen image (already in GHCR, no rebuild), through the same workflow and verdict. Migrations are **not** reverted — keep them additive so the previous version still runs on the current schema.
4. **`yarn monitor-status`** — queries the configured targets in parallel and prints a panel (below). Read-only.

## Step-by-step release

1. Merge `develop → main` (the web deploys on its own; the API does **not**).
2. `yarn make-tag` → choose the version → `vX.Y` is published.
3. `yarn deploy` → select `vX.Y` → confirm → watch until ✅.
4. `yarn monitor-status` → the Backend is on the new version and everything is up.

**Rollback:** `yarn rollback` (select a previous version). Old images stay in GHCR → reverting takes seconds.

## `yarn monitor-status` — what it shows

**Backend** and **Banco** are the critical services (exit `1` if either configured one is down; `0` otherwise). A target that is not configured is skipped.

```
📊  Pombo — status de produção

  Backend   api.your-domain.tld/api/health
  ● ONLINE   HTTP 200 · 131ms
     versão      v1.12 · última publicada
     estável     sim
     uptime      5h 38m
     gateway     14/15 dispositivos conectados
     migrations  ✓ em dia · 0 pendentes

  Banco     host de DATA 203.0.113.20 · via SSH
  ● NO AR
     status      aceitando conexões
     migração    20260718005559_first  1 aplicadas · 0 pendentes
     versão      PostgreSQL 15.8

  App       app.your-domain.tld
  ● ONLINE   HTTP 200 · 113ms
     versão      ddcbe65 · main · há 21min

  Site      your-domain.tld
  ● ONLINE   HTTP 200 · 106ms
     versão      — (site não publica version.json)

  ✨ tudo no ar · 4/4 · 1.1s
```

**Where each field comes from:**

- **Backend** — `GET /api/health` (public): `version`, `ok`, `uptimeSeconds`, `gateway.devices` (absent when `WHATSAPP_ENABLED=false`), and the drift against the newest local git tag. `migrations` comes from the Banco block; without SSH it is inferred from a healthy boot.
- **Banco** — **SSH into `DATA_HOST`** (same path as `make db-status`, no token): `pg_isready`, `_prisma_migrations` (latest + applied/pending), Postgres version. `/api/health` deliberately omits DB internals (fingerprinting). Without SSH the block degrades to "NO AR (inferido)".
- **App** — `GET WEB_URL/version.json` (written by `yarn build:web`): commit + branch + build time.
- **Site** — `GET SITE_URL/` — status only.

## Versioning

The version is a git tag **`vMAJOR.MINOR`** (e.g. `v1.5`), stamped into the image (`APP_VERSION`, plus `GIT_COMMIT`) and exposed at `/api/health`. `yarn make-tag` validates the format, refuses an existing tag, and warns when a build is already running.

## Advanced infra (Makefile)

The Makefile is the rare layer underneath — it reads the same `infra/deploy.env` (`make VAR=…` overrides it). `make help` lists everything.

```bash
make deploy-direct TAG=vX.Y   # fallback: same cutover over SSH from your machine (no Actions/runner)
make runner-setup             # register the self-hosted deploy runner on the APP host (once)
make app-status / db-status   # DEEP host status (containers, version, gateway, tunnel, disk, backup)
make logs / logs-caddy        # tail the logs (Ctrl-C to exit)
make ssh-app / ssh-data       # SSH into the hosts
```

## Special cases

- **Migrations:** run on boot by the image entrypoint (`prisma migrate deploy`) — don't run them by hand; `yarn monitor-status` shows applied/pending. That is correct with the **single** production replica. A second replica needs `RUN_MIGRATIONS=false` **and** `WHATSAPP_ENABLED=false` (only one process may own the WhatsApp sockets — an advisory lock enforces it).
- **`.env.prod`:** lives on the APP host (`/opt/pombo/app/infra/.env.prod`, template `infra/.env.prod.example`), outside the image. Edit it there, then `make deploy-direct TAG=<live version>` (or `docker compose up -d` on the host) so the container re-reads it. `APP_VERSION`/`GIT_COMMIT` stay commented (an `env_file` value would mask the stamped version). The runner must be able to **read** the file — the pre-flight aborts with "PRODUCTION UNTOUCHED" otherwise.
- **Web:** automatic on push to `main` (static host). Its `VITE_*` variables are configured on the static host, not in `infra/`.

## Database backup

An encrypted dump (`age`) to offsite object storage twice a day, keeping the most recent dumps + GFS weekly/monthly, fully automated (systemd timers).

```bash
make backup-now       # run a dump now + log
make backup-check     # verify retention
make backup-status    # timers + count/latest dumps offsite
make restore-drill AGE_KEY=/path/backup-age.key   # restore rehearsal (does not touch prod)
```

Activation (once — secrets + `make backup-setup`): **`infra/RUNBOOK.md`** · detail: `infra/backup/README.md`.

---

Architecture + runbook + backlog: **`.claude/knowledge/devops.md`** · infra artifacts: **`infra/`** (`infra/README.md`) · operations: `make help`.
