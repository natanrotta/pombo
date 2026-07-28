/**
 * Human-like send cadence for a single device (anti-detection). COMPLEMENTS the
 * per-device token bucket (`ISendRateLimiter`), it does not replace it: the
 * bucket is the hard CEILING ("never exceed X/min"), this pacer is the human
 * RHYTHM that normally keeps the effective rate well under that ceiling —
 * content-proportional, jittered gaps plus the "typing…" window, so consecutive
 * sends don't look machine-regular.
 *
 * Pure timing math, no side effects and no per-device state. The caller (roadmap
 * E3, the outbox drain) applies the returned delays and drives the `setTyping`
 * presence. The ~10s `composing` auto-expiry / refresh loop is the caller's
 * concern, not this interface's.
 */
export interface ISendPacer {
  /**
   * How long to show "typing…" before sending a message of `textLength`
   * characters: base (`textLength × ms-per-char`) with ± jitter, clamped to
   * [min, max]. Longer text ⇒ longer typing, so the indicator matches the
   * message — a fixed tiny delay before a long message is a bot tell.
   */
  typingDelayMs(textLength: number): number;
  /**
   * An occasional "coffee-break" pause to insert BETWEEN messages, in ms.
   * Returns 0 most of the time; with the configured probability, a random value
   * in [longPauseMin, longPauseMax]. Per-message jitter alone stays statistically
   * regular in aggregate — the rare long gap is what breaks that pattern.
   */
  longPauseMs(): number;
}
