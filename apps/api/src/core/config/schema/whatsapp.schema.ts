import { z } from "zod";
import { envFlag } from "./primitives";

const positiveInt = (defaultValue: number) =>
  z.coerce.number().int().positive().default(defaultValue);

export const whatsAppSchema = z.object({
  // Master flag. When false (default), the app boots with NO Baileys import,
  // NO advisory lock, NO socket, NO rehydration, NO outbox prune — every HTTP
  // endpoint still responds and `connect` returns a clean WA_GATEWAY_DISABLED.
  WHATSAPP_ENABLED: envFlag(),
  // How long a socket flap is debounced before a `device.disconnected` webhook.
  DISCONNECT_DEBOUNCE_MS: z.coerce.number().int().nonnegative().default(30000),
  RECONNECT_BASE_DELAY_MS: positiveInt(3000),
  RECONNECT_MAX_DELAY_MS: positiveInt(300000),
  // The outbox is protocol, not history: rows past this TTL are pruned.
  OUTBOX_TTL_HOURS: positiveInt(24),
  OUTBOX_PRUNE_INTERVAL_MS: positiveInt(3600000),
  // Per-device outbound send throttle (anti-ban): at most SEND_RATE_MAX sends
  // per SEND_RATE_WINDOW_MS. Applies to BOTH the live send and the reconnect
  // drain (shared budget); the excess is queued and drained as the budget frees.
  // Default 20/min per device is a conservative starting point — tune to the
  // number's reputation.
  SEND_RATE_MAX: positiveInt(20),
  SEND_RATE_WINDOW_MS: positiveInt(60000),
  // Human send pacer (anti-detection): the RHYTHM under the SEND_RATE ceiling,
  // NOT a second throttle. HUMAN_PACING_ENABLED is the master switch (off by
  // default — the pacer ships dark; flip per env after validating on a real
  // number). Tuning: typing scales with message length (TYPING_MS_PER_CHAR) ±
  // SEND_JITTER_PCT, clamped to [TYPING_MIN_MS, TYPING_MAX_MS]; a rare long pause
  // (LONG_PAUSE_PROBABILITY × [MIN,MAX]) breaks metronomic regularity.
  HUMAN_PACING_ENABLED: envFlag(),
  TYPING_MS_PER_CHAR: positiveInt(50),
  TYPING_MIN_MS: positiveInt(1500),
  TYPING_MAX_MS: positiveInt(20000),
  SEND_JITTER_PCT: z.coerce.number().min(0).max(1).default(0.3),
  LONG_PAUSE_PROBABILITY: z.coerce.number().min(0).max(1).default(0.15),
  LONG_PAUSE_MIN_MS: positiveInt(30000),
  LONG_PAUSE_MAX_MS: positiveInt(120000),
  // Webhook delivery (HMAC-signed, bounded retries).
  WEBHOOK_TIMEOUT_MS: positiveInt(5000),
  WEBHOOK_MAX_ATTEMPTS: positiveInt(4),
  WEBHOOK_RETRY_BASE_DELAY_MS: positiveInt(1000),
  // How often the advisory-lock connection heartbeats (single-replica guard).
  ADVISORY_LOCK_HEARTBEAT_MS: positiveInt(30000),
});

type PacerBounds = Pick<
  z.infer<typeof whatsAppSchema>,
  "TYPING_MIN_MS" | "TYPING_MAX_MS" | "LONG_PAUSE_MIN_MS" | "LONG_PAUSE_MAX_MS"
>;

/**
 * Cross-field ordering for the pacer's [min, max] pairs. Each field validates
 * in isolation (.positive()), but an inverted pair (min > max) would silently
 * degrade the pacer — every long pause would collapse to the min. Surface it
 * loudly at startup instead. (The pacer also clamps defensively at runtime.)
 */
export const refineWhatsAppPacing = (
  cfg: PacerBounds,
  ctx: z.RefinementCtx,
): void => {
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
};
