import { z } from "zod";

// Redis read-aside caches (pure optimization; fail-open).
export const cacheSchema = z.object({
  // TTL of the device + user entity caches (hot-read paths). A backstop only —
  // writes invalidate the key immediately, so freshness does not depend on it.
  CACHE_ENTITY_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  // TTL of the public-API token lookup cache. This is the REVOCATION-PROPAGATION
  // window: `rotate` can't invalidate the old hash, so a revoked token keeps
  // working for at most this long. The `.max(300)` MACHINE-ENFORCES the "keep
  // small" invariant — ops can't accidentally stretch the revocation window to
  // hours. The web's rotation warning (`apiToken.regenerateConfirm` in
  // apps/web settings.json) quotes the 60 s default — update it with this.
  CACHE_API_TOKEN_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .max(300)
    .default(60),
});
