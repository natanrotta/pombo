import { httpClient } from "@/core/http/httpClient";
import type { AccountRepository } from "@/modules/account/domain/repositories/AccountRepository";
import type {
  ApiTokenMetadata,
  GeneratedApiToken,
} from "@/modules/account/domain/entities/ApiToken";

export class HttpAccountRepository implements AccountRepository {
  getApiToken(signal?: AbortSignal): Promise<ApiTokenMetadata | null> {
    return httpClient.get<never, ApiTokenMetadata | null>("/account/api-token", {
      signal,
    });
  }

  generateApiToken(): Promise<GeneratedApiToken> {
    return httpClient.post<never, GeneratedApiToken>("/account/api-token");
  }
}
