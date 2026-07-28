import { inject, injectable } from "tsyringe";
import { DI_TOKENS } from "@core/container/tokens";
import { IDevicesRepository } from "@modules/devices/domain/repository/devices-repository.interface";
import { IWhatsAppGateway } from "@modules/devices/domain/provider/whatsapp-gateway.interface";
import { IOutboxRepository } from "@modules/messaging/domain/repository/outbox-repository.interface";
import { type MessageStatus } from "@modules/messaging/domain/value-object/message-status";
import { AppConfig } from "@shared/provider/app-config.interface";
import type { IDomainEventBus } from "@shared/provider/domain-event-bus.interface";
import type { ISendRateLimiter } from "@modules/messaging/domain/provider/send-rate-limiter.interface";
import { ConflictError, NotFoundError } from "@shared/error";
import { ErrorCodes } from "@shared/error/error-codes";
import { SendTextInput } from "@modules/messaging/application/dto/message.dto";
import {
  buildUserJid,
  buildGroupJid,
} from "@modules/messaging/domain/value-object/wa-jid";
import { DrainOutboxUseCase } from "./drain-outbox.use-case";

export interface SendTextOutput {
  messageId: string;
  status: MessageStatus;
}

/**
 * The core send path. `202` means accepted — NOT delivered. The message goes
 * out immediately only if the device is online AND under its per-device send
 * budget; otherwise (offline, socket drops mid-send, or over the rate limit)
 * the row is left QUEUED and the drain sends it later — offline waits for
 * `session.connected`, over-budget is kicked to the drain now. Still a 202
 * either way. The outbox row is written BEFORE the send so getMessage can answer
 * a resend. Idempotency is the DB unique's job, with a code fast-path for the
 * common sequential replay.
 */
@injectable()
export class SendTextMessageUseCase {
  constructor(
    @inject(DI_TOKENS.DevicesRepository)
    private readonly devicesRepository: IDevicesRepository,
    @inject(DI_TOKENS.OutboxRepository)
    private readonly outboxRepository: IOutboxRepository,
    @inject(DI_TOKENS.WhatsAppGateway)
    private readonly gateway: IWhatsAppGateway,
    @inject(DI_TOKENS.AppConfig)
    private readonly config: AppConfig,
    @inject(DI_TOKENS.DomainEventBus)
    private readonly bus: IDomainEventBus,
    @inject(DI_TOKENS.SendRateLimiter)
    private readonly rateLimiter: ISendRateLimiter,
    @inject(DrainOutboxUseCase)
    private readonly drainOutbox: DrainOutboxUseCase,
  ) {}

