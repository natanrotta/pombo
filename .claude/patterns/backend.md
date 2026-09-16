# Backend Architecture — Canonical Lifecycle (Authority)

**This document is the single source of truth for how a backend request flows from HTTP to database and back.**

Every backend skill (`/backend`, `/fullstack`, `/ai-backend`, `/architect`, `/code-review`, `/test`) MUST defer to this document. If a skill contradicts this file, this file wins. If you discover a divergence between this file and the actual code, update this file (PR + reviewer approval) — never let the skills drift.

> **📁 Physical organization is MODULE-FIRST — see [`backend-modules.md`](./backend-modules.md).**
> `apps/api/src` is organized `modules/<domain>/ · shared/ · core/ · test/`, NOT
> layer-first. The **layer + type** names below (`domain/entity/`,
> `application/use-case/`, `infrastructure/controller/`, …) are unchanged — they
> now nest **inside each module** (e.g. `modules/devices/application/use-case/…`),
> with singular type subfolders. This doc owns the request **lifecycle & patterns
> (HOW)**; `backend-modules.md` owns **where a file goes (WHERE)**. The section
> paths below are the real module-first locations (`modules/<domain>/…`, `core/…`, `shared/…`).

---

## Stack

- **Runtime:** Node 20+ (tsx in dev, tsc + node in prod)
- **HTTP:** Express 4
- **DB:** PostgreSQL + Prisma 7
- **DI:** tsyringe (decorators + reflect-metadata)
- **Validation:** Zod
- **Queue:** BullMQ + Redis
- **Logger:** Pino (`ILoggerProvider`) — never `console.log`
- **Errors:** Sentry + custom `AppError` hierarchy
- **i18n:** i18next (pt-BR primary, en, es)
- **Tests:** Vitest 3.2 (globals)

---

## Physical Structure (module-first)

> The **module (feature) is the top-level unit**; the layer (domain → application →
> infrastructure) is a subfolder inside it, and type subfolders are **singular**
> (`entity/`, `use-case/`, `controller/`…). See `backend-modules.md` for the
> canonical skeleton, the domain list, and the `shared/` + `core/` split.

```
apps/api/src/
  modules/<domain>/            # the business — one folder per DOMAIN (7 today — see backend-modules.md)
    domain/
      entity/                  # <x>.entity.ts (+ .spec.ts co-located)
      repository/              # <x>-repository.interface.ts (PORT — contract + Create/Update types)
      provider/                # <x>-provider.interface.ts (module-owned PORT, only if any)
    application/
      use-case/{feature}/      # <action>-<x>.use-case.ts (one operation per file) + .spec.ts
      dto/                     # <x>.dto.ts (Zod schemas + inferred types + response interfaces)
      service/                 # domain-scoped app services (only if any)
      interface/               # non-repository ports (AI strategies, etc.)
    infrastructure/
      controller/              # <x>.controller.ts — thin: resolve use case, return envelope
      route/                   # <x>.routes.ts (feature routes; the aggregator lives in core/http)
      repository/              # prisma-<x>-repository.ts (Prisma impl of the domain port)
      provider/                # concrete adapters (the Baileys gateway, the HTTP webhook sender, the send pacer — only if any)
    util/  constant/           # domain-flavored helpers / constants (business names)
    test/                      # <x>.factory.ts (test data builders for THIS module)
    <domain>.module.ts         # DI wiring: register<Domain>Module(container) — repo bindings only

  shared/                      # pure kernel — ZERO domain knowledge, importable anywhere
    error/                     # AppError hierarchy + ErrorCodes enum
    i18n/                      # i18next config + locales/{pt-BR,en,es}/
    util/                      # html, parse-expires-in, safe-s3-delete, with-cache (named by purpose)
    constant/                  # defaults
    policy/                    # (none yet) reusable authz helpers for an explicit post-read check
    provider/                  # generic provider PORTS (ICacheProvider, IJwtProvider, IQueueProvider…)
    dto/                       # common.dto (UuidParamSchema — the /:id route param every module shares)

  core/                        # the chassis — boots the app, no business rule
    http/                      # app.ts, routes/index.ts (aggregator), middlewares/, logger.ts, types/
    container/                 # tsyringe DI composition root (index.ts) + tokens.ts + boot guards
    config/                    # Zod-validated env: env.ts (dotenv + parse + exit) over schema/<concern>.schema.ts
    database/                  # prisma/prisma-client.ts, prisma-error-mapper.ts (mapPrismaError)
    provider/                  # concrete generic impls (RedisCache, BullMQQueue, S3Storage, Jwt, Bcrypt…)
    service/                   # cross-cutting (error-reporter/Bugsnag, scheduler, lifecycle = graceful shutdown, whatsapp boot)
    bootstrap/                 # BullMQ queue + processor registration (called from main.ts)

  test/                        # cross-module test kit: mocks/ + factories/ (aggregator barrel)
  scripts/                     # operational tools (seeds) — run by hand / CI
  generated/                   # Prisma client (build artifact, gitignored) — via @generated alias
  main.ts                      # bootstrap only: error reporter → shutdown plan → gateway boot → listen
```

