import { inject, injectable } from "tsyringe";
import { DI_TOKENS } from "@core/container/tokens";
import { IOutboxRepository } from "@modules/messaging/domain/repository/outbox-repository.interface";
import { OutboxMessage } from "@modules/messaging/domain/entity/outbox-message.entity";
import { IWhatsAppGateway } from "@modules/devices/domain/provider/whatsapp-gateway.interface";
import {
  userJidToPhone,
  isGroupJid,
} from "@modules/messaging/domain/value-object/wa-jid";
import type { ISendRateLimiter } from "@modules/messaging/domain/provider/send-rate-limiter.interface";
import type { ISendPacer } from "@modules/messaging/domain/provider/send-pacer.interface";
import type { IDomainEventBus } from "@shared/provider/domain-event-bus.interface";
import type { AppConfig } from "@shared/provider/app-config.interface";
import type { ILoggerProvider } from "@shared/provider/logger-provider.interface";
import { dispatchOutboxSend } from "./outbox-send-dispatch";

export interface DrainOutboxInput {
  deviceId: string;
}

// Rows loaded (and sent) per query round, so a device with a huge backlog never
// loads it all into memory — the loop re-queries until the queue is empty.
const DRAIN_BATCH_SIZE = 200;

// Re-emit `composing` on this cadence during a long typing window: WhatsApp
// auto-expires the "typing…" indicator after ~10s, so refresh below that.
const COMPOSING_REFRESH_MS = 8000;

// unref so a pending pacing delay never blocks graceful shutdown.
const delay = (ms: number): Promise<void> =>
  ms > 0
    ? new Promise<void>((resolve) => {
        setTimeout(resolve, ms).unref();
      })
    : Promise.resolve();

const errText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// The outcome of draining a single row, driving the loop.
type SendOutcome = "sent" | "failed" | "dropped";

/**
 * Sends messages queued in the outbox. Post-E4 this is the SINGLE physical send
 * path: triggered on `session.connected` (the reconnect drain) AND by every
 * online send (a fire-and-forget kick after the row is written). FIFO, in bounded
 * batches, PACED BY THE RATE LIMITER (it waits for a send token before each
 * message) and optionally humanized (typing + jitter), and it STOPS the moment
 * the device drops again. Single-flight per device via the `draining` guard so the same row is
 * never sent twice — which is why this use case MUST be a container singleton
 * (a transient instance would reset the guard every event). A kick that lands
 * mid-drain arms `rerun` so the running drain does one more pass — no lost
 * wakeups now that E4 routes every online send through this kick.
 */
@injectable()
export class DrainOutboxUseCase {
  private readonly draining = new Set<string>();
  // Set when a kick collides with an in-progress drain (single-flight). The
  // running drain consumes it and does another findQueued pass, so a row enqueued
  // after that drain's last query — its own kick collapsed by the guard — is
  // never left unsent. Cleared before each query and in finally.
  private readonly rerun = new Set<string>();

  constructor(
    @inject(DI_TOKENS.OutboxRepository)
    private readonly outboxRepository: IOutboxRepository,
    @inject(DI_TOKENS.WhatsAppGateway)
    private readonly gateway: IWhatsAppGateway,
    @inject(DI_TOKENS.DomainEventBus)
    private readonly bus: IDomainEventBus,
    @inject(DI_TOKENS.SendRateLimiter)
    private readonly rateLimiter: ISendRateLimiter,
    @inject(DI_TOKENS.LoggerProvider)
    private readonly logger: ILoggerProvider,
    @inject(DI_TOKENS.SendPacer)
    private readonly pacer: ISendPacer,
    @inject(DI_TOKENS.AppConfig)
    private readonly config: AppConfig,
  ) {}

