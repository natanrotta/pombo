import { inject, injectable } from "tsyringe";
import { DI_TOKENS } from "@core/container/tokens";
import { IOutboxRepository } from "@modules/messaging/domain/repository/outbox-repository.interface";
import type { QueueSummaryResponseDTO } from "@pombo/shared-types";

/**
 * How many messages are queued for the account right now — the counter the
 * device list shows next to registered / online / offline.
 *
 * Tenant-scoped (R1): the count only walks devices of `accountId`.
 */
@injectable()
export class CountQueuedMessagesUseCase {
  constructor(
    @inject(DI_TOKENS.OutboxRepository)
    private readonly outboxRepository: IOutboxRepository,
  ) {}

  async execute(accountId: string): Promise<QueueSummaryResponseDTO> {
    const pending =
      await this.outboxRepository.countQueuedForAccount(accountId);
    return { pending };
  }
}
