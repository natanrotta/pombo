// ------------------------------------------------------------------
// Account — public API token. One active `pmb_…` token per account; generating
// a new one revokes the previous in the same transaction.
// ------------------------------------------------------------------

/** `GET /account/api-token` — `null` when the account never generated one. */
export interface ApiTokenMetadataDTO {
  /** Display-safe fragment (`pmb_abcd…wxyz`) — never the secret. */
  prefix: string;
  createdAt: string;
  /** Refreshed on a cache miss only, so it lags by up to the cache TTL. */
  lastUsedAt: string | null;
}

/** `POST /account/api-token` 201 — the only time the clear token exists
 *  outside its hash. */
export interface GenerateApiTokenResponseDTO {
  token: string;
}