**Path aliases:** `@modules/*` `@core/*` `@shared/*` `@test/*` `@generated/*`. The old
`@domain` / `@application` / `@infrastructure` / `@tests` are **gone**. DI tokens are imported from
`@core/container/tokens` (`DI_TOKENS.X` — typed string keys; never a bare string literal).

**Dependency rule (inward only, unchanged):** `domain` ← `application` ← `infrastructure` inside each
module. `modules/` may import `shared/` and `core/` (ports); `core/` may import `shared/`; `shared/`
imports nobody. A module NEVER imports another module's `infrastructure/` — only its `domain/` or
`application/`. Violations are blocking. Full skeleton + "where do I put X?" cheat-sheet in
[`backend-modules.md`](./backend-modules.md).

---

## Canonical Request Lifecycle

For `POST /devices` (the real flow — `modules/devices`):

1. `modules/devices/infrastructure/route/device.routes.ts` → router matches verb/path (mounted at `/devices` by `core/http/routes/index.ts`, behind the global + `userRateLimit` limiters)
2. `authMiddleware()` — verifies the JWT from the `pombo_at` cookie, loads the user, attaches `req.auth = { userId, accountId, language, scope? }`
3. `validateRequest({ body: RegisterDeviceDTOSchema })` — Zod parse; on failure throws `ValidationError`
4. `asyncHandler(controller.register.bind(controller))` — wraps async to forward rejections to error middleware
5. `DeviceController.register(req, res)` — `container.resolve(RegisterDeviceUseCase).execute(req.auth.accountId, req.body)`
6. Use case: validates preconditions (unique name per account) → calls the repository → triggers side effects (domain events, cache eviction) → returns response DTO
7. `CachedDevicesRepository` (decorator) → `PrismaDevicesRepository.create()` → `toEntity()` → returns domain entity
8. Controller responds: `res.status(201).json({ ok: true, data: result })`
9. Any thrown error → `errorHandlerMiddleware` → translates via i18n → `{ ok: false, error: { message, code, details? } }` with the right HTTP status

---

## Patterns by Layer

### Entity (`modules/<domain>/domain/entity/{entity}.entity.ts`)

```typescript
// Illustrative — mirror `modules/devices/domain/entity/device.entity.ts` for the exact props.
export interface DeviceProps {
  id: string;
  accountId: string;
  name: string;
  identifier: string | null;       // the paired WhatsApp number — null until pairing
  status: DeviceStatus;            // value object: modules/devices/domain/value-object/device-status.ts
  webhookSecret: string | null;    // per-device HMAC secret — returned exactly once, never re-exposed
  webhooks: DeviceWebhooks;        // one URL per event (null = unset)
  lastConnectedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Device {
  private readonly props: DeviceProps;
  constructor(props: DeviceProps) { this.props = props; }

  get id(): string { return this.props.id; }
  get accountId(): string { return this.props.accountId; }
  get name(): string { return this.props.name; }
  // ... one getter per field

  public toJSON() {
    const { webhookSecret, ...safe } = this.props;
    return safe;  // omit sensitive fields here (secrets, tokens, session keys)
  }
}
```

