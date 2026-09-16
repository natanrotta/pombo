# @pombo/api

REST API of the Pombo **multi-tenant WhatsApp gateway** — Clean Architecture on a module-first codebase.

**Stack:** Node.js · Express 4 · TypeScript · Prisma 7 (PostgreSQL 15) · Redis (BullMQ queues, caches, rate limits) · Baileys (WhatsApp) · tsyringe (DI) · Zod · pino · Vitest.

---

## Architecture

Module-first: each domain owns its full vertical slice; the composition root wires everything with dependency injection. Where a file goes is defined by [`.claude/patterns/backend-modules.md`](../../.claude/patterns/backend-modules.md); how it is written, by [`.claude/patterns/backend.md`](../../.claude/patterns/backend.md).

```
apps/api/
├── prisma/                     # schema.prisma · migrations · seed.ts
└── src/
    ├── main.ts                 # boot: error reporter → shutdown plan → WhatsApp gateway (flag) → listen
    ├── modules/<domain>/       # domain/ · application/ · infrastructure/ (+ co-located specs, test/ factories)
    ├── core/
    │   ├── config/             # env.ts + schema/ — Zod-validated environment (exits 1 on boot if invalid)
    │   ├── container/          # tsyringe DI container + DI_TOKENS
    │   ├── database/           # Prisma client, error mapper, DB status
    │   ├── http/               # Express app, routes, middlewares, logger
    │   ├── provider/           # cache, ci, event buses, hash, jwt, logger, mail, metrics, queue, storage
    │   └── service/            # error-reporter, lifecycle (graceful shutdown), scheduler, whatsapp (gateway boot + advisory lock)
    ├── shared/                 # pure kernel: errors, i18n, DTOs, provider ports, utils
    ├── test/                   # cross-cutting test kit (mocks, factories)
    └── generated/              # Prisma client (git-ignored, `prisma generate`)
```

Path aliases: `@modules/*`, `@core/*`, `@shared/*`, `@test/*`, `@generated/*`.

**Request lifecycle:** `Route → validateRequest (Zod) → Controller → Use case (@injectable) → Repository (Prisma, scoped by account_id) → Entity`. Controllers are thin and return the `{ ok, data }` envelope.

## Modules

| Module | Responsibility |
|---|---|
| **auth** | Sign-up/in (password + Google), refresh, sign-out, password reset, e-mail-verification PIN, own profile/avatar, account deletion. |
| **user** | User identity core (entity + status + repository), consumed by `auth`. No HTTP surface. |
| **account** | The tenant (every user belongs to one) and its public-API token (`pmb_…`, stored as a SHA-256 hash): read metadata, generate/rotate. |
| **devices** | WhatsApp numbers: register, connect/QR, disconnect, groups, per-device webhook config; session lifecycle listeners. |
| **messaging** | Send text/group/image/audio/video/document, message status, the outbox (queued offline sends, drain on reconnect, TTL prune) and the per-device send throttle. |
| **webhooks** | Outbound delivery of device/message events to customer URLs — HMAC-SHA256 signed, bounded retries. |
| **public-api** | The token-authenticated `/api/v1` surface (per-token rate limit) over `devices` + `messaging`. |

## Endpoints

```
GET  /healthz                        liveness — plain "ok", no DB
GET  /api/health                     { ok, version, uptimeSeconds, gateway? } — version stamped by CI

/api/auth       POST /sign-up · /sign-in · /google · /refresh · /sign-out
                POST /password/request-reset · /password/reset
                POST /email-verification/send · /email-verification/verify
                GET /me · PUT /profile · PUT /profile/avatar · DELETE /account
/api/account    GET /api-token · POST /api-token
/api/devices    POST / · GET / · GET /:id · GET /:id/qr · GET /:id/groups
                PATCH /:id/webhooks · POST /:id/connect · POST /:id/disconnect · DELETE /:id
/api            POST /devices/:id/messages[/group|/image|/audio|/video|/document] · GET /messages/:id
/api/v1         GET /devices · POST /devices/:deviceId/send-{text,image,audio,video,document}   (Bearer pmb_…)
```

Session routes use cookies + CSRF; `/api/v1` uses the API token and no CSRF.

## Database

Prisma against PostgreSQL. Models: `account`, `api_token`, `user`, `password_reset_token`, `email_verification_pin`, `device`, `auth_key` (Baileys session keys — secrets), `outbox_message`. Enums: `user_status`, `device_status`, `message_status`, `outbox_message_type`.

The client is generated to `src/generated/prisma` (git-ignored) by `prisma generate` (runs on `postinstall`). In the container, `prisma migrate deploy` runs on boot (`docker-entrypoint.sh`, skip with `RUN_MIGRATIONS=false`).

## Environment

```bash
cp .env.example .env
```

Only `DATABASE_URL` and `JWT_SECRET` are required; everything else has a default or is optional (Redis, Resend, S3, Google OAuth, Bugsnag, rate limits, WhatsApp tuning). The schema lives in `src/core/config/schema/`, and `src/core/config/env-example.spec.ts` fails when `.env.example` or `infra/.env.prod.example` drift from it.

`WHATSAPP_ENABLED` is the gateway master switch: `false` (default) boots without importing Baileys; `true` only on the single replica that owns the sockets. The API listens on `API_PORT` (schema default `3333` — the production container; the local `.env.example` uses `4444`).

## Commands

From the repo root:

```bash
yarn backend:up            # Postgres + Redis + this API (foreground)
yarn backend:up-d          # ...detached
yarn db:migrate            # prisma migrate dev
yarn db:reset-seed         # drop + migrate + seed
yarn db:seed               # seed the demo user (demo@example.com / Demo1234!)
```

Inside the workspace (`apps/api`): `yarn dev`, `yarn build`, `yarn test`, `yarn prisma:studio`.

Image: `docker build -f apps/api/Dockerfile --target runtime -t pombo-api .` (from the repo root). Release and deploy: [`DEPLOY.md`](../../DEPLOY.md).

## Testing

Vitest, with `*.spec.ts` co-located next to the code they test (use cases, entities, DTOs and controllers are mandatory):

```bash
yarn workspace @pombo/api test
```