  async execute(input: DrainOutboxInput): Promise<void> {
    const { deviceId } = input;
    // Single-flight per device. A colliding kick arms `rerun` instead of a bare
    // no-op, so the running drain re-checks the queue after its current pass.
    if (this.draining.has(deviceId)) {
      this.rerun.add(deviceId);
      return;
    }
    this.draining.add(deviceId);
    try {
      let logged = false;
      for (;;) {
        if (!this.gateway.isConnected(deviceId)) break;
        // Consume any pending re-run signal before querying: a kick landing
        // during/after this query re-arms it and is caught by the break checks.
        this.rerun.delete(deviceId);
        const batch = await this.outboxRepository.findQueued(
          deviceId,
          DRAIN_BATCH_SIZE,
        );
        if (batch.length === 0) {
          // Queue drained — re-query once more only if a kick landed this pass.
          if (this.rerun.has(deviceId)) continue;
          break;
        }
        if (!logged) {
          // Triggered by session.connected OR by a rate-limited live send, so
          // don't claim "reconnect" here.
          this.logger.info(
            { deviceId, count: batch.length },
            "draining outbox",
          );
          logged = true;
        }

        let dropped = false;
        for (const [index, message] of batch.entries()) {
          // Consume a send token (the rate limiter is the anti-ban CEILING).
          // Returns false if the device dropped while waiting → stop the drain.
          // INVARIANT: the token is consumed HERE, before the typing window, so
          // it's held for the whole paceTyping duration rather than released at
          // the socket write. Deliberately conservative — a concurrent live send
          // on the same device then draws from a MORE-depleted bucket, never a
          // fuller one — and safe because the single-flight `draining` guard keeps
          // this drain from re-entering (E4 routes every online send through this
          // kick; the `rerun` re-arm keeps that safe). A future step may reorder
          // this consume to just before the socket write if the hold matters.
          if (!(await this.waitForToken(deviceId))) {
            dropped = true;
            break;
          }
          // Human pacing (flagged): show "typing…" for a content-proportional,
          // jittered window before the send. Best-effort — a drop is caught by
          // sendOne below, which stops the drain.
          if (this.config.HUMAN_PACING_ENABLED) {
            await this.paceTyping(deviceId, message);
          }
          const outcome = await this.sendOne(deviceId, message);
          if (outcome === "dropped") {
            dropped = true;
            break;
          }
          // Occasionally insert a longer "coffee-break" pause BETWEEN messages —
          // per-message jitter alone stays statistically regular in aggregate; the
          // rare long gap breaks that pattern. Skip it after the last row in the
          // batch: there's nothing to pace against, and it would otherwise hold
          // the single-flight guard for up to LONG_PAUSE_MAX_MS after the queue
          // drains (a reconnect in that window would no-op).
          const isLastInBatch = index === batch.length - 1;
          if (
            this.config.HUMAN_PACING_ENABLED &&
            outcome === "sent" &&
            !isLastInBatch
          ) {
            const pauseMs = this.pacer.longPauseMs();
            if (pauseMs > 0 && this.gateway.isConnected(deviceId)) {
              await delay(pauseMs);
            }
          }
        }

        // Stop on a drop. Otherwise re-query if the batch was full (more may
        // exist) OR a kick landed this pass (rerun) — else the queue is drained.
        // The `!rerun.has` clause is only reached for a partial batch; a full
        // batch always re-queries regardless of rerun.
        if (dropped) break;
        if (batch.length < DRAIN_BATCH_SIZE && !this.rerun.has(deviceId)) break;
      }
    } finally {
      this.draining.delete(deviceId);
      this.rerun.delete(deviceId);
    }
  }

