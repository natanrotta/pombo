# infra/ — production artifacts (operational cheat-sheet)

Architecture, runbook and backlog: [`.claude/knowledge/devops.md`](../.claude/knowledge/devops.md) (single source).
Deploy guide: [`DEPLOY.md`](../DEPLOY.md). One-time activation: [`RUNBOOK.md`](./RUNBOOK.md). Operations: [`Makefile`](../Makefile) (`make help`).

> **Golden rule:** the DATA host never exposes `5432`/`6379`/`9100` to the internet — APP↔DATA only through the
> WireGuard tunnel. **A backup only "exists" after a tested restore-drill.**

Both hosts keep a checkout of this repo at **`/opt/pombo/app`** (the paths below are relative to it).

```
infra/
  deploy.env.example               YOUR machine: deploy targets for yarn + make (copy to deploy.env — gitignored)
  .env.prod.example                APP host: the API production env (copy to .env.prod — gitignored; drift-gated by a spec)
  app/docker-compose.prod.yml      APP host: API container (single replica, 127.0.0.1:3333) + node-exporter (10.8.0.1:9100)
  app/docker-compose.caddy.yml     APP host: Caddy (80/443, host network) — needs API_DOMAIN
  app/Caddyfile                    <API_DOMAIN> → localhost:3333 (origin cert · body untouched · no buffering)
  app/setup-github-runner.sh       APP host: self-hosted deploy runner (`make runner-setup`)
  data/docker-compose.data.yml     DATA host: Postgres 15 + Redis (AOF) + node-exporter, bound to 10.8.0.2
  data/secrets/db_password.txt     DATA host: create it there (gitignored); REDIS_PASSWORD goes in data/.env
  wireguard/wg0.{app,data}.conf.example   tunnel — APP side (10.8.0.1) / DATA side (10.8.0.2)
  backup/                          encrypted dump → R2, GFS promotion, retention check, restore drill, installer
  status-app.sh                    APP host status (containers/image/version/gateway/tunnel/disk) — `make app-status`
  status.sh                        DATA host status (Postgres/Redis/tunnel/disk/backup) — `make db-status`
```

---

## Day-to-day operations

```bash
yarn make-tag          # build vX.Y (tests + boot-smoke → GHCR + git tag; nothing builds on push)
yarn deploy            # ship a version (pick among the 3 most recent / latest) and verify
yarn rollback          # re-ship a previous version (images stay in GHCR, no rebuild)
yarn monitor-status    # Backend · Banco · App · Site on one screen

make app-status        # APP host deep status
make db-status         # DATA host deep status
make logs              # tail the API logs
make ssh-app / ssh-data
make deploy-direct TAG=vX.Y   # fallback: cutover via SSH (no Actions/runner)
```

Quick check without tooling: `curl -s https://<api-host>/healthz` (→ `ok`) ·
`curl -s https://<api-host>/api/health` (→ `{ ok, version, uptimeSeconds, gateway? }`).

## Ports and processes

| What | Where | Port |
|---|---|---|
| API container | APP host | `127.0.0.1:3333` (`API_PORT`) — only Caddy reaches it |
| Caddy | APP host | `80`/`443` (behind the Cloudflare proxy) |
| Postgres / Redis | DATA host | `10.8.0.2:5432` / `10.8.0.2:6379` (tunnel only) |
| node-exporter | both | `10.8.0.1:9100` / `10.8.0.2:9100` (tunnel only) |
| WireGuard | both | `51820/udp` |

The API is **one process** (HTTP + BullMQ workers + cron + the WhatsApp gateway). It runs as a **single replica**: it owns the WhatsApp sockets (`WHATSAPP_ENABLED=true`, guarded by a Postgres advisory lock) and migrates on boot. Local dev uses `:4444` instead (`apps/api/.env`).

## Provision from scratch

Order — database first: **A)** DATA host (tunnel, `data/` compose, backup on day one) → **B)** APP host (tunnel, `.env.prod`, Caddy, runner, first `yarn deploy`) → **C)** static web → **D)** validation (`yarn monitor-status`, restore drill). Condensed steps in `.claude/knowledge/devops.md` › "Provision from scratch"; secret/registration setup in [`RUNBOOK.md`](./RUNBOOK.md).

## TLS + edge

Cloudflare proxies the API hostname; the origin uses a **Cloudflare Origin Certificate** with SSL "Full (strict)". The two files live at `/etc/caddy/certs/origin.{crt,key}` (chmod 600 on the key) and are mounted into Caddy. Alternatives (not used): DNS-01 with the Caddy Cloudflare plugin, or a plain Let's Encrypt cert on a public origin.

The API trusts **one** proxy hop for the client IP (rate limits): Caddy rewrites `X-Forwarded-For` to `CF-Connecting-IP`, which is only trustworthy while `80`/`443` accept Cloudflare's IP ranges alone — see the backlog.

## Backup — `/etc/pombo/backup.env` (DATA host)

```sh
AGE_RECIPIENT=age1xxxxxxxx           # PUBLIC age key (the PRIVATE one stays offsite)
RCLONE_REMOTE=r2
RCLONE_BUCKET=pombo-backups
HC_PING_URL=https://hc-ping.com/<uuid>
# optional: PG_CONTAINER, PG_USER, PG_DB, DAILY_RETENTION_COUNT (default 5), TMP_DIR
```

`make backup-setup` installs systemd timers: `pombo-backup.timer` (03:30 and 15:30) and `pombo-backup-promote@{weekly,monthly}.timer` (Sunday 04:00 · day 1 05:00). Details: [`backup/README.md`](./backup/README.md). ⚠️ **Enable and drill this before storing real customer data.**

## Monitoring

- `yarn monitor-status` (API version/gateway, DB, web) · `/healthz` for an external uptime monitor.
- node-exporter on both hosts (tunnel-bound), read by the API via `METRICS_APP_URL` / `METRICS_DATA_URL`.
- Backups: dead-man switch (healthchecks.io) · errors: Bugsnag (`BUGSNAG_API_KEY`) + `pino` logs (`make logs`).
- Disk on both hosts: the status scripts flag ≥ 80%.

## Media in S3 (outside the pg_dump scope)

Uploaded files live in `AWS_S3_BUCKET`, **not** in the database backup. Enable **versioning + lifecycle** on the bucket.

## Operator decisions / secrets

- **Production branch:** `main` — `yarn make-tag` / `yarn deploy` dispatch the workflows on it (`DEPLOY_REF` overrides).
- **GitHub:** the repository **variable** `API_URL` (external verification). No secret beyond the automatic `GITHUB_TOKEN` (GHCR push in `build-api.yml`, pull in `deploy-api.yml` — logged out at the end of every job).
- **Host secrets:** `infra/.env.prod` (APP), `infra/data/secrets/` + `infra/data/.env` (DATA), `/etc/pombo/backup.env` (DATA), `/etc/caddy/certs/` (APP). None of them is ever committed.
- **PITR (tier 2):** deferred — enable when the data justifies it.
