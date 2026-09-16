# Backend — Accumulated Knowledge

> Living notes for the `/backend` specialist. Starts mostly empty and fills **with use**:
> every non-obvious lesson (a Prisma/DI gotcha, a query insight, a dead end) gets one line here,
> per `.claude/learning/protocol.md`. Authority for patterns stays in `.claude/patterns/backend.md`.

## Consolidated Principles
- (none yet)

## Code Patterns
- [High] A Zod check with a custom message (`.uuid("Invalid device ID format")`) silently bypasses i18n: the schema-level message wins over the `errorMap` passed to `parse()`, so the client gets English whatever the locale. Plain checks + the error map (`validation:string.uuid`) are the only localized path. (2026-09-16)
- [High] `new URL("http://[::ffff:10.0.0.1]/").hostname` comes back in HEX form (`[::ffff:a00:1]`) — any IPv4-mapped-IPv6 check that only knows the dotted form lets the private address through. `shared/util/ssrf-guard.ts` handles both. (2026-09-16)
- [Med] Entity getters that only READ own state (`user.isActive`, `device.isConnected`) are the sanctioned way to stop `status === "ACTIVE"` literals from spreading across use cases — the decision stays in the use case, the vocabulary stays in the entity. (2026-09-16)

## Query Insights
- (none yet)

## DI & Wiring Gotchas
- [High] `router.use(authMiddleware)` (factory, no parentheses) compiles: Express calls the factory as the handler, it returns a function and never calls `next()` → every request on that router hangs and the guard is not applied. `B-C14` (hook + `core/http/routes/route-mount.spec.ts`). (2026-09-16)
- [High] `CMD ["sh", "-c", "migrate && node dist/main.js"]` makes `sh` PID 1 and it does NOT forward SIGTERM — the app's graceful shutdown never runs; Docker waits `stop_grace_period` and SIGKILLs. The entrypoint must `exec node`. (2026-09-16)
- [Med] tsyringe `registerSingleton` is lazy, so a teardown plan can resolve providers AT shutdown time (never at boot) without instantiating a connection. (2026-09-16)

## Dead Ends
- `env.spec.ts` testing a hand-copied replica of the env schema: it drifted immediately (`PROJECT_NAME`, no `test` NODE_ENV). Test the real `envSchema` — it is pure now (`core/config/schema/`). (2026-09-16)