  async execute(input: SendTextInput): Promise<SendTextOutput> {
    const device = await this.devicesRepository.findById(
      input.accountId,
      input.deviceId,
    );
    if (!device) {
      throw new NotFoundError(
        "Device not found",
        undefined,
        ErrorCodes.DEVICE_NOT_FOUND,
      );
    }
    // Exactly one recipient is set (compile-enforced by the SendTextInput union).
    // The recipient carried on the `message.sent` event is the phone for a user
    // send or the group JID for a group send.
    const recipient = input.groupJid ?? input.phone!;
    const existing = await this.outboxRepository.findByIdempotencyKey(
      device.id,
      input.idempotencyKey,
    );
    if (existing) {
      if (existing.text !== input.text) {
        throw new ConflictError(
          "This Idempotency-Key was already used with a different payload",
          undefined,
          ErrorCodes.IDEMPOTENCY_KEY_CONFLICT,
        );
      }
      // Replay the ORIGINAL 202: always PENDING. The real status is
      // GET /messages/:id.
      return { messageId: existing.id, status: "PENDING" };
    }

    // Group: the JID is canonical (`<id>@g.us`) — no `onWhatsApp` (a user-only
    // lookup), online or offline. User online: resolve + validate the JID via
    // WhatsApp (immediate "not on WhatsApp" feedback). User offline: construct it
    // and defer that check to the drain — enqueue now, send on reconnect.
    const online = this.gateway.isConnected(device.id);
    let jid: string;
    if (input.groupJid != null) {
      jid = buildGroupJid(input.groupJid);
    } else if (online) {
      const resolved = await this.gateway.resolveJid(device.id, input.phone);
      if (!resolved) {
        throw new NotFoundError(
          "This number is not on WhatsApp",
          undefined,
          ErrorCodes.NUMBER_NOT_ON_WHATSAPP,
        );
      }
      jid = resolved;
    } else {
      jid = buildUserJid(input.phone);
    }

    const expiresAt = new Date(
      Date.now() + this.config.OUTBOX_TTL_HOURS * 60 * 60 * 1000,
    );

    let message;
    try {
      message = await this.outboxRepository.create({
        deviceId: device.id,
        idempotencyKey: input.idempotencyKey,
        toJid: jid,
        text: input.text,
        expiresAt,
      });
    } catch (error) {
      // Lost a concurrent race on the same key: the winner already created it.
      if (
        error instanceof ConflictError &&
        error.code === ErrorCodes.IDEMPOTENCY_KEY_CONFLICT
      ) {
        const winner = await this.outboxRepository.findByIdempotencyKey(
          device.id,
          input.idempotencyKey,
        );
        if (winner && winner.text === input.text) {
          return { messageId: winner.id, status: "PENDING" };
        }
      }
      throw error;
    }

    // Offline → the row is queued; the drain sends it on reconnect. 202 now.
    if (!online) {
      return { messageId: message.id, status: "PENDING" };
    }

    // Over the per-device send budget → queue it (don't send now) and kick the
    // drain, which paces itself on the same rate limiter and sends it once the
    // budget frees. Single-flight, so this joins a running drain or starts one.
    if (!this.rateLimiter.tryConsume(device.id)) {
      // fire-and-forget; the drain has its own try/finally and never throws, but
      // .catch keeps the contract explicit against future changes.
      void this.drainOutbox.execute({ deviceId: device.id }).catch(() => {});
      return { messageId: message.id, status: "PENDING" };
    }

    let waMessageId: string;
    try {
      ({ waMessageId } = await this.gateway.sendText(
        device.id,
        jid,
        input.text,
      ));
    } catch (error) {
      // The socket dropped between the readiness check and the send: keep the
      // row QUEUED (unsent) so the drain resends it on reconnect — a blip must
      // not fail the send. A real send error (still connected) is terminal →
      // FAILED so the consumer sees it via GET. (Narrow race: if the socket
      // drops and reconnects between the throw and this check, a non-delivered
      // message is marked FAILED instead of queued — vanishingly rare, and the
      // consumer can retry.)
      if (!this.gateway.isConnected(device.id)) {
        return { messageId: message.id, status: "PENDING" };
      }
      try {
        await this.outboxRepository.updateStatus(
          message.id,
          "FAILED",
          "send failed",
        );
      } catch {
        // swallow — never mask the original error below
      }
      throw error;
    }

    // The gateway ACCEPTED the send — the message went out (spec §7.2: publish
    // "após aceite do gateway"). Signal it (webhooks → on_send; no text, only
    // messageId + phone — decisão #6) BEFORE the waMessageId stamp, so a stamp
    // failure can't suppress the event or flip a delivered message to FAILED.
    this.bus.publish({
      type: "message.sent",
      deviceId: device.id,
      messageId: message.id,
      phone: recipient,
    });
    // Stamp the waMessageId (bookkeeping for a getMessage resend). The message
    // already delivered, so a stamp failure must NOT turn the caller's 202 into
    // a 500. It also must NOT leave the row PENDING with no waMessageId — the
    // reconnect drain would re-send it. Move it to SERVER_ACK (truthful: the
    // gateway accepted it) so it's out of the queue. Best-effort throughout.
    try {
      await this.outboxRepository.setWaMessageId(message.id, waMessageId);
    } catch {
      await this.outboxRepository
        .updateStatus(message.id, "SERVER_ACK")
        .catch(() => {
          // swallow — the send already succeeded; never fail the caller here
        });
    }
    return { messageId: message.id, status: "PENDING" };
  }
}