**Rules:** immutable props, private; only getters; `toJSON()` controls serialization — and a projection with a DIFFERENT exposure gets its own named method instead of a flag (`ApiToken.toMetadata()` hides the hash; never a `toJSON(includeSecret)`); no business behavior in entities (use cases own logic) — derived read-only getters over own state (`user.isActive`, `device.isConnected`) are fine and preferred over `status === "ACTIVE"` literals in use cases; nested relations as `Xxx[]` of IDs or nested entities.

### Repository Interface (`modules/<domain>/domain/repository/{entity}-repository.interface.ts`)

```typescript
export interface CreateDeviceData { accountId: string; name: string; webhookSecret: string; }
export type UpdateDeviceWebhooksData = Partial<DeviceWebhooks>;   // null clears a URL, absent leaves it

export interface IDevicesRepository {
  // ── Tenant-scoped (request-driven, R1) — accountId FIRST ──────────────
  findById(accountId: string, id: string): Promise<Device | null>;
  findByName(accountId: string, name: string): Promise<Device | null>;
  list(accountId: string): Promise<Device[]>;
  create(data: CreateDeviceData): Promise<Device>;
  updateWebhooks(accountId: string, id: string, webhooks: UpdateDeviceWebhooksData): Promise<Device>;
  delete(accountId: string, id: string): Promise<void>;

  // ── System-triggered (no tenant scope; keyed by PK) — documented, never reachable from a user request
  findByIdInternal(id: string): Promise<Device | null>;
  listAll(): Promise<Device[]>;
  updateStatus(id: string, status: DeviceStatus, identifier?: string | null): Promise<Device>;
}
```

**Rules:** every **request-driven** method takes `accountId` first (multi-tenancy — R1) and returns `null` on a miss (the use case turns it into `NotFoundError`, R3); **system-triggered** methods (socket events, the `/health` aggregate, cron) are suffixed `*Internal` / named `listAll` / `updateStatus`, documented in the interface, and never reachable from a user request; `Create*` has required fields; `Update*` is all-optional with `| null` for clearable fields; a paginated list returns `{ data, total }`.

### Prisma Repository (`modules/<domain>/infrastructure/repository/prisma-{entity}-repository.ts`)

```typescript
@injectable()
export class PrismaDevicesRepository implements IDevicesRepository {
  private toEntity(row: DeviceRow): Device {
    return new Device({
      id: row.id,
      accountId: row.account_id,
      name: row.name,
      status: row.status,
      identifier: row.identifier,
      webhookSecret: row.webhook_secret,
      webhooks: { /* one column per event → one field */ },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }

  async findById(accountId: string, id: string): Promise<Device | null> {
    try {
      const row = await prisma.device.findFirst({
        where: { id, account_id: accountId },   // + `deleted_at: null` on soft-deletable tables (user, account)
      });
      return row ? this.toEntity(row) : null;
    } catch (error) { throw mapPrismaError(error); }
  }
}
```

**Rules:** `@injectable()`; private `toEntity()` (snake_case → camelCase); a private `includeRelations` getter for a reusable join shape (with soft-delete on relations) when the entity has any; **every** Prisma catch → `mapPrismaError(error)`; soft-delete = `update({ deleted_at: new Date() })`, never physical, on user-facing records (`user`, `account`, …) — the documented exception is `device`: a deleted pairing is physically removed together with its Signal keys (`auth_key` cascades), because a stale session must not linger; `account_id` (+ `deleted_at: null` where the column exists) on every request-driven read; `prisma.$transaction` for multi-table writes; `Promise.all([findMany, count])` for paginated reads. A cache-aside decorator (`CachedDevicesRepository`, `cached-user-repository.ts`) wraps the Prisma repo when reads are hot — it evicts **after** the write and documents the sub-TTL stale window.

### Use Case (`modules/<domain>/application/use-case/{feature}/{action}-{entity}.use-case.ts`)

