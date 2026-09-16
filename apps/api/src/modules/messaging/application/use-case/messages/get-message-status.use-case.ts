import { inject, injectable } from "tsyringe";
import { DI_TOKENS } from "@core/container/tokens";
import { IOutboxRepository } from "@modules/messaging/domain/repository/outbox-repository.interface";
import { IDevicesRepository } from "@modules/devices/domain/repository/devices-repository.interface";
import type { MessageStatusResponseDTO } from "@pombo/shared-types";
import { NotFoundError } from "@shared/error";
import { ErrorCodes } from "@shared/error/error-codes";

/**
 * The authoritative status of a message. `202` never meant delivered — this is
 * how the consumer polls the real state (the webhook is only a convenience).
 *
 * Tenant-scoped (R1): a message is only visible to the account that owns its
 * device. A cross-account (or unknown) id surfaces as MESSAGE_NOT_FOUND — never
 * a 403 (R3), and the distinction is not leaked.
 */
@injectable()
export class GetMessageStatusUseCase {
  constructor(
    @inject(DI_TOKENS.OutboxRepository)
    private readonly outboxRepository: IOutboxRepository,
    @inject(DI_TOKENS.DevicesRepository)
    private readonly devicesRepository: IDevicesRepository,
  ) {}

  async execute(
    accountId: string,
    id: string,
  ): Promise<MessageStatusResponseDTO> {
    const message = await this.outboxRepository.findById(id);
    // Ownership is resolved through the message's device: if the device is not
    // in the caller's account the message is treated as non-existent.
    const device = message
      ? await this.devicesRepository.findById(accountId, message.deviceId)
      : null;
    if (!message || !device) {
      throw new NotFoundError(
        "Message not found",
        undefined,
        ErrorCodes.MESSAGE_NOT_FOUND,
      );
    }
    return message.toJSON();
  }
}
