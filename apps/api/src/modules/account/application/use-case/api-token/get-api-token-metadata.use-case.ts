import { inject, injectable } from "tsyringe";
import { DI_TOKENS } from "@core/container/tokens";
import { IApiTokenRepository } from "@modules/account/domain/repository/api-token-repository.interface";
import type { ApiTokenMetadataDTO } from "@pombo/shared-types";

/**
 * Reads the account's active API-token metadata for the settings screen.
 * Returns null when the account has never generated a token (the FE renders the
 * empty state). Never exposes the token or its hash — only the display prefix
 * and timestamps (R22).
 */
@injectable()
export class GetApiTokenMetadataUseCase {
  constructor(
    @inject(DI_TOKENS.ApiTokenRepository)
    private readonly apiTokenRepository: IApiTokenRepository,
  ) {}

  async execute(accountId: string): Promise<ApiTokenMetadataDTO | null> {
    const token = await this.apiTokenRepository.findActiveByAccount(accountId);
    return token ? token.toMetadata() : null;
  }
}
