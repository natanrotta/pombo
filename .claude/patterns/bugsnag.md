# Bugsnag / Observability — Model + `BS-*` Catalog (Authority)

Single source of truth for **error reporting + stability monitoring** in Pombo. The `/bugsnag` skill and the `bugsnag-analyst` agent defer to this file. It owns the *standard* (how errors are reported, redacted, graded, and monitored); the spec owns *what* a given task delivers.

Pombo is a **multi-tenant WhatsApp gateway** (tenancy by `account_id`). The data that must never leave the process toward Bugsnag is **PII** — phone numbers (a WhatsApp JID *is* a phone number), message text, contact/group names, user e-mails — and **secrets** — Baileys session keys (`auth_key`), per-device `webhook_secret`, `pmb_…` API tokens, JWTs. The error reporter is a place these can leak (stack frames, breadcrumbs, request URLs/bodies, logger context). Treat every report as something that leaves the process toward a third party. The two failure modes this doc exists to prevent: **PII/secrets reaching Bugsnag** and **prod errors silently not being reported**.

---

## 1. Topology — projects, keys, stages

The model is **one Bugsnag project per app per environment**. Each project has its own **notifier api_key** (a write-only ingestion key, safe to commit, same class as a Stripe publishable key). The **personal auth token** (Data Access API) is a different beast — account-wide, read+write, NEVER committed.

> **The real names, ids, and keys are NOT recorded here.** The table below is the *expected shape*, not a fact. On first use run `.claude/scripts/bugsnag/bugsnag.sh projects` (and `whoami` for the org slug), then fill `.claude/knowledge/bugsnag.md` § *Project → key map* from that output and `BUGSNAG_ORG_SLUG` in `.claude/.secrets/bugsnag.env`. Never invent or guess a key. If the account has fewer/more projects than this (e.g. no LOCAL project, or a `staging` API), the account wins — update the knowledge file, not this table.

| Project (expected shape) | Type | Notifier api_key | releaseStage | Fed by |
|---|---|---|---|---|
| **Pombo API PROD** | express (node) | *(confirm via `bugsnag.sh projects`)* | `production` | `apps/api` in prod — `BUGSNAG_API_KEY` in `infra/.env.prod` on the app host (`env_file` of `infra/app/docker-compose.prod.yml`) |
| **Pombo Web PROD** | react (browser) | *(confirm via `bugsnag.sh projects`)* | `production` | `apps/web` prod build (`vite build` ⇒ `MODE=production`) — `VITE_BUGSNAG_API_KEY` supplied at build time (see key rules) |
| **Pombo API LOCAL** | express | *(confirm via `bugsnag.sh projects`)* | `local` | `apps/api` local dev — `BUGSNAG_API_KEY` in `apps/api/.env` (`.env.example` ships it blank) |
| **Pombo Web (dev)** | react | *(confirm via `bugsnag.sh projects`)* | `development` | `apps/web` dev (`vite` ⇒ `MODE=development`) — `VITE_BUGSNAG_API_KEY` in `apps/web/.env` |

