import { ISendPacer } from "@modules/messaging/domain/provider/send-pacer.interface";

/**
 * The human pacer (see {@link ISendPacer}). Pure and deterministic given its
 * inputs: all randomness flows through the injected `random` (default
 * `Math.random`), exactly like `TokenBucketSendRateLimiter` injects `now` — so
 * every delay is unit-testable without real RNG. Holds no per-device state, so a
 * single shared instance is safe.
 *
 * It does NOT enforce a rate — that's the token bucket's job (the ceiling). This
 * only shapes the human rhythm below that ceiling.
 */
export class HumanSendPacer implements ISendPacer {
  constructor(
    private readonly msPerChar: number,
    private readonly minMs: number,
    private readonly maxMs: number,
    private readonly jitterPct: number,
    private readonly longPauseProbability: number,
    private readonly longPauseMinMs: number,
    private readonly longPauseMaxMs: number,
    private readonly random: () => number = () => Math.random(),
  ) {}

  typingDelayMs(textLength: number): number {
    const base = Math.max(0, textLength) * this.msPerChar;
    // Jitter factor in [1 - jitterPct, 1 + jitterPct].
    const factor = 1 + (this.random() * 2 - 1) * this.jitterPct;
    const jittered = base * factor;
    return Math.round(Math.min(this.maxMs, Math.max(this.minMs, jittered)));
  }

  longPauseMs(): number {
    // Two draws, IN THIS ORDER: (1) the probability gate, (2) the value within
    // the range. Tests enqueue the random values accordingly.
    if (this.random() >= this.longPauseProbability) return 0;
    // `Math.max(0, …)` guards a min > max misconfig. The env superRefine already
    // rejects that on the config path; this stays for direct construction (tests)
    // — don't remove it thinking it's dead.
    const span = Math.max(0, this.longPauseMaxMs - this.longPauseMinMs);
    return Math.round(this.longPauseMinMs + this.random() * span);
  }
}
