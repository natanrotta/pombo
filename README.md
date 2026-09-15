# Pombo Monorepo

> A production-ready TypeScript monorepo starter: a single-user **auth API** and a **web app** with a sidebar dashboard — wired with Turborepo, Prisma, Docker, and a full Claude Code agent/skill setup.

Everything you need to build and ship — clone it, rename it, start shipping.

---

## What's inside

| App | Path | Stack | Dev port |
|---|---|---|---|
| **API** | `apps/api` | Node.js · Express 4 · Prisma 7 (Postgres) · tsyringe DI · Zod · Vitest | `4444` |
| **Web** | `apps/web` | React 19 · Vite 5 · Chakra UI 3 · TanStack Query 5 · react-i18next · Vitest + Playwright | `4000` |
| **Shared types** | `packages/shared-types` | `@pombo/shared-types` — DTOs shared by API + web | — |

`apps/api` and `apps/web` are Turborepo/yarn workspaces.

## Requirements

- Node `>= 20.19`
- Yarn `1.x` (Classic)
- Docker (for Postgres + Redis)

## Quick start

```bash
yarn install                      # install API + web + shared-types
cp apps/api/.env.example apps/api/.env
# (optional) cp apps/web/.env.example apps/web/.env

yarn services:up                  # Postgres + Redis in Docker
yarn backend:prisma:migrate       # create the database schema
yarn db:seed                      # seed the demo user

yarn dev                          # backend (detached) + web
```

Then open **http://localhost:4000** and sign in with the demo user:

```
email:    demo@example.com
password: Demo1234!
```

## Commands

### Run

| Command | What it does |
|---|---|
| `yarn dev` | Postgres+Redis + API (detached) + web (`:4000`), all with hot reload |
| `yarn backend:up` | Postgres+Redis + API in the **foreground** (you see the API logs) |
| `yarn backend:up-d` | Postgres+Redis + API **detached** (logs → `/tmp/pombo-api.log`) |
| `yarn backend:down` | Stop the API and `docker compose down` |
| `yarn web:up` | Web dev server on `:4000` |
| `yarn services:up` | Postgres + Redis only (Docker) |

### Database (Prisma)

| Command | What it does |
|---|---|
| `yarn backend:prisma:migrate` | `prisma migrate dev` — apply/create migrations |
| `yarn backend:prisma:reset` | Drop, re-migrate and re-seed the database |
| `yarn db:seed` | Seed the demo user |
| `yarn db:studio` | Open Prisma Studio |
| `yarn db:generate` | Regenerate the Prisma client |

### Build / quality

| Command | What it does |
|---|---|
| `yarn build` | Build API + web + shared-types (Turborepo) |
| `yarn test` | Unit tests (API + web, Vitest) |
| `yarn type-check` | `tsc --noEmit` across all packages |
| `yarn lint` | Lint API + web |
| `yarn format` | Prettier write |

### Deploy / ops

`yarn make-tag` · `yarn deploy` · `yarn rollback` · `yarn monitor-status` — the guided release flow (see [`DEPLOY.md`](./DEPLOY.md) and [`infra/`](./infra)).

## Architecture

- **API — module-first Clean Architecture.** `apps/api/src/modules/<domain>/{domain,application,infrastructure}` with a tsyringe DI container in `core/`. Two modules ship: **`auth`** (sign-in/up, tokens, password reset, e-mail verification) and **`user`** (the identity core + user CRUD). Single-user by design — no multi-tenant accounts. Prisma schema has 3 models (`user`, `password_reset_token`, `email_verification_pin`). See [`apps/api/readme.md`](./apps/api/readme.md).
- **Web — feature modules + sidebar shell.** `apps/web/src/modules/{auth,dashboard,settings}` over a shared `AppShell` (sidebar layout), data via TanStack Query + DI repositories, i18n in en/pt-BR/es. See [`apps/web/README.md`](./apps/web/README.md).

## Docker

| File | Purpose |
|---|---|
| `docker-compose.local.yml` | Local `db` + `redis` (+ an optional `api` service) |
| `docker-compose.e2e.yml` | Ephemeral Postgres/Redis for Playwright e2e |
| `docker-compose.smoke.yml` | Boot smoke-test of the production API image |

## Claude Code

The repo ships a complete Claude Code setup under `.claude/` (agents, skills/commands, patterns, hooks) plus a root `CLAUDE.md` task-lifecycle contract. It's generic and grows with use.

## License

MIT.
