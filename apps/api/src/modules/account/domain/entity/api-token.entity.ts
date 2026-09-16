import type { ApiTokenMetadataDTO } from "@pombo/shared-types";

export interface ApiTokenProps {
  id: string;
  accountId: string;
  /** SHA-256 hash of the raw token. The clear `pmb_…` value is never stored. */
  tokenHash: string;
  /** Display-safe fragment (`pmb_…` + last chars) — never the secret. */
  tokenPrefix: string;
  createdByUserId: string;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

/**
 * A public-API credential owned by an account. Only ever exposed through
 * `toMetadata()` — the raw token and its hash never leave the server after
 * generation (BASELINE R22).
 */
export class ApiToken {
  private readonly props: ApiTokenProps;

  constructor(props: ApiTokenProps) {
    this.props = props;
  }

  get id(): string {
    return this.props.id;
  }

  get accountId(): string {
    return this.props.accountId;
  }

  get tokenPrefix(): string {
    return this.props.tokenPrefix;
  }

  get lastUsedAt(): Date | null {
    return this.props.lastUsedAt;
  }

  get revokedAt(): Date | null {
    return this.props.revokedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  /**
   * Display projection for the settings screen. Carries only the non-secret
   * fragment plus timestamps — never the hash.
   */
  public toMetadata(): ApiTokenMetadataDTO {
    return {
      prefix: this.props.tokenPrefix,
      createdAt: this.props.createdAt.toISOString(),
      lastUsedAt: this.props.lastUsedAt
        ? this.props.lastUsedAt.toISOString()
        : null,
    };
  }
}
