# Security — App Security Model & Anti-Patterns (Authority)

**This document is the authoritative security reference for Pombo.** It is project-specific: it describes the *real* security model of this application (auth, multi-tenancy, the two API surfaces, the WhatsApp gateway, integrations, deploy) and a `SEC-*` anti-pattern catalog. Generic OWASP checklists complement it but never replace it. When a surface changes, this file changes in the same PR.

It is consumed by:
- the **`/security`** skill (`.claude/commands/security.md`) — consultant + implementer,
- the **`security-auditor`** agent (`.claude/agents/security-auditor.md`) — read-only scanner,
- `/code-review` and any reviewer who needs the security lens.

It **defers** to: `BASELINE.md` (R1–R28), `code-review-checklist.md` (B-/F-/X-/SC- codes — many are already security codes), `/devops` + `.claude/knowledge/devops.md` (infra). It cross-references those codes instead of duplicating them.

> **Namespace:** security codes are **`SEC-*`**. The bare `S-*` prefix is reserved — never mint an `S-*` security code.
>
> **Anchors drift.** Every path below was true at authoring time (2026-09-14). Before quoting an anchor as fact, re-grep the symbol by name — files move, line numbers rot.

---

## 0. Data classification

Pombo is a **multi-tenant WhatsApp gateway**: an account pairs WhatsApp numbers (devices) through Baileys, sends messages through the REST API / the public token API, and receives session + message events on its own webhook URLs. Three tiers:

