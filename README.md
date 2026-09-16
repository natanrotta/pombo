# Pombo

> A multi-tenant **WhatsApp gateway**: accounts connect their WhatsApp numbers (devices), send messages through a dashboard or a token-authenticated public API, and receive delivery events on HMAC-signed webhooks. TypeScript monorepo — Turborepo, Prisma, Docker, and a full Claude Code agent/skill setup.

---

## What's inside

| App | Path | Stack | Dev port |
|---|---|---|---|
| **API** | `apps/api` | Node.js · Express 4 · Prisma 7 (Postgres 15) · Redis/BullMQ · Baileys · tsyringe DI · Zod · Vitest | `4444` |
| **Web** | `apps/web` | React 19 · Vite 5 · Chakra UI 3 · TanStack Query 5 · react-i18next · Vitest + Playwright | `4000` |
| **Theme** | `packages/theme` | `@pombo/theme` — the design system (Chakra v3 tokens, semantic tokens, text styles, recipes), consumed as source | — |
| **Shared types** | `packages/shared-types` | `@pombo/shared-types` — the wire contract (DTOs, status unions, `ErrorCodes`, envelope) shared by API + web | — |

All three are yarn/Turborepo workspaces.

## Requirements

- Node `>= 20.19` (CI and the image use Node 22)
- Yarn `1.x` (Classic)
- Docker (local Postgres + Redis)

## Quick start

```bash
yarn install                      # API + web + shared-types
cp apps/api/.env.example apps/api/.env
# (optional) cp apps/web/.env.example apps/web/.env

yarn db:migrate                   # starts Postgres + Redis, applies the migrations
yarn db:seed                      # seeds the demo user

yarn dev                          # API (detached, :4444) + web (:4000)
```

Open **http://localhost:4000** and sign in with `demo@example.com` / `Demo1234!`.

The WhatsApp gateway is **off** locally (`WHATSAPP_ENABLED=false` in `.env.example`): every endpoint answers, and connecting a device returns `WA_GATEWAY_DISABLED`. Set it to `true` in `apps/api/.env` to pair a real number.

## Commands

### Run

| Command | What it does |
|---|---|
| `yarn dev` | Postgres + Redis + API (detached) + web, all with hot reload |
| `yarn backend:up` | Postgres + Redis + API in the **foreground** (you see the API logs) |
| `yarn backend:up-d` | Same, **detached** (logs → `/tmp/pombo-api.log`) |
| `yarn backend:down` | Stop the API + web dev servers and the Docker services |
| `yarn web:up` | Web dev server on `:4000` |
| `yarn services:up` / `yarn services:down` | Postgres + Redis only (`docker-compose.local.yml`) |
| `yarn docker:reset` | Stop the services **and drop their volumes** (fresh database) |
| `yarn drop:all` | Stop and remove **every** Docker container on the machine (network-error escape hatch) |

> The API runs against the **built** `packages/shared-types/dist`; the web reads the package source directly. The root scripts above rebuild it for you — if you start the API any other way (e.g. `yarn workspace @pombo/api dev`), run `yarn shared:build` after editing the package.

### Database (Prisma)

| Command | What it does |
|---|---|
| `yarn db:migrate` | `prisma migrate dev` — apply/create migrations |
| `yarn db:deploy` | `prisma migrate deploy` — apply pending migrations only |
| `yarn db:reset` | Drop and re-apply every migration |
| `yarn db:seed` · `yarn db:reset-seed` | Seed the demo user (after a reset) |
| `yarn db:studio` | Open Prisma Studio |
| `yarn db:generate` | Regenerate the Prisma client |

(`yarn prisma:*` are the same commands under their original names.)

### Build / quality

| Command | What it does |
|---|---|
| `yarn build` | Build API + web + shared-types (Turborepo) |
| `yarn build:web` | Web production build + `dist/version.json` |
| `yarn type-check` · `yarn lint` · `yarn test` | The CI gate (`.github/workflows/ci.yml`) |
| `yarn workspace @pombo/web test:e2e` | Playwright against an ephemeral stack |
| `yarn format` | Prettier write |

### Deploy / ops

`yarn make-tag` · `yarn deploy` · `yarn rollback` · `yarn monitor-status` — the guided release flow. Targets live in `infra/deploy.env` (copy `infra/deploy.env.example`). See [`DEPLOY.md`](./DEPLOY.md) and [`infra/`](./infra).

## Architecture

- **API — module-first Clean Architecture** ([`apps/api/readme.md`](./apps/api/readme.md), [`.claude/patterns/backend-modules.md`](./.claude/patterns/backend-modules.md)). Seven domains under `apps/api/src/modules`: `account`, `auth`, `user`, `devices`, `messaging`, `webhooks`, `public-api`; the chassis (config, DI, HTTP, providers, WhatsApp gateway boot) lives in `core/`. Every read is scoped by `account_id`. The gateway runs as **one replica** that owns the WhatsApp sockets (Postgres advisory lock).
- **Web — feature modules + sidebar shell** ([`apps/web/README.md`](./apps/web/README.md)). `apps/web/src/modules/{auth,devices,messaging,account,settings}` over a shared `AppShell`, data via DI repositories + TanStack Query, i18n in en/pt-BR/es.
- **Production** — static web behind a CDN; the API and its data on two hosts joined by a WireGuard tunnel; Caddy + origin certificate at the edge; encrypted offsite backups. Source of truth: [`.claude/knowledge/devops.md`](./.claude/knowledge/devops.md).

## Docker / infra files

| File | Purpose |
|---|---|
| `docker-compose.local.yml` | The local stack: `db` + `redis` (+ an optional containerised `api`) |
| `docker-compose.e2e.yml` | Ephemeral Postgres/Redis for Playwright e2e |
| `docker-compose.smoke.yml` | Boot smoke-test of the production API image |
| `apps/api/Dockerfile` | The API image (`runtime` = production, `dev` = local compose) |
| `infra/` | Production composes, Caddy, WireGuard, backup, host status scripts |

## Claude Code

The repo ships a complete Claude Code setup under `.claude/` (agents, skills/commands, patterns, hooks, specs) plus a root `CLAUDE.md` task-lifecycle contract.

## License

MIT.