```typescript
@injectable()
export class GetDeviceUseCase {
  constructor(
    @inject(DI_TOKENS.DevicesRepository) private readonly devicesRepo: IDevicesRepository,
  ) {}

  async execute(accountId: string, id: string): Promise<DeviceResponseDTO> {
    // 1. Scoped read — a device of another account resolves to null (R1)
    const device = await this.devicesRepo.findById(accountId, id);
    // 2. Miss → NotFoundError, never ForbiddenError (R3)
    if (!device) throw new NotFoundError("Device not found", undefined, ErrorCodes.DEVICE_NOT_FOUND);
    // 3. Side effects (queue, domain event, cache eviction) — after a successful mutation, when any
    // 4. Return response DTO (never raw entity)
    return device.toJSON();
  }
}
```

**Rules:** one operation per use case; `@injectable()` + `@inject(DI_TOKENS.X)` for **all** deps — including concrete classes (the dev runtime `tsx` does not emit `design:paramtypes`, see `backend-modules.md` § DI); receives validated DTOs, returns response DTOs; **never** touches `Request`/`Response`; throws `AppError` subclass with `ErrorCodes`; queues background jobs **after** successful mutations; evicts caches immediately after writes; the write-before-send contract for anything that leaves the process (persist the outbox row, **then** call the gateway/webhook — the id in the 202 must already be committed); use CAS for state transitions with concurrent access; use `safeS3Delete()` for file cleanup (idempotent).

### DTO — Zod (`modules/<domain>/application/dto/{entity}.dto.ts`)

```typescript
export const RegisterDeviceDTOSchema = z.object({
  name: z.string().trim().min(1).max(60),
});

const WebhookUrlSchema = z.string().trim().url()
  .refine((v) => /^https?:\/\//i.test(v), { message: "Webhook URL must use http(s)" })
  .nullable();

export const UpdateDeviceWebhooksDTOSchema = z.object({
  onMessageStatus: WebhookUrlSchema.optional(),   // null = clear, omit = unchanged
  // ... one key per event
});

export type RegisterDeviceDTO = z.infer<typeof RegisterDeviceDTOSchema>;
export type UpdateDeviceWebhooksDTO = z.infer<typeof UpdateDeviceWebhooksDTOSchema>;

export interface DeviceResponseDTO { id: string; accountId: string; name: string; status: DeviceStatus; ... }
```

**Reuse first:** `UuidParamSchema` from `shared/dto/common.dto.ts` for every `/:id` route param. **No custom messages on Zod checks** (`.uuid("…")`, `.min(1, "…")`): a schema-level message overrides the per-request error map that localizes validation errors (`validate-request.middleware.ts`) — the plain check is what makes `validation:string.uuid` apply. Always `.trim()` strings; use `z.coerce.date()` for date strings, `z.coerce.number()` for query numerics; nullable+optional means `null` clears and omit means unchanged.

### Controller (`modules/<domain>/infrastructure/controller/{entity}.controller.ts`)

```typescript
export class DeviceController {
  async register(req: Request, res: Response): Promise<Response> {
    const useCase = container.resolve(RegisterDeviceUseCase);
    const result = await useCase.execute(req.auth.accountId, req.body);
    return res.status(201).json({ ok: true, data: result });
  }
}
```

**Rules:** thin (resolve + delegate + envelope); auth via `req.auth.{userId,accountId,language,scope?}` (session) or `req.apiAuth.{accountId,tokenId}` (public token API); **never** put business logic here; **never** catch errors (let them bubble to error middleware).

### Route (`modules/<domain>/infrastructure/route/{entity}.routes.ts`)

```typescript
const deviceRoutes = Router();
const ctrl = container.resolve(DeviceController);

deviceRoutes.use(authMiddleware());                            // every device route is session-guarded

deviceRoutes.post("/",
  validateRequest({ body: RegisterDeviceDTOSchema }),
  asyncHandler(ctrl.register.bind(ctrl)));

deviceRoutes.get("/",
  asyncHandler(ctrl.list.bind(ctrl)));

deviceRoutes.get("/:id",
  validateRequest({ params: DeviceIdParamSchema }),
  asyncHandler(ctrl.getById.bind(ctrl)));

deviceRoutes.patch("/:id/webhooks",
  validateRequest({ params: DeviceIdParamSchema, body: UpdateDeviceWebhooksDTOSchema }),
  asyncHandler(ctrl.updateWebhooks.bind(ctrl)));

export { deviceRoutes };
```