| Tier | Examples | Rule |
|---|---|---|
| **Secret** | `JWT_SECRET`, DB/Redis creds, `RESEND_API_KEY`, AWS keys, `BUGSNAG_API_KEY`, `GITHUB_ACTIONS_TOKEN`, the per-device `webhook_secret`, the `pmb_` API tokens (only their SHA-256 hash is stored), **the WhatsApp session keys in `auth_key`** (Signal creds — whoever holds them *is* that number) | Env-only (validated config) or encrypted at rest, `chmod 600` on the server, never in logs/commits/images/front/responses. `R22`, `SEC-C4`. |
| **PII** | phone numbers / JIDs, message text and media, contact + group names, user name/e-mail, webhook URLs (they identify the customer's infra) | Never logged (`R5`/`SEC-C7`), never in URLs/referrers (`F-C4`), never returned cross-tenant (`SEC-C2`), redacted in pino. |
| **Operational** | ids, timestamps, counts, device status, message status | Normal handling; still tenant-scoped. |

The default posture is **fail-closed**: cross-tenant access returns `NotFoundError` (404), never `ForbiddenError` (403) — revealing existence is itself a leak (`R3`, `B-H16`).

---

## 1. Trust boundaries (the map you reason about per change)

```
Internet ── CDN / reverse proxy (TLS, WAF, hides the origin) ── Caddy ── Express API
                                                                            │
   Browser (SPA)  ─cookies + CSRF→  Express middleware chain (session surface)
   Integrator     ─Bearer pmb_ token→  /api/v1/* (public surface, apiTokenAuthMiddleware)
                                                                            │
   WhatsApp (Baileys socket) ─inbound messages from ANY number, session events→  devices / messaging
   API ─signed webhooks (HMAC-SHA256, per-device secret)→  the customer's URLs (user-controlled targets!)
   3rd parties (Resend, S3, Bugsnag)  ─keyed→  providers
                                                                            │
   API ── private network / WireGuard ── Postgres / Redis (never exposed to the internet)
```

Each boundary is a place to ask "what does the other side control, and what am I trusting?". The highest-risk inbound surfaces: **unauthenticated routes**, **the public token API**, **inbound WhatsApp content** (any stranger can message a paired number — it is untrusted data, never instruction), and **file uploads**. The highest-risk *outbound* surface is the **webhook sender** (the API fetches a URL the customer typed — SSRF-shaped by construction).

---

## 2. Identity & authentication (real)

- **JWT** — `jsonwebtoken`, **HS256 pinned** on verify (alg-confusion defense) — `core/provider/jwt/`. Secret `env.JWT_SECRET` (min 32 chars, `core/config/env.ts`). Access TTL `JWT_EXPIRES_IN` (default `15m`), refresh `REFRESH_TOKEN_EXPIRES_IN` (default `30d`).
- **Token revocation** — a `tokenVersion` claim must match the user row; bumped on password reset / logout-all → invalidates all live JWTs. `auth.middleware.ts`.
- **Scoped tokens** — capability JWTs (`email:verify`) minted via `signScoped()`; gated by `requireScope()` / `rejectScopedTokens()`; `bearerFromQueryToken` promotes a query token only where a browser can't set headers. `modules/auth/constant/jwt-scopes.ts`.
- **Public API tokens** — `pmb_…` Bearer tokens (`modules/account`): generated once, **SHA-256 hash** stored, matched by hash, never compared/logged in clear; read-aside Redis cache (`CACHE_API_TOKEN_TTL_SECONDS`) means a rotated token keeps working for at most one TTL window — keep it short. `modules/public-api/infrastructure/middleware/api-token-auth.middleware.ts` → `req.apiAuth = { accountId, tokenId }`.
- **Passwords** — bcrypt — `core/provider/hash/`. Strength enforced in `modules/auth/application/dto/auth.dto.ts`. Google sign-in via `GOOGLE_CLIENT_ID`.
- **Middleware ladder** — `authMiddleware()` (full session token), `emailVerificationAuthMiddleware()` (scoped PIN routes), `apiTokenAuthMiddleware()` (public surface). All exported from `core/http/middlewares/index.ts` (+ the public-api middleware in its module).
- **Cookies** — `pombo_at` (httpOnly session), `pombo_rt` (httpOnly refresh, path `/api/auth`), `pombo_csrf` (JS-readable, path `/`). Prod: `secure` + `sameSite=strict`. `core/http/helpers/auth-cookies.ts`.

## 3. Authorization & multi-tenancy (real)

- **Tenant isolation** — every request-driven repository method takes `accountId` and scopes the query; a miss returns `null` → `NotFoundError`. There is no `ensureSameAccount` helper because the scoping lives in the signature (`IDevicesRepository` is the canonical wording). **System-triggered** methods (`findByIdInternal`, `listAll`, `updateStatus`) have no tenant and must never be reachable from a user request; never launder their `accountId` into a scoped call (confused deputy). This is the #1 invariant (`R1`/`R3`).
- **RBAC** — there are no roles yet (single operator per account). Add `requireRole(...)` in `core/http/middlewares/` the day a second role appears; admin ≠ authenticated.
- **Request context** — `req.auth` (userId, accountId, language, scope) or `req.apiAuth` (accountId, tokenId). Use cases receive `accountId` as an argument — never `req` (`R7`/`B-C9`).

## 4. HTTP hardening (real — `core/http/app.ts`)

- **helmet** — HSTS + preload, frameguard deny, referrer strict-origin; **CSP** (`defaultSrc 'self'`, `scriptSrc 'self'`, `objectSrc 'none'`, `frameAncestors 'none'`). `/admin/*` (BullBoard) uses a CSP-relaxed variant.
- **CORS** — origin allowlist from `ALLOWED_ORIGIN` (strips `*` in prod), `credentials: true`.
- **CSRF** — double-submit (`pombo_csrf` cookie ↔ `X-CSRF-Token` header); safe methods + Bearer-only surfaces (`/api/v1/*`) skip. `csrf.middleware.ts` (`B-C12`). The public API is mounted **before** `csrfProtection` because it never uses cookies.
- **Rate limiting (layered, Redis store)** — global `RATE_LIMIT_GLOBAL_MAX` (1000/window/IP); auth `RATE_LIMIT_AUTH_MAX` (10/window/IP, `authRateLimit`); user `RATE_LIMIT_USER_MAX` (200/window/userId, `userRateLimit`); public share `RATE_LIMIT_PUBLIC_MAX` (30/window/IP, `publicRateLimit`); per-API-token `RATE_LIMIT_API_MAX` (120/window/token, `api-token-rate-limit.middleware.ts`). On top of that, the **send** path has its own per-device token bucket (`SendRateLimiter`, `SEND_RATE_MAX`/`SEND_RATE_WINDOW_MS`) — an anti-ban throttle, not a security limiter, but it is the one that protects the paired number.
- **Body limits** — default `10kb` (`express.json`); raise per-route only where a payload legitimately needs it (media uploads).
- **Validation** — Zod via `validateRequest` middleware on params/query/body (`B-C6`). `trust proxy: 1`.
- **Errors** — central handler; `{ ok:false, error:{ message, code, debug? } }`, stack only non-prod, query strings stripped from Bugsnag reports. `error-handler.middleware.ts`.

## 5. Data layer, secrets, logging (real)

- **Prisma** — no `$queryRaw`/`$executeRaw` template injection; any `$queryRawUnsafe` must use **positional `$1` placeholders + a separate params array**. Soft delete (`deleted_at: null`, `R2`) on user-facing records; `device` is hard-deleted on purpose (its `auth_key` rows cascade — a stale session must not linger). `mapPrismaError` on catches (`B-H3`). Cross-tenant mutations fail-closed (zero rows).
- **Secrets** — single validated config `core/config/env.ts` (Zod); **no scattered `process.env`**. Any dev-default secret must be a real value in prod. `AesGcmEncryptionService` (AES-256-GCM, `core/service/`) is the primitive for secrets at rest — use it for anything provider-issued you persist.
- **WhatsApp session keys** — `auth_key` (`device_id`, `key`, `value` JSON) holds the Signal creds. They are the crown jewels: never logged, never exported through an endpoint, wiped on logout (`IAuthStateRepository.clear`), cascade-deleted with the device, inside the encrypted backup scope. A dump of this table = takeover of every paired number.
- **Logging** — pino with a generated `redact` list (`core/http/logger.ts`): `SENSITIVE_HEADERS` (authorization, cookie, x-api-key, x-csrf-token) + `SENSITIVE_BODY_FIELDS` (password, token, refreshToken, credential, access_token, otp, message, text, notes, …) applied to **both** `req.*` and the `request.*` mirror. **Redaction is defense-in-depth, not a license to log PII** (`R5`/`SEC-C7`). A new sensitive field in a payload must be added to the list (`SEC-M2`).

## 6. Integrations (real)

- **Outbound webhooks** — `modules/webhooks`: every event is signed with **HMAC-SHA256** over the raw body using the device's `webhook_secret` (`hmac-signer.ts`), delivered by `HttpWebhookSender` with a timeout (`WEBHOOK_TIMEOUT_MS`) and bounded retries (`WEBHOOK_MAX_ATTEMPTS`, exponential base `WEBHOOK_RETRY_BASE_DELAY_MS`), disconnect flaps debounced. The URL is **customer-supplied** (`UpdateDeviceWebhooksDTOSchema`: `url()` + `http(s)` only) — the sender is an SSRF surface by construction: keep the scheme allowlist, never follow redirects blindly, never echo the response body to logs, and treat "add a private-range / loopback / link-local block + DNS re-resolution guard" as the next hardening step (`SEC-C6`). Any **inbound** webhook you add must mount before the JSON parser with `express.raw` and verify a signature (`SEC-C3`).
- **Inbound WhatsApp** — everything that arrives on the Baileys socket (messages, reactions, group metadata, `getMessage` retries) comes from **unauthenticated third parties**. It is data: persist/forward it, never execute or interpret it, never let it reach an LLM prompt unfenced (`SEC-C5`), never log its content (`SEC-C7`).
- **File upload / S3** — gate MIME + size per type, strip codecs, sanitize the filename, use an account-scoped S3 key (`{accountId}/{uuid}-{name}`), signed URLs with a short TTL, compensating delete on failure (`safeS3Delete`). `upload.middleware.ts`, `core/provider/storage/`. Media lives in S3 and is **outside** the `pg_dump` backup scope.
- **Providers** — Resend (mail), S3 (storage), Redis (cache/bus/rate-limit store), Bugsnag (errors — see `patterns/bugsnag.md` for the PII posture there), GitHub Actions token (read-only CI status). All env-keyed via the validated config, reached through a provider port — never a hardcoded client in a use case. LLMs, when they arrive, only via `ILlmProvider` (`R23`/`B-C13`).

## 7. The WhatsApp gateway — the live risk surface

- **Session takeover** — `auth_key` (see §5). Also the QR: `GET /devices/:id/qr` returns a pairing QR only to the owning account; a leaked QR before it is scanned = a stranger pairs *their* phone to your device row. Keep it session-guarded, short-lived, never cached by the CDN.
- **Anti-ban ≠ security, but same blast radius** — the send limiter, the human pacer and the single-replica advisory lock (`core/service/whatsapp/advisory-lock.ts`) exist so a paired number is not banned or double-driven. Bypassing them from a "faster" code path is a product incident.
- **Public API tokens** — one token = full send capability on every device of the account. Rotation invalidates only after the cache TTL; `last_used_at` is best-effort. Rate-limited per token.
- **Webhook targets** — see §6: the customer chooses where the API POSTs. The signature protects the *customer* (authenticity); the URL allowlist protects *us* (SSRF).
- **Message content** — PII in transit through the outbox (`outbox_message`), pruned after `OUTBOX_TTL_HOURS`. Never widen that retention without a reason; never surface it in logs or error reports.

## 8. Deploy security (defer to `/devops`; summary here)

Authoritative: `.claude/knowledge/devops.md` + `infra/`. Security-relevant invariants:
- **Golden rule** — the data host never exposes `5432`/`6379` to the internet; app↔DB only over the private network / WireGuard tunnel (`infra/wireguard/`).
- **Edge** — proxy in front of the origin (hides origin IP) + a valid TLS cert (`infra/app/Caddyfile`); the origin should accept 80/443 only from the proxy.
- **Secrets** — `infra/.env.prod` on the server (`chmod 600`, gitignored), not in the image (except the stamped `APP_VERSION`).
- **Backup** — `infra/backup/`: encrypted (`age`) offsite dumps + dead-man switch, private key off the data host; only "real" after a restore drill (`restore-drill.sh`). The `auth_key` table is inside it — the backup is as sensitive as production.
- **Rotate any secret that ever passed through a chat/log.**

---

## SEC-* Anti-Pattern Catalog

Same rubric as `code-review-checklist.md`: **Critical** blocks merge, **High** fix before merge, **Medium** recommended, **Low** nitpick. Cite the code; cross-refs in parentheses point at the existing checklist/baseline code that already governs the same thing — `SEC-*` is the security *lens* over them, not a replacement.

### Critical (block merge)

| # | Anti-pattern | Why |
|---|--------------|-----|
| SEC-C1 | **Broken authentication** — a route accepting input/returning data mounted without `authMiddleware()` / `apiTokenAuthMiddleware()` (or the right scope variant) and not in the documented public allowlist in `routes/index.ts` (`/health`, `/auth/*`) | Anyone can call it (⊃ `B-C11`) |
| SEC-C2 | **Broken object-level auth / IDOR** — entity fetched by id through an unscoped read (`*Internal`/`listAll`) from a user request, or a scoped method missing `account_id` in `where`; or `ForbiddenError` used (reveals existence) | Cross-tenant data leak (`R1`/`R3`, ⊃ `B-C1`/`B-C3`/`B-H16`) |
| SEC-C3 | **Unverified webhook / inbound** — webhook handler without signature verification, or JSON body parser placed before the raw-body route (breaks signature verification) | Forged events; follow the raw-body + verify pattern |
| SEC-C4 | **Secret exposed** — credential committed, hardcoded, read outside the validated config, baked into an image, or sent to the front | Immediate revocation needed (`R22`, ⊃ `X-C4`) |
| SEC-C5 | **Injection into an interpreter/sink** — untrusted input (inbound WhatsApp content, webhook responses, user text) reaching a shell, an eval, a template, or an LLM prompt with tool-calling, without sanitization/fencing | Command/prompt hijack → data exfil / unauthorized sends |
| SEC-C6 | **Injection / SSRF** — raw SQL with string interpolation, shell exec with user input, a server fetch to a user-controlled URL without scheme + private-range guards (the webhook sender is the live case), or unsafe deserialization | Classic RCE/injection (⊃ `B-C7`) |
| SEC-C7 | **PII / secret leak** — phone numbers, message content, contact names, webhook URLs, session keys or tokens logged, reported to Bugsnag, returned in an error to the client, placed in a URL/query/referrer, or emitted cross-tenant | Privacy incident (`R5`, ⊃ `B-C5`/`F-C4`, `BS-C2`) |

### High (should fix)

| # | Anti-pattern | Fix |
|---|--------------|-----|
| SEC-H1 | Route accepts input without `validateRequest(...)` (Zod) | Add the schema + middleware (`B-C6`) |
| SEC-H2 | Sensitive/unauthenticated endpoint (auth, password reset, public share, public API, file upload, send) without rate limiting | Add the right limiter (`auth`/`user`/`public`/per-token; per-device `SendRateLimiter` on send paths) |
| SEC-H3 | Privileged action (system-triggered repo method, `listAll`, BullBoard) reachable from a user request, or — once roles exist — without a role gate | Keep system paths unreachable; add `requireRole` when roles land |
| SEC-H4 | State-changing cookie-auth route bypassing CSRF | Keep it under the CSRF middleware (`B-C12`) |
| SEC-H5 | Weak token/crypto — JWT alg not pinned, no expiry, predictable/guessable token, missing `tokenVersion` revocation, password not bcrypt, MD5/SHA1 for secrets | Mirror the JWT/bcrypt providers |
| SEC-H6 | File upload trusting client MIME/filename, or missing size/type gate, or unsanitized path | Gate via `upload.middleware.ts`; sanitize filename; account-scoped key |
| SEC-H7 | Permissive CORS (`*` with credentials) or weakened/removed security header / CSP `unsafe-eval` | Keep the allowlist + helmet/CSP posture |
| SEC-H8 | New secret added without env validation + rotation path, a dev-default secret left in prod, or a provider-issued secret persisted in clear instead of via `AesGcmEncryptionService` | Register in `env.ts`; require a real value in prod (`X-H4`); encrypt at rest |

### Medium (recommended)

| # | Anti-pattern | Fix |
|---|--------------|-----|
| SEC-M1 | Error response leaks internals (stack, SQL, file path, dependency version) to the client in prod | Map to an `AppError`+`ErrorCode`; debug only non-prod |
| SEC-M2 | New sensitive/personal field in a request/response payload not added to the pino `redact` list | Add the path to `logger.ts` |
| SEC-M3 | No refresh-token rotation / session-fixation defense on long-lived sessions | Rotate on refresh where feasible; document trade-off |
| SEC-M4 | Sensitive action (token generation/rotation, device delete/logout, webhook URL change) without an audit trail | Log the actor + action (no PII) for forensics |
| SEC-M5 | Dependency with a known CVE / no `yarn npm audit` consideration on a new dep | Pin/upgrade; note in the spec Decisions log |
| SEC-M6 | Token promoted from query (`?access_token=`) for SSE/download without proxy stripping it from access logs | Document the proxy requirement; prefer header |

### Low / Nitpick

| # | Issue |
|---|-------|
| SEC-L1 | Verbose version/server header disclosure |
| SEC-L2 | Overly long token/session TTL with no justification |
| SEC-L3 | Missing `aria`/UX affordance that nudges users toward insecure behavior (e.g. paste-secret-in-plaintext field) |

When you spot something real that no `SEC-*` code covers, report it as **`Issue (proposed)`** so it can be promoted into this catalog.

---

## Analysis techniques (how the specialist reasons)

1. **Threat-model the change, not the whole app.** For the diff, ask STRIDE-lite per touched boundary: *Spoofing* (auth ok? which surface — session or token?), *Tampering* (validation/signature?), *Repudiation* (audit trail?), *Information disclosure* (tenant scope + PII in logs/errors/Bugsnag?), *DoS* (rate limit + pagination + body cap + send throttle?), *Elevation* (system path reachable? IDOR?).
2. **Follow the data.** Trace untrusted input from the boundary to where it's trusted (DB query, outbound fetch, shell, file path, response, prompt). Every hop is a SEC checkpoint. Inbound WhatsApp content and customer webhook URLs are the two hops people forget.
3. **Per change-type checklist** — *new route* → SEC-C1/H1/H2/H3 + C2; *new webhook/integration/outbound fetch* → SEC-C3/C4/C6; *touches the gateway/session keys/QR* → §7 + SEC-C7; *touches auth/JWT/tokens/crypto* → SEC-H5; *new env/secret* → SEC-C4/H8; *logging/new field* → SEC-C7/M2; *file upload* → SEC-H6; *LLM/prompt* → SEC-C5; *infra/deploy* → defer to `/devops` golden rules (§8).
4. **Prefer existing primitives.** The repo ships the secure way (scoped repository signatures, `validateRequest`, the limiters, the JWT/bcrypt providers, the hashed API tokens, `AesGcmEncryptionService`, the redact list, the HMAC webhook signer). A security fix is usually "use the existing primitive", not "invent crypto".
