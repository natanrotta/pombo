/**
 * API-token vocabulary for the web module. The wire contract is declared once
 * in `@pombo/shared-types`; these aliases only give it the module's names.
 */
import type {
  ApiTokenMetadataDTO,
  GenerateApiTokenResponseDTO,
} from "@pombo/shared-types";

/** `null` from the API when the account never generated a token. */
export type ApiTokenMetadata = ApiTokenMetadataDTO;
/** Returned once when a token is generated — carries the clear token. */
export type GeneratedApiToken = GenerateApiTokenResponseDTO;