Register in `core/http/routes/index.ts`: `router.use("/devices", deviceRoutes)`. Declare `/bulk`-style literal routes **before** `/:id` to avoid conflicts (`B-M3`).

**Middleware order:** `authMiddleware()` (or `apiTokenAuthMiddleware()` on `/api/v1/*`, or a scoped variant such as `emailVerificationAuthMiddleware()`) → `validateRequest({ params?, query?, body? })` → upload (when handling files) → `asyncHandler(handler)`. Rate limiters are mounted at the aggregator level (`core/http/routes/index.ts`: `authRateLimit` on `/auth`, `userRateLimit` after it; `publicRateLimit` / the per-token limiter on public surfaces).

### Dependency Injection (`core/container/index.ts`)

```typescript
container.registerSingleton<IDevicesRepository>(DI_TOKENS.DevicesRepository, PrismaDevicesRepository);
container.registerSingleton<IJwtProvider>(DI_TOKENS.JwtProvider, JsonWebTokenJwtProvider);
container.registerSingleton<IWebhookSender>(DI_TOKENS.WebhookSender, HttpWebhookSender);
```

**Rules:** every token comes from `DI_TOKENS` (`core/container/tokens.ts` — typed keys, one place); all singletons; use cases are **not** registered (resolved per-request via `container.resolve(UseCase)` so request-scoped state is fresh); each module exposes `register<Domain>Module(container)` in `<domain>.module.ts` for its repo bindings, and `core/container/index.ts` composes them. Group registrations by category (repositories, providers, services, config values). Middleware factories capture their singletons **once** at creation time — never `container.resolve()` per request inside the handler (`knowledge/code-review.md`).

---

## Cross-Cutting Concerns

### Auth context

`authMiddleware()` populates `req.auth = { userId, accountId, language, scope? }` (session JWT in the `pombo_at` cookie). `apiTokenAuthMiddleware()` populates `req.apiAuth = { accountId, tokenId }` on the public `/api/v1/*` surface (`pmb_` Bearer token, SHA-256 matched against the stored hash). Treat them as guaranteed inside any route after the middleware runs. Never trust a client-supplied `accountId` — always read the tenant from `req.auth.accountId` / `req.apiAuth.accountId`.

### Multi-tenancy

