import { inject, injectable } from "tsyringe";
import { DI_TOKENS } from "@core/container/tokens";
import { User } from "@modules/user/domain/entity/user.entity";
import {
  IUserRepository,
  CreateUserData,
  UpdateUserData,
  SignUpTransactionData,
  SignUpTransactionResult,
  SetTokenData,
} from "@modules/user/domain/repository/user-repository.interface";
import type { UserStatus } from "@modules/user/domain/value-object/user-status";
import { PrismaUserRepository } from "./prisma-user-repository";
import type { ICacheProvider } from "@shared/provider/cache-provider.interface";
import type { AppConfig } from "@shared/provider/app-config.interface";
import {
  withCache,
  invalidateCache,
  type CacheCodec,
} from "@shared/util/with-cache";

interface SerializedUser {
  id: string;
  accountId: string;
  name: string;
  email: string;
  password: string | null;
  googleId: string | null;
  status: UserStatus;
  emailVerified: boolean;
  avatarUrl: string | null;
  language: string;
  tokenVersion: number;
  tokenExpiresAt: string | null;
  refreshTokenHash: string | null;
  refreshTokenExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);
const date = (s: string | null): Date | null => (s ? new Date(s) : null);

// FULL parity is intentional: a transparent cache must return an entity
// identical to the DB one whether it hits or misses — nulling fields on a hit
// would create a hit≠miss divergence bug class. `password` (bcrypt) and
// `refreshTokenHash` (SHA-256) are therefore cached; they are HASHES (not
// plaintext), live only in the trusted-internal Redis for ≤TTL, and are NEVER
// logged (R22 — same trust boundary as the device webhookSecret cache).
// findById consumers never read these fields anyway (credentials are resolved
// via the uncached findByEmail / findByRefreshTokenHash).
const userCodec: CacheCodec<User> = {
  serialize: (u): SerializedUser => ({
    id: u.id,
    accountId: u.accountId,
    name: u.name,
    email: u.email,
    password: u.password,
    googleId: u.googleId,
    status: u.status as UserStatus,
    emailVerified: u.emailVerified,
    avatarUrl: u.avatarUrl,
    language: u.language,
    tokenVersion: u.tokenVersion,
    tokenExpiresAt: iso(u.tokenExpiresAt),
    refreshTokenHash: u.refreshTokenHash,
    refreshTokenExpiresAt: iso(u.refreshTokenExpiresAt),
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
    deletedAt: iso(u.deletedAt),
  }),
  deserialize: (raw): User => {
    const r = raw as SerializedUser;
    return new User({
      id: r.id,
      accountId: r.accountId,
      name: r.name,
      email: r.email,
      password: r.password,
      googleId: r.googleId,
      status: r.status,
      emailVerified: r.emailVerified,
      avatarUrl: r.avatarUrl,
      language: r.language,
      tokenVersion: r.tokenVersion,
      tokenExpiresAt: date(r.tokenExpiresAt),
      refreshTokenHash: r.refreshTokenHash,
      refreshTokenExpiresAt: date(r.refreshTokenExpiresAt),
      createdAt: new Date(r.createdAt),
      updatedAt: new Date(r.updatedAt),
      deletedAt: date(r.deletedAt),
    });
  },
};

/**
 * Read-aside cache decorator over `PrismaUserRepository` (BASELINE R8). Caches
 * only `findById` (`user:{id}`) — the authMiddleware path that runs on EVERY
 * JWT request. Every write that mutates the user evicts the key, so a
 * revocation (`incrementTokenVersion` / `softDelete`) is reflected on the next
 * request — the TTL is only a backstop. All other reads delegate. Fail-open.
 */
@injectable()
export class CachedUserRepository implements IUserRepository {
  constructor(
    // Injected as the concrete Prisma repo; typed as the interface so the
    // decorator depends on the port, not the impl (and is trivially faked).
    @inject(PrismaUserRepository)
    private readonly inner: IUserRepository,
    @inject(DI_TOKENS.CacheProvider)
    private readonly cache: ICacheProvider,
    @inject(DI_TOKENS.AppConfig)
    private readonly config: AppConfig,
  ) {}

  private key(id: string): string {
    return `user:${id}`;
  }

  private evict(id: string): Promise<void> {
    return invalidateCache(this.cache, this.key(id));
  }

  findById(id: string): Promise<User | null> {
    return withCache(
      this.cache,
      this.key(id),
      this.config.CACHE_ENTITY_TTL_SECONDS,
      () => this.inner.findById(id),
      userCodec,
    );
  }

  // ── Uncached reads / creates (delegate) ──────────────────────────────────

  findByEmail(email: string): Promise<User | null> {
    return this.inner.findByEmail(email);
  }

  findByGoogleId(googleId: string): Promise<User | null> {
    return this.inner.findByGoogleId(googleId);
  }

  findByRefreshTokenHash(hash: string): Promise<User | null> {
    return this.inner.findByRefreshTokenHash(hash);
  }

  // Creates mint a fresh UUID that was never queried, so no cache entry can
  // exist to evict — pure delegation is correct (and consistent between both
  // create paths).
  create(data: CreateUserData): Promise<User> {
    return this.inner.create(data);
  }

  signUpTransaction(
    data: SignUpTransactionData,
  ): Promise<SignUpTransactionResult> {
    return this.inner.signUpTransaction(data);
  }

  // ── Writes (delegate, then evict) ────────────────────────────────────────
  async update(id: string, data: UpdateUserData): Promise<User> {
    const user = await this.inner.update(id, data);
    await this.evict(id);
    return user;
  }

  async updateAvatarUrl(id: string, avatarUrl: string): Promise<User> {
    const user = await this.inner.updateAvatarUrl(id, avatarUrl);
    await this.evict(id);
    return user;
  }

  async linkGoogleId(
    id: string,
    googleId: string,
    avatarUrl?: string,
  ): Promise<User> {
    const user = await this.inner.linkGoogleId(id, googleId, avatarUrl);
    await this.evict(id);
    return user;
  }

  async incrementTokenVersion(id: string): Promise<void> {
    await this.inner.incrementTokenVersion(id);
    await this.evict(id);
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.inner.markEmailVerified(id);
    await this.evict(id);
  }

  async setTokenData(id: string, data: SetTokenData): Promise<void> {
    await this.inner.setTokenData(id, data);
    await this.evict(id);
  }

  async setRefreshTokenHash(
    id: string,
    hash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.inner.setRefreshTokenHash(id, hash, expiresAt);
    await this.evict(id);
  }

  async clearRefreshToken(id: string): Promise<void> {
    await this.inner.clearRefreshToken(id);
    await this.evict(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.inner.softDelete(id);
    await this.evict(id);
  }
}
