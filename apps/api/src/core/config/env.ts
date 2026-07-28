import { z } from "zod";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const envSchema = z
  .object({
    // ── Core ────────────────────────────────────────────────────────────────
    NODE_ENV: z
      .enum(["local", "development", "staging", "production", "test"])
      .default("local"),
    API_PORT: z.coerce.number().default(3333),
    // Allowed CORS origin(s). NEVER "*" in production.
    ALLOWED_ORIGIN: z
      .string()
      .min(1, "ALLOWED_ORIGIN must be set")
      .default("*"),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace"])
      .default("info"),

    // ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: z.string(),

    // ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_HOST: z.string().default("localhost"),
    REDIS_PORT: z.coerce.number().default(6379),
    REDIS_PASSWORD: z.string().optional(),
    REDIS_DB: z.coerce.number().default(0),

    // ── Auth / JWT ────────────────────────────────────────────────────────────
    JWT_SECRET: z
      .string()
      .min(32, "JWT_SECRET must be at least 32 characters for security"),
    JWT_EXPIRES_IN: z.string().default("15m"),
    REFRESH_TOKEN_EXPIRES_IN: z.string().default("30d"),
    COOKIE_DOMAIN: z.string().optional(),
    // Optional: enables "Sign in with Google" — the backend verifies the Google
    // ID token's audience against this client id (no client secret needed).
    GOOGLE_CLIENT_ID: z.string().optional(),

    // ── Password reset / e-mail verification ─────────────────────────────────
    // FRONTEND_URL builds the reset link emailed to the user.
    FRONTEND_URL: z.string().url().default("http://localhost:3000"),
    PASSWORD_RESET_TOKEN_TTL_MINUTES: z.coerce
      .number()
      .int()
      .positive()
      .default(60),
    EMAIL_VERIFICATION_PIN_TTL_MINUTES: z.coerce
      .number()
      .int()
      .positive()
      .default(15),

    // ── Mail (Resend) — optional (unset disables sending, fail-open) ──────────
    RESEND_API_KEY: z.string().optional(),
    MAIL_FROM: z.string().default("Pombo <no-reply@example.com>"),
    // Dev-only: reroute all outgoing mail to this address. Ignored in prod.
    MAIL_DEV_REDIRECT_TO: z.string().optional(),

    // ── Object storage (S3) — optional (unset disables uploads) ──────────────
    AWS_REGION: z.string().default("us-east-1"),
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    AWS_S3_BUCKET: z.string().optional(),

    // ── Observability — all optional ─────────────────────────────────────────
    // Unset BUGSNAG disables error reporting (fail-open).
    BUGSNAG_API_KEY: z.string().optional(),
    // App version / git commit surfaced by GET /api/health. CI stamps these.
    APP_VERSION: z.string().optional(),
    GIT_COMMIT: z.string().optional(),
    COMMIT_SHA: z.string().optional(),
    // node_exporter scrape URLs (host metrics), one per host. Optional.
    METRICS_APP_URL: z.string().url().optional(),
    METRICS_DATA_URL: z.string().url().optional(),
    // GitHub Actions read-only token + repo, for CI/CD run listing. Optional.
    GITHUB_ACTIONS_TOKEN: z.string().optional(),
    GITHUB_REPO: z.string().default("owner/repo"),

    // ── Rate limiting ─────────────────────────────────────────────────────────
    // `.min(1)` floors prevent a misconfigured 0 from silently disabling a limiter.
    RATE_LIMIT_GLOBAL_WINDOW_MS: z.coerce
      .number()
      .min(1)
      .default(5 * 60 * 1000),
    RATE_LIMIT_GLOBAL_MAX: z.coerce.number().min(1).default(1000),
    RATE_LIMIT_USER_WINDOW_MS: z.coerce
      .number()
      .min(1)
      .default(60 * 1000),
    RATE_LIMIT_USER_MAX: z.coerce.number().min(1).default(200),
    RATE_LIMIT_AUTH_WINDOW_MS: z.coerce
      .number()
      .min(1)
      .default(15 * 60 * 1000),
    RATE_LIMIT_AUTH_MAX: z.coerce.number().min(1).default(10),
    RATE_LIMIT_PUBLIC_WINDOW_MS: z.coerce
      .number()
      .min(1)
      .default(15 * 60 * 1000),
    RATE_LIMIT_PUBLIC_MAX: z.coerce.number().min(1).default(30),
    // Per-token limiter for the public `/api/v1` surface (keyed by api_token id,
    // not IP), layered on top of the global limiter.
    RATE_LIMIT_API_WINDOW_MS: z.coerce
      .number()
      .min(1)
      .default(60 * 1000),
    RATE_LIMIT_API_MAX: z.coerce.number().min(1).default(120),

    // ── WhatsApp Gateway (pombo) ──────────────────────────────────────────────
    // Master flag. When false (default), the app boots with NO Baileys import,
    // NO advisory lock, NO socket, NO rehydration, NO outbox prune — every HTTP
    // endpoint still responds and `connect` returns a clean WA_GATEWAY_DISABLED.
    WHATSAPP_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    // How long a socket flap is debounced before a `device.disconnected` webhook.
    DISCONNECT_DEBOUNCE_MS: z.coerce
      .number()
      .int()
      .nonnegative()
      .default(30000),
    RECONNECT_BASE_DELAY_MS: z.coerce.number().int().positive().default(3000),
    RECONNECT_MAX_DELAY_MS: z.coerce.number().int().positive().default(300000),
    // The outbox is protocol, not history: rows past this TTL are pruned.
    OUTBOX_TTL_HOURS: z.coerce.number().int().positive().default(24),
    OUTBOX_PRUNE_INTERVAL_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(3600000),
    // Per-device outbound send throttle (anti-ban): at most SEND_RATE_MAX sends
    // per SEND_RATE_WINDOW_MS. Applies to BOTH the live send and the reconnect
    // drain (shared budget); the excess is queued and drained as the budget frees.
    // Default 20/min per device is a conservative starting point — tune to the
    // number's reputation.
    SEND_RATE_MAX: z.coerce.number().int().positive().default(20),
    SEND_RATE_WINDOW_MS: z.coerce.number().int().positive().default(60000),
    // Human send pacer (anti-detection): the RHYTHM under the SEND_RATE ceiling,
    // NOT a second throttle. HUMAN_PACING_ENABLED is the master switch (off by
    // default — the pacer ships dark; flip per env after validating on a real
    // number). Tuning: typing scales with message length (TYPING_MS_PER_CHAR) ±
    // SEND_JITTER_PCT, clamped to [TYPING_MIN_MS, TYPING_MAX_MS]; a rare long pause
    // (LONG_PAUSE_PROBABILITY × [MIN,MAX]) breaks metronomic regularity.
    HUMAN_PACING_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    TYPING_MS_PER_CHAR: z.coerce.number().int().positive().default(50),
    TYPING_MIN_MS: z.coerce.number().int().positive().default(1500),
    TYPING_MAX_MS: z.coerce.number().int().positive().default(20000),
    SEND_JITTER_PCT: z.coerce.number().min(0).max(1).default(0.3),
    LONG_PAUSE_PROBABILITY: z.coerce.number().min(0).max(1).default(0.15),
    LONG_PAUSE_MIN_MS: z.coerce.number().int().positive().default(30000),
    LONG_PAUSE_MAX_MS: z.coerce.number().int().positive().default(120000),
    WEBHOOK_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
    WEBHOOK_MAX_ATTEMPTS: z.coerce.number().int().positive().default(4),
    WEBHOOK_RETRY_BASE_DELAY_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(1000),
    // How often the advisory-lock connection heartbeats (single-replica guard).
    ADVISORY_LOCK_HEARTBEAT_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(30000),

    // ── Redis read-aside caches (pure optimization; fail-open) ────────────────
    // TTL of the device + user entity caches (hot-read paths). A backstop only —
    // writes invalidate the key immediately, so freshness does not depend on it.
    CACHE_ENTITY_TTL_SECONDS: z.coerce.number().int().positive().default(60),
    // TTL of the public-API token lookup cache. This is the REVOCATION-PROPAGATION
    // window: `rotate` can't invalidate the old hash, so a revoked token keeps
    // working for at most this long. The `.max(300)` MACHINE-ENFORCES the "keep
    // small" invariant — ops can't accidentally stretch the revocation window to
    // hours.
    CACHE_API_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .max(300)
      .default(60),
  })
  .superRefine((cfg, ctx) => {
    // Cross-field ordering for the pacer's [min, max] pairs. Each field validates
    // in isolation (.positive()), but an inverted pair (min > max) would silently
    // degrade the pacer — every long pause would collapse to the min. Surface it
    // loudly at startup instead. (The pacer also clamps defensively at runtime.)
    if (cfg.TYPING_MIN_MS > cfg.TYPING_MAX_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["TYPING_MIN_MS"],
        message: "TYPING_MIN_MS must be <= TYPING_MAX_MS",
      });
    }
    if (cfg.LONG_PAUSE_MIN_MS > cfg.LONG_PAUSE_MAX_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["LONG_PAUSE_MIN_MS"],
        message: "LONG_PAUSE_MIN_MS must be <= LONG_PAUSE_MAX_MS",
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const missingFields = Object.keys(parsed.error.flatten().fieldErrors);
  // eslint-disable-next-line no-console
  console.error("❌ Invalid environment variables:");
  // eslint-disable-next-line no-console
  console.error(`  Missing or invalid: ${missingFields.join(", ")}`);
  // Also print each issue's message: a cross-field refine failure (e.g.
  // TYPING_MIN_MS > TYPING_MAX_MS) is meaningless from the field name alone.
  // eslint-disable-next-line no-console
  console.error(`  ${parsed.error.issues.map((i) => i.message).join("\n  ")}`);
  process.exit(1);
}

export const env = parsed.data;
