import { inject, injectable } from "tsyringe";
import { DI_TOKENS } from "@core/container/tokens";
import { IDevicesRepository } from "@modules/devices/domain/repository/devices-repository.interface";
import { IWhatsAppGateway } from "@modules/devices/domain/provider/whatsapp-gateway.interface";
import { IOutboxRepository } from "@modules/messaging/domain/repository/outbox-repository.interface";
import { type MessageStatus } from "@modules/messaging/domain/value-object/message-status";
import { AppConfig } from "@shared/provider/app-config.interface";
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
 * The core send path. `202` means accepted — NOT delivered. Every send is
 * written to the outbox and handed to the drain, which owns the single physical
 * send path (rate-limit ceiling + human pacing): online kicks the drain now,
 * offline waits for the `session.connected` reconnect drain. The row is written
 * BEFORE the kick so getMessage can answer a resend. Idempotency is the DB
 * unique's job, with a code fast-path for the common sequential replay. The only
 * synchronous WhatsApp call left here is `resolveJid` — the "not on WhatsApp"
 * 404 the caller expects immediately.
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

    // 202 = accepted. The send itself belongs ENTIRELY to the drain (paced +
    // humanized — one code path for how a message physically goes out): online
    // kicks the drain now (single-flight — joins or starts a running drain);
    // offline waits for the `session.connected` reconnect drain. resolveJid above
    // already gave the caller the synchronous "not on WhatsApp" 404.
    if (online) {
      // fire-and-forget; the drain has its own try/finally and never throws, but
      // .catch keeps the contract explicit against future changes.
      void this.drainOutbox.execute({ deviceId: device.id }).catch(() => {});
    }
    return { messageId: message.id, status: "PENDING" };
  }
}