  /** Show "typing…" for a content-proportional, jittered window before the send.
   *  Re-emits `composing` every COMPOSING_REFRESH_MS so WhatsApp's ~10s auto-expiry
   *  doesn't clear it mid-wait. Presence is best-effort (setTyping no-ops on a
   *  dropped socket), so a drop needs no guard here — the subsequent send catches
   *  it. The waits are unref'd, so a long typing window never blocks shutdown. */
  private async paceTyping(
    deviceId: string,
    message: OutboxMessage,
  ): Promise<void> {
    // Media rows have no text → length 0 → the pacer clamps to TYPING_MIN_MS.
    let remaining = this.pacer.typingDelayMs(message.text?.length ?? 0);
    // do-while: always emit `composing` at least once before the send, even when
    // the duration is 0 (delay(0) is a no-op — the emit is the signal, not the
    // wait). Don't switch to `while`: it would skip the emit for a 0 duration.
    do {
      await this.gateway.setTyping(deviceId, message.toJid, true).catch(() => {
        // presence failures must never break the drain
      });
      const slice = Math.min(remaining, COMPOSING_REFRESH_MS);
      await delay(slice);
      remaining -= slice;
    } while (remaining > 0);
  }

  /** Block until a send token is available for the device, pacing via the rate
   *  limiter. Returns false if the device dropped while waiting (caller stops).
   *  Consumes the token on success — the caller sends exactly once after. */
  private async waitForToken(deviceId: string): Promise<boolean> {
    for (;;) {
      if (!this.gateway.isConnected(deviceId)) return false;
      if (this.rateLimiter.tryConsume(deviceId)) return true;
      // Floor the wait so a 0/near-0 remaining (clock-resolution race) can't
      // busy-spin; it never adds meaningful latency at real send rates.
      await delay(Math.max(this.rateLimiter.msUntilNextToken(deviceId), 25));
    }
  }

  /** Send one queued row. Every non-`dropped` outcome moves the row OUT of the
   *  `findQueued` set (sent → stamped or SERVER_ACK; failed → FAILED), so the
   *  loop always makes progress and a re-query can't pick it up twice. */
  private async sendOne(
    deviceId: string,
    message: OutboxMessage,
  ): Promise<SendOutcome> {
    let waMessageId: string;
    try {
      // Dispatch by the row's type so a queued image is replayed as an image,
      // never re-sent as text (same helper the live send path uses).
      ({ waMessageId } = await dispatchOutboxSend(
        this.gateway,
        deviceId,
        message,
      ));
    } catch (error) {
      // Socket dropped mid-send → leave it queued for the next reconnect.
      // A real send error (still connected) is terminal → FAILED.
      if (!this.gateway.isConnected(deviceId)) return "dropped";
      this.logger.warn(
        { deviceId, messageId: message.id, err: errText(error) },
        "drain send failed",
      );
      await this.outboxRepository
        .updateStatus(message.id, "FAILED", "drain send failed")
        .catch(() => {
          // a bookkeeping failure must not abort the rest of the drain
        });
      return "failed";
    }

    // Delivered. Signal BEFORE the stamp so a stamp failure can't suppress the
    // webhook — same ordering as the live send path.
    this.bus.publish({
      type: "message.sent",
      deviceId,
      messageId: message.id,
      // Match the live send path's recipient: a group JID rides as-is (it isn't
      // a phone), a user JID is reduced back to its phone digits.
      phone: isGroupJid(message.toJid)
        ? message.toJid
        : userJidToPhone(message.toJid),
    });
    try {
      await this.outboxRepository.setWaMessageId(message.id, waMessageId);
    } catch (error) {
      // The message WENT OUT but we couldn't record its waMessageId. It must
      // NOT stay PENDING (the next drain would re-send it) and must NOT be
      // FAILED (it was delivered). Move it to SERVER_ACK — truthful (the gateway
      // accepted it) and out of the queue. Best-effort; a double DB failure is
      // the only way it lingers, and the next findQueued would fail too.
      this.logger.warn(
        { deviceId, messageId: message.id, err: errText(error) },
        "drain stamp failed (message already sent)",
      );
      await this.outboxRepository
        .updateStatus(message.id, "SERVER_ACK")
        .catch(() => {});
    }
    return "sent";
  }
}
