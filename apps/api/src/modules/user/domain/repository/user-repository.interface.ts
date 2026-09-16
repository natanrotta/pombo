import { User } from "../entity/user.entity";

export interface CreateUserData {
  name: string;
  email: string;
  password?: string | null;
  status?: string;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  password?: string;
  status?: string;
  language?: string;
}

/**
 * Atomic shape for the signup flow. Single-user boilerplate: this creates
 * ONLY the user row (no account / membership / professional / onboarding).
 */
export interface SignUpTransactionData {
  name: string;
  email: string;
  password?: string;
  googleId?: string;
  status: string;
  /** Whether the e-mail is already proven. Google signups pass `true`;
   *  email+password self-signup omits it (schema default `false`). */
  emailVerified?: boolean;
  tokenExpiresAt: Date;
  /** SHA-256 hash of the issued refresh token. The raw UUID goes to the
   *  client cookie. */
  refreshTokenHash: string;
  refreshTokenExpiresAt: Date;
  avatarUrl?: string;
  /** Persisted to `user.language`. When omitted the schema default (pt-BR)
   *  wins. */
  language?: string;
}

export interface SignUpTransactionResult {
  /** Fully-hydrated User entity — the use case can pipe this straight into
   *  the profile builder without a follow-up `findById`. */
  user: User;
}

export interface SetTokenData {
  tokenExpiresAt: Date;
  /** SHA-256 hash of the refresh token. */
  refreshTokenHash: string;
  refreshTokenExpiresAt: Date;
}

/**
 * The identity core. Every method is keyed by the user's own primary key and
 * is reached ONLY with an id the caller already owns — `req.auth.userId` from
 * the session JWT, or a `userId` recovered from a token the user was e-mailed
 * (password reset, e-mail PIN). The user IS the subject, so there is no tenant
 * to scope by: a caller can never name another user's id from a request.
 *
 * There is deliberately NO `findAll` / `findByIds` / hard `delete`: a list or
 * batch read of users is a cross-tenant surface by construction (BASELINE R1),
 * and the only removal a user may perform is on themselves (`softDelete`, R2).
 */
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByGoogleId(googleId: string): Promise<User | null>;
  findByRefreshTokenHash(hash: string): Promise<User | null>;
  create(data: CreateUserData): Promise<User>;
  update(id: string, data: UpdateUserData): Promise<User>;
  softDelete(id: string): Promise<void>;
  incrementTokenVersion(id: string): Promise<void>;
  /** Flips `email_verified` to true after a successful PIN confirmation. */
  markEmailVerified(id: string): Promise<void>;
  setRefreshTokenHash(id: string, hash: string, expiresAt: Date): Promise<void>;
  clearRefreshToken(id: string): Promise<void>;
  signUpTransaction(
    data: SignUpTransactionData,
  ): Promise<SignUpTransactionResult>;
  setTokenData(id: string, data: SetTokenData): Promise<void>;
  updateAvatarUrl(id: string, avatarUrl: string): Promise<User>;
  linkGoogleId(id: string, googleId: string, avatarUrl?: string): Promise<User>;
}