Every request-driven read **and** write filters by `account_id`. In this repo the scoping lives in the **repository signature** — `findById(accountId, id)`, `updateWebhooks(accountId, id, …)`, `delete(accountId, id)` — so a use case cannot forget it: a row of another tenant resolves to `null` and the use case throws `NotFoundError` (never `ForbiddenError` — don't reveal that the resource exists in another tenant). Never write `if (!entity || entity.accountId !== callerAccountId)` after an unscoped read (`B-H11`); if a genuinely post-read check is ever needed, add a `shared/policy/ensure-same-account.ts` helper rather than an inline `if`.

**System-triggered paths** (Baileys session events, the `/health` aggregate, cron) have no requesting account: their repository methods are suffixed `*Internal` / named `listAll` / `updateStatus`, keyed by the primary key, documented in the interface, and never reachable from a user request. A `Device` returned by such a path carries its real `accountId`, but that value was **not** validated against a caller — never forward it into a tenant-scoped method as a stand-in for `req.auth.accountId` (confused deputy). See `IDevicesRepository` for the canonical wording.

### Soft delete

Default. `delete()` = `update({ deleted_at: new Date() })`. Every read includes `deleted_at: null` in the `where` clause. Joins to soft-deletable relations include `where: { related: { deleted_at: null } }` in the include shape.

### Error handling

```typescript
throw new NotFoundError("Device not found", undefined, ErrorCodes.DEVICE_NOT_FOUND);
throw new ConflictError("Email already in use", undefined, ErrorCodes.AUTH_EMAIL_ALREADY_EXISTS);
throw new ValidationError("Invalid status", { field: ["..."] }, ErrorCodes.INVALID_STATUS);
throw new InternalError("S3 upload failed", originalError, ErrorCodes.FILE_UPLOAD_FAILED);
```

| Error | HTTP | Use when |
|-------|------|----------|
| `BadRequestError` | 400 | Invalid request shape / wrong state transition |
| `UnauthorizedError` | 401 | Missing/expired/invalid token |
| `ForbiddenError` | 403 | Authenticated but lacks permission for this action |
| `NotFoundError` | 404 | Resource missing OR cross-tenant access |
| `ConflictError` | 409 | Duplicate / already-linked |
| `ValidationError` | 422 | Schema validation failure |
| `TooManyRequestsError` | 429 | Rate limited |
| `InternalError` | 500 | Unexpected error |
| `ServiceUnavailableError` | 503 | External service down |

When adding a new `ErrorCode`: (1) add to `shared/error/error-codes.ts`, (2) add translation to all 3 locale files (`shared/i18n/locales/{pt-BR,en,es}/errors.json`).

### Response envelope

```typescript
// Success
{ ok: true, data: T }

// Paginated
{ ok: true, data: { data: T[], meta: { page, limit, total, totalPages } } }

// Error
{ ok: false, error: { message: string, code: string, details?: unknown } }

// 202 Accepted (async / queued)
{ ok: true }

// 204 No Content (sync delete)
// (no body)
```

`message` is i18n-translated server-side based on `Accept-Language`.

### HTTP status mapping

| Operation | Status | Body |
|-----------|--------|------|
| GET success | 200 | envelope |
| POST create | 201 | envelope |
| PUT/PATCH update | 200 | envelope |
| DELETE sync | 204 | (none) |
| DELETE async (queued) | 202 | `{ ok: true }` |

### Pagination

No list endpoint paginates yet (device lists are per-account and small). The first one that needs it creates `PaginationQuerySchema` (`page`, `limit`, `search`, `sortBy`, `sortOrder`) in `shared/dto/common.dto.ts` and `buildPaginationMeta(total, limit, page)` in `shared/util/pagination.ts`. Default `limit=20`, max `limit=100`. Offset-based: `skip: (page-1)*limit, take: limit`. Use `Promise.all([findMany, count])` for parallel data + count.

### Queues / Jobs (BullMQ)

Bootstrap in `core/bootstrap/{feature}-queue.bootstrap.ts`:

```typescript
export function bootstrapWebhookQueues(): void {
  const queueProvider = container.resolve<IQueueProvider>(DI_TOKENS.QueueProvider);
  queueProvider.createQueue("webhook-delivery");
  queueProvider.registerProcessor("webhook-delivery",
    createDispatchWebhookProcessor(/* injected deps */),
    /* concurrency */ 3);
}
```

Call `bootstrap<Feature>Queues()` from `main.ts` (create `core/bootstrap/` on first use — today the gateway's periodic work is wired by `core/service/whatsapp/gateway-boot.ts` and the cron by `core/service/scheduler/cron.service.ts`; a BullMQ processor follows the shape above, next to the `IQueueProvider` / `IFlowProducer` ports). Defaults: 3 attempts, exponential backoff (1s base), `removeOnComplete: 100`, `removeOnFail: 200`. Job IDs should be deterministic when duplicate prevention matters (`jobId: ${entityType}:${entityId}`). Bull Board admin UI at `/admin/queues` (dev only).

### When to queue vs sync (decision)

| Scenario | Queue? | Why |
|----------|--------|-----|
| Sending email/SMS/notification | **Yes** | External, can fail, retry |
| Bulk delete (>10) | **Yes** | Risk of timeout; needs retry per item |
| Heavy file ops (S3 cleanup, media processing) | **Yes** | Slow, user shouldn't wait |
| Webhook delivery to the customer's URL | **Yes** (bounded retries) | External, can fail, must not block the send path |
| LLM call / embedding generation | **Yes** | Expensive, slow, must retry |
| Simple CRUD (create/get/update/list) | **No** | Fast; user expects immediate feedback |

### When to use a transaction

| Scenario | Tx? | Why |
|----------|-----|-----|
| Create entity + relation rows | **Yes** | Partial state = orphan rows |
| Multi-table signup (Account + User — `user-signup.transaction.ts`) | **Yes** | Atomic |
| Cascading delete with relations | **Yes** | All-or-nothing |
| Single-table CRUD | **No** | Prisma op already atomic |
| Update + S3 cleanup | **No** | Cleanup is idempotent (use `safeS3Delete`) |

### Logging

Use `ILoggerProvider` (Pino) — never `console.log`. Structured fields: `accountId`, `userId`, `deviceId`, `entityId`, `latencyMs`, `outcome`. **Never** log PII or secrets: no phone numbers or JIDs in plaintext where avoidable, no message text, no contact/group names, no webhook URLs carrying secrets, no WhatsApp session keys (`auth_key`), no tokens, no full prompts or embeddings. The pino `redact` list (`core/http/logger.ts`) is defense in depth, not a license.

### i18n

3 locales: pt-BR (default), en, es. `localeMiddleware` reads `Accept-Language` and sets `req.locale`. Error messages auto-translated by `errorHandlerMiddleware`. Add new ErrorCodes to **all 3** locale files.

---

## Reuse-First Tables

Before creating anything new, check this table.

### Existing Providers (`core/container/index.ts` → DI tokens)

| Token | Interface | Implementation | Purpose |
|-------|-----------|----------------|---------|
| `"JwtProvider"` | `IJwtProvider` | `JsonWebTokenJwtProvider` | Sign/verify tokens, refresh pairs |
| `"HashProvider"` | `IHashProvider` | `BcryptHashProvider` | Password hashing |
| `"CacheProvider"` | `ICacheProvider` | `RedisCacheProvider` | Generic Redis caching |
| `"StorageProvider"` | `IStorageProvider` | `S3StorageProvider` | S3 upload / delete / signed URL |
| `"QueueProvider"` | `IQueueProvider` | `BullMQQueueProvider` | Queues with retry/backoff |
| `"LoggerProvider"` | `ILoggerProvider` | `PinoLoggerProvider` | Structured logging |
| `"MailProvider"` | `IMailProvider` | (Resend impl) | Transactional e-mail |
| `"EventBus"` | `IEventBus` | Redis pub/sub | Cross-process events (SSE fan-out) |
| `"DomainEventBus"` | `IDomainEventBus` | in-process typed bus | Session + message-status vocabulary between modules |
| `"FlowProducer"` | `IFlowProducer` | BullMQ flow producer | Parent/child job graphs |
| `"DatabaseStatusProvider"` / `"NodeExporterMetricsProvider"` / `"CiProvider"` | `I*Provider` | Postgres probe / node_exporter / GitHub Actions | The `/api/health` + status surfaces |
| `"WhatsAppGateway"` | `IWhatsAppGateway` (`modules/devices/domain/provider`) | `BaileysWhatsAppGateway` or `DisabledWhatsAppGateway` (by `WHATSAPP_ENABLED`) | The WhatsApp port |
| `"WebhookSender"` | `IWebhookSender` (`modules/webhooks/domain/provider`) | `HttpWebhookSender` | Signs (HMAC-SHA256) + delivers webhooks with bounded retries |
| `"SendRateLimiter"` / `"SendPacer"` | ports in `modules/messaging/domain/provider` | token bucket / human pacer | Anti-ban throttle + typing/jitter rhythm |

> Add a new **generic** provider port to `shared/provider/` (interface) and its concrete impl to `core/provider/<kind>/`; a **domain-flavored** port (like the gateway) lives in `modules/<domain>/domain/provider/` with its adapter in `modules/<domain>/infrastructure/provider/` (see `backend-modules.md` § port vs impl split). Every token is a `DI_TOKENS` entry.

### Existing Services

| Token | Class | Purpose |
|-------|-------|---------|
| `"AuthProfileBuilder"` | `modules/auth/application/service/auth-profile.builder.ts` (registered in `auth.module.ts`) | Builds the `/auth/me` profile |
| — (called from `main.ts`) | `core/service/error-reporter/` · `core/service/scheduler/cron.service.ts` · `core/service/whatsapp/{advisory-lock,gateway-boot}.ts` · `core/service/lifecycle/` (SIGTERM/SIGINT + uncaught error → staged teardown → exit) | Bugsnag facade · node-cron · single-replica gateway lock + boot |

### Shared Utilities

| Utility | Location | Purpose |
|---------|----------|---------|
| `buildPaginationMeta()` | `shared/util/pagination.ts` | `{ page, limit, total, totalPages }` |
| `safeS3Delete()` | `shared/util/safe-s3-delete.ts` | Delete S3 object without throwing |
| `extractS3Key()` | `shared/util/extract-s3-key.ts` | Extract object key from S3 URL |
| `withCache()` | `shared/util/with-cache.ts` | Read-aside cache helper over `ICacheProvider` |
| `parseExpiresIn()` | `shared/util/parse-expires-in.ts` | `15m` / `30d` → milliseconds |
| `mapPrismaError()` | `core/database/prisma/prisma-error-mapper.ts` | Translate Prisma errors → AppError |

---

## Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Entity | `{entity}.entity.ts` | `device.entity.ts` |
| Repo interface | `{entity}-repository.interface.ts` | `devices-repository.interface.ts` |
| Repo impl | `prisma-{entity}-repository.ts` (or `.repository.ts`) | `prisma-devices.repository.ts` |
| Use case | `{action}-{entity}.use-case.ts` | `register-device.use-case.ts` |
| DTO | `{entity}.dto.ts` | `device.dto.ts` |
| Controller | `{entity}.controller.ts` | `device.controller.ts` |
| Route | `{entity}.routes.ts` | `device.routes.ts` |
| Middleware | `{name}.middleware.ts` | `auth.middleware.ts` |
| Provider interface | `{type}-provider.interface.ts` | `jwt-provider.interface.ts` |
| Provider impl | `{impl}-{type}-provider.ts` | `bcrypt-hash-provider.ts` |
| Queue bootstrap | `{feature}-queue.bootstrap.ts` | `webhook-queue.bootstrap.ts` |
| Processor / job | `{action}-{entity}.processor.ts` · `{name}.job.ts` | `dispatch-webhook.processor.ts` · `prune-outbox.job.ts` |
| Test | `*.spec.ts` (next to source) | `register-device.use-case.spec.ts` |
| Factory | `{entity}.factory.ts` | `device.factory.ts` |
| Mock | in `test/mocks/repositories.mock.ts` (or an `in-memory-*.repository.ts` in the module's `test/`) | `mockUserRepository()` · `InMemoryDevicesRepository` |

**Database (Prisma):** `snake_case` table + column names with `@@map`. UUID PKs. `created_at`/`updated_at` timestamps. `deleted_at DateTime?` for soft delete. `@@index([account_id])` on every multi-tenant table. Cascades: `Cascade` for owned deps, `SetNull` for optional refs.

---

## Tests

- **Location:** `*.spec.ts` next to source (`register-device.use-case.spec.ts` next to `register-device.use-case.ts`)
- **Factories:** `apps/api/src/modules/<domain>/test/{entity}.factory.ts` (sequential ids, fixed `new Date("2025-01-01")`)
- **Mocks:** `apps/api/src/test/mocks/repositories.mock.ts`, `providers.mock.ts` (`MockOf<T>` with `vi.fn()`)
- **SUT name:** `sut` (System Under Test)
- **Vitest globals:** do NOT import `describe`/`it`/`expect`
- **Required scenarios per use case:** happy path, NotFoundError + code, ConflictError, ForbiddenError, edge cases (empty, null, pagination limits), side effects (queue called, cache invalidated, etc.)
- **Required scenarios per DTO:** required fields valid + missing, optional present + absent, coercion (date/number), enums, UUID, limits

See `/test` skill for the full template.

---

## Adding a New Feature — Order of Operations

1. **DB schema** — add model in `prisma/schema.prisma`; run `yarn db:migrate <name>`; `yarn db:generate`
2. **Domain** — entity → repository interface
3. **Application** — DTOs (Zod) → use case(s)
4. **Infrastructure** — Prisma repository → controller → routes → register routes in `routes/index.ts`
5. **Wiring** — register repository (and any new provider/service) in `core/container/index.ts`; add ErrorCodes; add translations in 3 locales
6. **Background jobs** (if needed) — processor + bootstrap; call from `main.ts`
7. **Tests** — factory + mock (if new entity/repo) → use case spec → DTO spec → entity spec → controller spec
8. **Quality gate** — `yarn type-check && yarn lint && yarn test`

**Cross-reference:** see `.claude/patterns/code-review-checklist.md` for what gets flagged in review.
