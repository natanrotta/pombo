# @pombo/api

REST API for the boilerplate — **single-user authentication** on a Clean Architecture, module-first codebase.

**Stack:** Node.js · Express 4 · TypeScript · Prisma 7 (PostgreSQL) · tsyringe (DI) · Zod · BullMQ/Redis (optional infra) · Vitest.

---

## Architecture

Module-first. Each domain owns its full vertical slice; the composition root wires everything with dependency injection.

```
apps/api/src
├── main.ts                     # boot: config → DI container → HTTP server
├── modules/
│   ├── auth/                   # sign-in/up, tokens, password reset, e-mail verification
│   │   ├── domain/             #   entities + repository interfaces
│   │   ├── application/        #   use-cases + DTOs (Zod) + services
│   │   └── infrastructure/     #   controllers, routes, Prisma repositories
│   └── user/                   # the identity core: user entity/repository + user CRUD
├── core/
│   ├── config/                 # env.ts — Zod-validated environment (fail-fast on boot)
│   ├── container/              # tsyringe DI container + DI_TOKENS
│   ├── database/               # Prisma client + error mapper
│   ├── http/                   # Express app, routes, middlewares, cookie/CSRF helpers
│   ├── provider/               # cache, event-bus, hash, jwt, logger, mail, metrics, queue, storage
│   └── service/                # encryption, error-reporter, scheduler (cron)
├── shared/                     # cross-cutting: errors, i18n, providers (ports), types, utils
├── generated/                  # Prisma client output (git-ignored, `prisma generate`)
└── prisma/                     # schema.prisma · migrations · seed.ts
```

Path aliases: `@modules/*`, `@core/*`, `@shared/*`, `@test/*`, `@generated/*`.

### Request lifecycle

`Route → validateRequest (Zod) → Controller → Use-case (@injectable) → Repository (Prisma) → Entity`.
Controllers are thin: they resolve a use-case from the container and return the `{ ok, data }` envelope. All routes mount under `/api`.

## Modules

| Module | Responsibility |
|---|---|
| **auth** | Sign-up, sign-in, Google sign-in, refresh, sign-out; password reset; e-mail-verification PIN; the authenticated user's own profile (`/me`, `/profile`). |
| **user** | User identity core (entity + `UserStatus` + repository), consumed by `auth`. No HTTP surface of its own. |

## Endpoints

**Auth** (`/api/auth`):

```
POST   /sign-up                     POST /google            POST /refresh
POST   /sign-in                     POST /sign-out
POST   /password/request-reset      POST /password/reset
POST   /email-verification/send     POST /email-verification/verify
GET    /me                          PUT  /profile           PUT  /profile/avatar
DELETE /account
```

**Health:** `GET /api/health` (unauthenticated liveness + version).

## Database

Prisma against PostgreSQL. The schema is intentionally minimal — 3 models and one enum:

- `user` (`user_status` = ACTIVE | PENDING)
- `password_reset_token`
- `email_verification_pin`

The client is generated to `src/generated/prisma` (git-ignored) via `prisma generate` (runs on `postinstall`).

## Environment

Copy and fill `.env`:

```bash
cp .env.example .env
```

Only `DATABASE_URL` and `JWT_SECRET` are required; everything else has a sensible default or is optional (Redis, Resend mail, S3, Google OAuth, observability, rate limits). Zod validates on boot and exits with a clear message if something required is missing.

## Commands

From the repo root:

```bash
yarn backend:up            # Postgres + Redis + this API (foreground)
yarn backend:up-d          # ...detached
yarn backend:prisma:migrate  # prisma migrate dev
yarn backend:prisma:reset    # drop + migrate + seed
yarn db:seed               # seed the demo user (demo@example.com / Demo1234!)
```

Or inside the workspace (`apps/api`): `yarn dev`, `yarn build`, `yarn test`, `yarn prisma:studio`.

## Testing

Vitest, with `*.spec.ts` co-located next to the code they test:

```bash
yarn workspace @pombo/api test
```
