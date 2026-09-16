import { type UserStatus } from "../value-object/user-status";

export interface UserProps {
  id: string;
  /** The tenant this user belongs to (BASELINE R1). Set at signup. */
  accountId: string;
  name: string;
  email: string;
  /** Nullable for Google-only users, who authenticate via `googleId`. */
  password: string | null;
  googleId: string | null;
  status: UserStatus;
  /** Whether the user proved control of their e-mail. Email+password
   *  self-signups start `false` (gated behind the PIN-confirmation step);
   *  Google signups start `true`. */
  emailVerified: boolean;
  avatarUrl: string | null;
  language: string;
  tokenVersion: number;
  tokenExpiresAt: Date | null;
  /** SHA-256 hash of the active refresh token. The raw UUID only lives in the
   *  client's httpOnly cookie. */
  refreshTokenHash: string | null;
  refreshTokenExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export class User {
  private readonly props: UserProps;

  constructor(props: UserProps) {
    this.props = props;
  }

  get id(): string {
    return this.props.id;
  }

  get accountId(): string {
    return this.props.accountId;
  }

  get name(): string {
    return this.props.name;
  }

  get email(): string {
    return this.props.email;
  }

  get password(): string | null {
    return this.props.password;
  }

  get googleId(): string | null {
    return this.props.googleId;
  }

  get status(): UserStatus {
    return this.props.status;
  }

  /** The only status allowed to hold a session (see `user-status.ts`). */
  get isActive(): boolean {
    return this.props.status === "ACTIVE";
  }

  get emailVerified(): boolean {
    return this.props.emailVerified;
  }

  get avatarUrl(): string | null {
    return this.props.avatarUrl;
  }

  get language(): string {
    return this.props.language;
  }

  get tokenVersion(): number {
    return this.props.tokenVersion;
  }

  get tokenExpiresAt(): Date | null {
    return this.props.tokenExpiresAt;
  }

  get refreshTokenHash(): string | null {
    return this.props.refreshTokenHash;
  }

  get refreshTokenExpiresAt(): Date | null {
    return this.props.refreshTokenExpiresAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }

  /**
   * Wire-format projection. ISO-string timestamps. Sensitive fields
   * (password, googleId, refresh tokens, tokenVersion) intentionally
   * omitted. Matches `MeResponseDTO` in `@pombo/shared-types`.
   */
  public toJSON() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      status: this.status,
      emailVerified: this.emailVerified,
      avatarUrl: this.avatarUrl,
      language: this.language,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
