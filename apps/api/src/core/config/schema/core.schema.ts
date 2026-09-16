import { z } from "zod";

export const coreSchema = z.object({
  NODE_ENV: z
    .enum(["local", "development", "staging", "production", "test"])
    .default("local"),
  API_PORT: z.coerce.number().default(3333),
  // Allowed CORS origin(s). NEVER "*" in production.
  ALLOWED_ORIGIN: z.string().min(1, "ALLOWED_ORIGIN must be set").default("*"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  // Ceiling for the graceful shutdown (core/service/lifecycle). Keep it BELOW
  // the orchestrator's kill grace (infra/app/docker-compose.prod.yml: 60 s) so
  // a hung teardown still ends in our own exit code, not a SIGKILL. The
  // `.max()` machine-enforces that: after a crash this is also the longest the
  // process may linger.
  SHUTDOWN_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .max(60_000)
    .default(30_000),
});
