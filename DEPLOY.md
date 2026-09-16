# Deploy — Guide

Operate production **from your terminal**, without SSHing into the host. Four guided commands — each one prompts for what it needs (arrow-key selection), streams the run live, and verifies `/api/health`:

```bash
yarn make-tag         # build the version vX.Y (tests + boot-smoke → image registry + git tag)
yarn deploy           # ship a version to production and verify /api/health
yarn rollback         # revert to a previous version
yarn monitor-status   # health of the services on one screen (API · DB · Web · Site)
```

Nothing builds or ships on push on its own — only the static frontends deploy automatically (via your static host / CDN). Cutting a version is always explicit.

## Prerequisites (once)

- `gh auth login` — the deploy runs via GitHub Actions with your account (if you use the Actions path).
- Run the commands **from inside the repo**.
- A deploy runner on the app host (or SSH access for the direct fallback). Without it, `yarn deploy` aborts with "PRODUCTION UNTOUCHED" → use the fallback `make deploy-direct`.
- For the **DB** block of `yarn monitor-status` and the host targets (`make logs`, `make db-status`…): your SSH key on the hosts.

## How it works

1. **`yarn make-tag`** — asks for the version bump (**minor** `v1.4 → v1.5`, **major** `→ v2.0`, or **exact**), runs the backend unit tests and the **boot-smoke** (boots the real image + ephemeral Postgres/Redis + migrate + `/healthz`), and only then publishes `<registry>…:vX.Y` + `:latest` and creates the git tag. If a test fails, **there is no image and no tag** — nothing to deploy.
2. **`yarn deploy`** — shows the live version and **lists the 3 most recent `vX.Y` versions to pick from** (arrows + Enter; you can also choose `latest` or type another), asks for a typed confirmation, and triggers the deploy: **cutover on the host** → `docker compose pull && up -d --wait` (waits until the container is _healthy_ — a crash-loop fails here) → **verifies from outside** at `/api/health`. Honest verdict: ✅ confirmed · ❌ failed **before** touching the container = **production untouched** (nothing to revert) · ❌ touched production and didn't confirm = **suggests a rollback** (never reverts on its own).
3. **`yarn rollback`** — **lists the 3 most recent `vX.Y` versions (below the live one) to pick from** and re-ships the chosen image (already in the registry, no rebuild). Same verification and verdict as deploy.
4. **`yarn monitor-status`** — queries the services in parallel and prints a panel (details below). Read-only, triggers nothing.

## Step-by-step release

1. Merge `develop → main` + push (the static frontends deploy on their own; the API does **not**).
2. `yarn make-tag` → choose the version → publishes `vX.Y` to the registry.
3. `yarn deploy` → select the version from the list → confirm → watch until ✅.
4. `yarn monitor-status` → confirm the **API** is on the new version and **everything is up**.

**Rollback:** `yarn rollback` (select a previous version). Old images stay in the registry → reverting takes seconds, no rebuild.

## `yarn monitor-status` — what it shows

One screen with the services. **API** and **DB** are the **critical** ones (the command exits `1` if either is down; `0` otherwise):

```
 Pombo — production status

  API       <api-host>/api/health
  ● ONLINE   HTTP 200 · 131ms
     version     v1.12 · latest published
     stable      yes
     uptime      5h 38m
     migrations  ✓ up to date · 0 pending

  DB        <data-host> · via SSH
  ● UP
     status      accepting connections
     migration   20260711134904_first  1 applied · 0 pending
     version     PostgreSQL 16

  Web       <web-host>
  ● ONLINE   HTTP 200 · 113ms
     version     ddcbe65 · main · 21m ago

  Site      <site-host>
  ● ONLINE   HTTP 200 · 106ms
     version     — (site publishes no version.json)

  ✨ all up · 4/4 · 1.1s
```

**Where each field comes from:**

- **API** — `GET /api/health` (public): `version`, `stable` (ok), `uptime`, and the drift (`latest published` vs. `outdated`) comparing against the newest git tag. `migrations` comes from the DB block (SSH); without SSH it is inferred from a healthy boot.
- **DB** — **SSH into the data host** (same path as `make db-status`, no token): `status` (`pg_isready`), `migration` (latest + applied/pending from `_prisma_migrations`), Postgres `version`. `/api/health` **deliberately omits** the DB internals (that would be a fingerprint), hence the SSH. Without an SSH key, the block degrades to "UP (inferred)" from `/api/health`.
- **Web** — `GET /version.json` (generated in the frontend build): commit + branch + build time. `status` = HTTP 200.
- **Site** — just `GET /` (publishes no `version.json`): `status` = HTTP 200.

Overrides via env (staging / renaming): `API_URL`, `WEB_URL`, `SITE_URL`, `DATA_HOST`, `SSH_USER`.

## Versioning

The version is a git tag **`vMAJOR.MINOR`** (e.g. `v1.5`), stamped into the image and exposed at `/api/health`. `yarn make-tag` validates the format and **refuses a tag that already exists**. There is no automatic build on push — cutting a version is always explicit.

## Advanced infra (Makefile)

The normal flow is the four yarn commands above. The **Makefile** is the rare layer underneath: the deploy fallback, runner setup, deep SSH/logs/status of the hosts, and backup. `make help` lists everything.

```bash
make deploy-direct TAG=vX.Y   # fallback: cutover via SSH from your machine (no Actions/runner)
make runner-setup             # register the self-hosted deploy runner on the app host (once)
make app-status / db-status   # DEEP host status (containers, tunnel, disk, backup, redis)
make logs / logs-caddy        # tail the logs (Ctrl-C to exit)
make ssh-app / ssh-data       # SSH into the hosts
make help                     # list all targets
```

## Special cases

- **Migrations:** run on boot by the image entrypoint (`prisma migrate deploy`). Don't run them by hand. (`yarn monitor-status` shows applied/pending.) With one replica that is the whole story; on extra replicas set `RUN_MIGRATIONS=false` in `.env.prod` and run the migration once as a deploy step.
- **`.env.prod`:** lives on the host, outside the image. Edit it there + `make deploy-direct` (or `up -d`) for the container to re-read. `APP_VERSION` stays commented (otherwise the `env_file` masks the real version). The deploy runner must be able to **read** that file — the deploy pre-flight aborts with "PRODUCTION UNTOUCHED" if it can't (never boots a container without env).
- **Frontends:** automatic on push to `main` (static host / CDN).

## Database backup

An encrypted dump (`age`) to offsite object storage, keeping the most recent dumps + GFS retention, fully automated (systemd).

```bash
make backup-now       # run a dump now + log
make backup-check     # verify retention
make backup-status    # timers + count/latest dumps offsite
make restore-drill AGE_KEY=/path/backup-age.key   # restore rehearsal (does not touch prod)
```

Activation (once — secrets + `make backup-setup`): **`infra/RUNBOOK.md`** · detail: `infra/backup/README.md`.

---

Architecture + full runbook (topology, provisioning, backup, CI/CD): **`.claude/knowledge/devops.md`** ·
infra artifacts (composes, Caddyfile, tunnel config, backup): **`infra/`** (`infra/README.md`) · operations: `make help`.
