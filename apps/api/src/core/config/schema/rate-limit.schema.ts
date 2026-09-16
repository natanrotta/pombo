import { z } from "zod";

// `.min(1)` floors prevent a misconfigured 0 from silently disabling a limiter.
const windowMs = (defaultMs: number) =>
  z.coerce.number().min(1).default(defaultMs);
const max = (defaultMax: number) =>
  z.coerce.number().min(1).default(defaultMax);

export const rateLimitSchema = z.object({
  RATE_LIMIT_GLOBAL_WINDOW_MS: windowMs(5 * 60 * 1000),
  RATE_LIMIT_GLOBAL_MAX: max(1000),
  RATE_LIMIT_USER_WINDOW_MS: windowMs(60 * 1000),
  RATE_LIMIT_USER_MAX: max(200),
  RATE_LIMIT_AUTH_WINDOW_MS: windowMs(15 * 60 * 1000),
  RATE_LIMIT_AUTH_MAX: max(10),
  RATE_LIMIT_PUBLIC_WINDOW_MS: windowMs(15 * 60 * 1000),
  RATE_LIMIT_PUBLIC_MAX: max(30),
  // Per-token limiter for the public `/api/v1` surface (keyed by api_token id,
  // not IP), layered on top of the global limiter.
  RATE_LIMIT_API_WINDOW_MS: windowMs(60 * 1000),
  RATE_LIMIT_API_MAX: max(120),
});
