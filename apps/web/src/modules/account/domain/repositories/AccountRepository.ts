import type {
  ApiTokenMetadata,
  GeneratedApiToken,
} from "@/modules/account/domain/entities/ApiToken";

export interface AccountRepository {
  /** The account's active API-token metadata, or null if never generated. */
  getApiToken(signal?: AbortSignal): Promise<ApiTokenMetadata | null>;
  /** Generates a new token (revokes the previous). The clear token is returned
   *  exactly once. */
  generateApiToken(): Promise<GeneratedApiToken>;
}