**Key rules:**
- **api ≠ web, prod ≠ non-prod.** A key belongs to exactly one project. Sending the local key from prod (or vice-versa) splits the signal across the wrong project — a silent misroute that looks like "prod not reporting". Always confirm `bugsnag projects` before wiring a key.
- The **web** key is build-time (`VITE_*`, baked into the static bundle). The repo versions only `apps/web/.env.example` (blank) — there is **no committed `apps/web/.env.production`** today. In prod the key reaches the bundle either through the static host's build env or through an `apps/web/.env.production` you create (a notifier key is write-only, so committing it is acceptable — decide once, document in `knowledge/bugsnag.md`).
- The **api** key is runtime (`BUGSNAG_API_KEY`, optional in `apps/api/src/core/config/env.ts`; read from the app host's `infra/.env.prod`). **`infra/.env.prod.example` does not list it yet** — add it under its `Observability` block when you wire prod, so the placeholder is documented next to `APP_VERSION`. They are NOT interchangeable with the web key.
- `releaseStage` is set from `NODE_ENV` (api — enum `local | development | staging | production | test`) / `import.meta.env.MODE` (web). It is the dimension Bugsnag groups + targets on. Do not hardcode it.

> **The deployed-API silent gap.** The API reporter **fail-open no-ops** when `BUGSNAG_API_KEY` is unset. In a deployed stage that silence is the bug: the prod project shows all-dashes (`release_stages: []` — never received an event) while the app runs fine. The fix is operational (set the env var on the app host + recreate the container) — see `knowledge/bugsnag.md` runbook. The code logs at **WARN** (`"BUGSNAG_API_KEY not configured - error tracking disabled"`) when the key is missing and `NODE_ENV ∈ {production, staging}`, so the gap is visible in pino (`make logs`); in `local`/`development`/`test` it logs at INFO (no key expected there).

---

## 2. The reporter — one vendor-neutral facade per app

Both apps wrap Bugsnag behind a neutral `errorReporter` so a future backend swap touches one folder. **Never call `Bugsnag.*` directly from a call site** — go through the facade.

| | API (`apps/api`) | Web (`apps/web`) |
|---|---|---|
| Facade | `src/core/service/error-reporter/index.ts` | `src/shared/lib/error-reporter.ts` |
| Init | `initErrorReporter()` in `src/main.ts` (first thing after the container import, once) | `initErrorReporter()` in `src/main.tsx` (before render, once) |
| Notify | `errorReporter.notify(err, onError?)` | `errorReporter.notify(err, onError?)` |
| Breadcrumb | `errorReporter.leaveBreadcrumb(msg, meta)` — used by `PinoLoggerProvider` (every `info/warn/error/debug` log becomes a breadcrumb with its context spread in) | n/a (Bugsnag's automatic navigation/network/console breadcrumbs) |
| Request scope | `expressRequestHandler()` — **first** middleware in `src/core/http/app.ts` (plugin `requestHandler` only; pass-through no-op until init) | n/a |
| Perf | n/a | `BugsnagPerformance.start(...)` (Core Web Vitals, page loads, network spans with query strings stripped) |
| Event type | `ErrorReportEvent` (alias of Bugsnag `Event`) — call sites annotate against this, never `@bugsnag/js` | same |

**Init contract (both apps):**
- **Idempotent** — a second `init` is a no-op (`started` guard; the API flips it *before* the success log so a throwing logger can't leave the reporter disabled). [`BS-H1`]
- **Fail-open** — no key ⇒ reporter no-ops (`notify`/`leaveBreadcrumb` return early); the app never crashes for lack of Bugsnag.
- **Loud in deployed stages** — api logs `warn` (not `info`) when the key is unset and `NODE_ENV ∈ {production, staging}`. Web logs a `console.info` only under `import.meta.env.DEV` (a shipped bundle stays silent). [`BS-C1`]
- Only the express plugin's **`requestHandler`** is mounted (per-request breadcrumb isolation via AsyncLocalStorage; it also starts a Bugsnag *session* per request, which is what feeds session stability). The plugin's **`errorHandler` is never mounted** — `errorHandlerMiddleware` (last `app.use` in `app.ts`) is the single HTTP reporting funnel; mounting both double-reports. [`BS-H2`]
- `autoDetectErrors` stays at its default (`true`) in both apps, but the API turns the two **process-level** types off (`enabledErrorTypes: { unhandledExceptions: false, unhandledRejections: false }`): `uncaughtException`/`unhandledRejection` (BullMQ workers, cron, Baileys socket callbacks) are owned by `core/service/lifecycle/graceful-shutdown.ts`, which reports through `errorReporter.notify` (awaited), runs the staged teardown and exits 1 — the SDK's own listeners would `process.exit(1)` right after delivery and race that teardown. The browser keeps `window.onerror`/`unhandledrejection` captured without a call site.
- `appVersion: env.APP_VERSION` (api — the git SHA/tag CI stamps into the image via `apps/api/Dockerfile` (`--build-arg APP_VERSION`); the same value `GET /api/health` returns) and `releaseStage` from `NODE_ENV`/`MODE`. [`BS-M3`]

---

## 3. Severity standard (the "padrão dos logs de erro")

`Bugsnag.notify` defaults handled errors to **`warning`**. That is wrong for crashes. **Always set `event.severity` explicitly** on crash paths. This is what `develop` does today (derived from the real code — verify the anchors by name if you touch them):

| Path | Where | Severity | Reported? |
|---|---|---|---|
| API `AppError` with `statusCode ≥ 500` | `error-handler.middleware.ts` | `error` | yes — `error` tab `{errorCode, statusCode}` + `request` tab `{url (path only), method}` |
| API unhandled `Error` (anything that is not an `AppError`) | `error-handler.middleware.ts` | `error` | yes — `errorCode: GENERIC_ERROR` + `request` tab; client gets 500 (stack only outside production) |
| API non-`Error` throwable (a string/object thrown) | `error-handler.middleware.ts` | — | **no** — logged as `"Unhandled error"`, 500 returned; the `err instanceof Error` gate skips the reporter |
| API `AppError` 401 / 403 / 429 (`OPERATIONAL_REPORTED_STATUS_CODES`) | `error-handler.middleware.ts` | `warning` | yes (auth failures / rate-limit hits are operationally interesting) |
| API other `AppError` 4xx (400, 404, 409, 422 …) | `error-handler.middleware.ts` | — | **no** (client error — pino `warn` only) |
| API 429 from the global limiter (`app.ts`) and the public-token limiter (`public-rate-limit.middleware.ts`), and the 404 catch-all in `app.ts` | respond directly, never reach the error handler | — | **no** (only an `AppError` 429 thrown by app code is reported) |
| API BullMQ job **terminal** failure (dead-lettered after all retries) | `bullmq-queue-provider.ts` (`worker.on("failed")`) | `error` | yes — `queue` tab `{queue, jobId, jobName, attemptsMade}` (opaque ids only; job payloads can carry PII) |
| API BullMQ **infra** failure (worker/queue `error` events) | `bullmq-queue-provider.ts` `notifyInfraFailure` | `error` | yes — throttled to **1 notify per key per 5 min** (pino stays unthrottled) |
| API process-level uncaught / unhandled rejection (workers, cron, Baileys socket callbacks) | `core/service/lifecycle/graceful-shutdown.ts` → `errorReporter.notify` (awaited), then the staged teardown, then exit 1. Bugsnag's own process listeners are OFF (`enabledErrorTypes`) so the SDK's `process.exit(1)` cannot race the teardown | `error` | yes (process-level) |
| Web React tree crash reaching `GlobalErrorBoundary` | `GlobalErrorBoundary.tsx` | `error` | yes — `react` tab `{componentStack}`. **Chunk-load errors** (`isChunkLoadError`) auto-heal via `reloadForStaleChunk()` and are **not** reported |
| Web crash caught by `RouteErrorBoundary` (routed pages) | `RouteErrorBoundary.tsx` | — | **no** — it only auto-heals stale chunks and renders a retry screen; it never calls `errorReporter`. A route-level render crash is therefore **invisible to Bugsnag** (known gap — fix through the standard flow, citing `BS-H3`) |
| Web unhandled exception / rejection outside React | Bugsnag `autoDetectErrors` (default) | unhandled ⇒ `error` | yes |

Rules:
- A new crash/`notify` call site **must** set `event.severity` (`error` for crashes, `warning` for operational-but-expected). [`BS-H3`]
- Don't report routine client errors (most 4xx) — they are noise, not signals. [`BS-M1`]
- Don't report deploy/cache noise (stale-chunk loads) — auto-heal and skip. [`BS-M2`]
- Attach metadata through the existing tabs (`error`, `request`, `queue`, `react`) with **opaque ids only** (`account_id`, `deviceId`, `jobId`, `messageId`) — never a JID/phone, message text, or contact name. [`BS-L1` / `BS-C2`]

---

## 4. PII + secret hardening (R5 / SEC-C7 · R22 / SEC-C4) — defense in depth

PII and secrets must **never** reach Bugsnag. Four layers, all in place — a new field/payload must not regress them:

1. **`redactedKeys`** (both apps) — applies across event metadata **and** breadcrumbs (so it also covers the logger context `PinoLoggerProvider` spreads into API breadcrumbs). Opaque structural ids (`account_id`, `deviceId`, `messageId`) are intentionally **kept** for triage/grouping. A new free-text/PII/secret field in a reported payload ⇒ add it here. [`BS-C2`]
   - **API** (`core/service/error-reporter/index.ts`): `/^authorization$/i`, `/^cookie$/i`, `password`, `email`, `cpf`, `phone`, `notes`, `content` — plus two leftover names inherited from the starter template that map to no Pombo field (harmless; see the file). **Gap to close:** the Pombo-native names are missing — `text`, `message`, `caption`, `pushName`/`name`, `jid`/`remoteJid`/`from`/`to` (a JID is a phone number), `webhook_secret`, `token`, `secret`, `apiKey`. The pino `SENSITIVE_BODY_FIELDS` list in `core/http/logger.ts` is already broader (`message`, `text`, `token`, `refreshToken`, `otp`, …) — the two lists should converge (`SEC-M2`).
   - **Web** (`shared/lib/error-reporter.ts`): `/^authorization$/i`, `/^cookie$/i`, `password`, `token`, `secret`, `apiKey`, `email`, `phone`.
2. **`onError`** (defense in depth) — API: physically deletes `authorization`/`cookie` headers and `event.request.body`, reduces the user to an opaque id (drops email/name). Web: deletes `Authorization`/`Cookie`, reduces the user to an id, and strips query strings from `event.request.url` **and** every breadcrumb URL. On the API, query-string stripping lives in the error handler (`pathOnly()` on the `request` tab it attaches) and in pino, **not** in `onError` — the express plugin's auto-captured request data (`event.request.url`, and the `query`/`params` it adds to the `request` tab) is not touched by the facade. Confirm on a live event (`bugsnag raw .../latest_event`) before assuming a `?search=<phone>` cannot land. [`BS-C2` / `BS-C3`]
3. **`onBreadcrumb`** — web strips PII-bearing query strings **at capture time** (a report-time-only strip leaves them in the in-memory breadcrumb buffer); api drops `/healthz` probe noise. [`BS-C3`]
4. **`collectUserIp: false`** (both) — never collect the caller IP. [`BS-C2`]

> Known open risk: `PinoLoggerProvider` spreads the full logger context into breadcrumbs. Domain callers that log `account_id`/`deviceId`/`messageId` are fine, but a JID (`jid`, `remoteJid`, `from`, `to`), a `pushName`, message `text`, or a `webhook_secret` in an arbitrary log key flows straight through unless its name is in `redactedKeys`. `redactedKeys` catches known names; **not logging PII/secrets stays a call-site discipline** (`B-C5` / `SEC-C7`). Worker paths add a second exposure: BullMQ job payloads — report opaque ids only (as `bullmq-queue-provider.ts` does), never the payload.

---

## 5. Monitoring + "dashboards"

Bugsnag has **no public API to create visual dashboards**. The **Stability Center** (the screen with session/user stability + performance score) is a built-in per-project view — it exists automatically. So "monitoring" here is three concrete things:

1. **Stability targets** — each project has `target_stability` (default `0.99`) + `critical_stability` (default `0.90`) + `stability_target_type` (`session` for the api/express projects, `user` for the web/react projects). These drive the green "ABOVE TARGET" / red badges. Settable via `PATCH /projects/{id}`. Keep the defaults unless there is a reason; record the confirmed values in `knowledge/bugsnag.md`.
2. **The terminal monitor** — `bugsnag monitor` prints a one-screen health view across every project in the org (receiving? top open errors?), and `bugsnag stability <project>` prints the session/user stability timeline. This is the agent-driven "dashboard". Pair it with `yarn monitor-status` (`GET /api/health` → `version` = the `app.version` Bugsnag groups on).
3. **Saved searches (UI)** — curated inbox filters (e.g. "prod unhandled last 24h", "severity:error releaseStage:production"). Created in the Bugsnag UI; documented in `knowledge/bugsnag.md`. Not API-automatable.

Monitoring rules:
- "Is prod reporting?" is answered by `release_stages` being non-empty on the project (a project that never received an event has `[]`). [`BS-C1`]
- A new deployed app/env (e.g. a `staging` API) ⇒ a new project + its own key + a stability target, not a reused key. [`BS-H4`]

---

## 6. `BS-*` anti-pattern catalog

Cite these in audits/reviews with `file:line`. Many overlap `SEC-*`/`B-*` — when both apply, cite `BS-*` and cross-reference (`⊃ SEC-C7`).

### Critical (blocks merge)
| Code | Smell | Fix |
|---|---|---|
| `BS-C1` | Deployed app can silently not report — key unset with no loud signal, or wrong-project key, or `release_stages: []` on a project that should be live | Inject the correct per-project key; reporter warns on missing key in `production`/`staging`; verify with `bugsnag projects` |
| `BS-C2` | PII or a secret can reach Bugsnag — new free-text/PII/secret field (message text, JID/phone, contact name, `webhook_secret`, token) not in `redactedKeys`, `collectUserIp` re-enabled, user set with email/name, raw request body/headers or a job payload reported | Add to `redactedKeys`; keep `collectUserIp:false`; reduce user to opaque id; report opaque ids only (`⊃ SEC-C7`, R5; secrets `⊃ SEC-C4`, R22) |
| `BS-C3` | PII query string captured — URL/breadcrumb with `?search=`/`?q=`/`?phone=` not stripped at capture time | Strip query in `onBreadcrumb` (capture) + `onError` (send); api: keep `pathOnly()` on every URL attached to a report |
| `BS-C4` | Notifier **personal auth token** committed / in a tracked file / in a response or log | Token only in gitignored `.claude/.secrets/bugsnag.env`; rotate if leaked (R22, `⊃ X-C4`) |

### High (should fix)
| Code | Smell | Fix |
|---|---|---|
| `BS-H1` | `initErrorReporter` not idempotent / called more than once ⇒ double `Bugsnag.start` | Keep the `started` guard; single call site (`main.ts` / `main.tsx`) |
| `BS-H2` | Express plugin `errorHandler` mounted (double-report) or `requestHandler` not first | Mount only `requestHandler`, first; funnel through `errorHandlerMiddleware` |
| `BS-H3` | New crash/`notify` call site without explicit `event.severity` (defaults to `warning`) — or a crash path that never notifies at all (e.g. a boundary that swallows) | Set `error` for crashes, `warning` for operational; route the crash to the facade |
| `BS-H4` | New deployed app/env reuses another project's key instead of its own project | One project + key + target per app per env |
| `BS-H5` | Call site imports `@bugsnag/js` directly instead of the `errorReporter` facade | Go through the facade so a backend swap stays contained |

### Medium / Low
| Code | Smell | Fix |
|---|---|---|
| `BS-M1` | Routine client errors (most 4xx) reported as noise | Report only 5xx + operational 401/403/429 |
| `BS-M2` | Deploy/cache noise (stale-chunk loads) reported as app bugs | Auto-heal + skip |
| `BS-M3` | `appVersion`/`releaseStage` not wired ⇒ errors not groupable by build/stage | Set `appVersion: APP_VERSION`, `releaseStage: NODE_ENV`/`MODE` |
| `BS-L1` | Generic `notify(new Error("..."))` with no metadata/context | Attach `addMetadata` (error code, route / queue + jobId / deviceId — opaque ids only) for triage |

---

## 7. Data Access API + the CLI

- Base `https://api.bugsnag.com`. Auth header **`Authorization: token <PERSONAL_AUTH_TOKEN>`** + **`X-Version: 2`**. (This is NOT the notifier api_key.)
- The CLI `.claude/scripts/bugsnag/bugsnag.sh` is the bridge: `whoami`, `projects`, `errors <p> [since]`, `error <p> <id>`, `trends <p> [buckets]`, `stability <p>`, `monitor [since]`, `raw <path>`. It sources the token from the gitignored secret — never pass the token on the command line.
- Useful endpoints: `GET /user/organizations`, `GET /organizations/{org}/projects`, `GET /projects/{id}/errors` (filters via `filters[event.since][][type|value]`, `filters[error.status][][...]`), `GET /projects/{id}/errors/{id}`, `GET /projects/{id}/errors/{id}/latest_event`, `GET /projects/{id}/trend?buckets_count=N`, `GET /projects/{id}/stability_trend`, `GET /projects/{id}/pivots`, `PATCH /projects/{id}` (stability targets).
- Error filters use `[bracket]` syntax → curl needs `--globoff` and the params passed via `-G --data-urlencode` (see the CLI). Errors endpoint returns `[]` when the inbox is empty (a healthy project, not a failure); `stability_trend` returns 204 with no sessions.

---

## What this doc is NOT
- Not a replacement for `security.md` (PII/secret rules live there too — this references them) or `devops.md`/`DEPLOY.md` (the app-host env injection and container recreate live there).
- Not the runbook — operational steps (rotate token, set the prod env var, create saved searches) and the **confirmed** project→key map live in `knowledge/bugsnag.md`.
