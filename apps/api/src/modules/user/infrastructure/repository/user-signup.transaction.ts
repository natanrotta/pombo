import type {
  SignUpTransactionData,
  SignUpTransactionResult,
} from "@modules/user/domain/repository/user-repository.interface";
import { User } from "@modules/user/domain/entity/user.entity";
import { prisma } from "@core/database/prisma/prisma-client";
import { mapPrismaError } from "@core/database/prisma/prisma-error-mapper";
import { Prisma } from "@generated/prisma/client";
import type { UserStatus } from "@modules/user/domain/value-object/user-status";

/**
 * Provisions the tenant `account` a brand-new user belongs to and returns its
 * id. MVP is 1:1 (account.name = user's name). This is the single source of
 * truth for "how a new user gets an account" — both the signup flow and the
 * admin create flow call it, so any future default (a starter setting, a
 * workspace) is added in one place. Runs inside the caller's transaction so a
 * later failure rolls the account back too.
 */
export async function provisionAccountForUser(
  tx: Prisma.TransactionClient,
  userName: string,
): Promise<string> {
  const account = await tx.account.create({ data: { name: userName } });
  return account.id;
}

/**
 * Atomic signup. Creates the tenant `account` and its first `user` in a single
 * transaction, then returns a fully-hydrated `User` entity so the use case can
 * hand it straight to the profile builder without a follow-up `findById`. MVP:
 * one account per user (account.name = user.name); the model already supports
 * many users per account. If any step fails the whole thing rolls back — a user
 * is never persisted without its account.
 */
export async function executeSignUpTransaction(
  data: SignUpTransactionData,
): Promise<SignUpTransactionResult> {
  try {
    const user = await prisma.$transaction(async (tx) => {
      const accountId = await provisionAccountForUser(tx, data.name);

      return tx.user.create({
        data: {
          account_id: accountId,
          name: data.name,
          email: data.email,
          ...(data.password && { password: data.password }),
          ...(data.googleId && { google_id: data.googleId }),
          ...(data.avatarUrl && { avatar_url: data.avatarUrl }),
          ...(data.language && { language: data.language }),
          status: data.status as "ACTIVE" | "PENDING",
          ...(data.emailVerified !== undefined && {
            email_verified: data.emailVerified,
          }),
          token_expires_at: data.tokenExpiresAt,
          refresh_token_hash: data.refreshTokenHash,
          refresh_token_expires_at: data.refreshTokenExpiresAt,
        },
      });
    });

    const userEntity = new User({
      id: user.id,
      accountId: user.account_id,
      name: user.name,
      email: user.email,
      password: user.password,
      googleId: user.google_id,
      status: user.status as UserStatus,
      emailVerified: user.email_verified,
      avatarUrl: user.avatar_url,
      language: user.language,
      tokenVersion: user.token_version,
      tokenExpiresAt: user.token_expires_at,
      refreshTokenHash: user.refresh_token_hash,
      refreshTokenExpiresAt: user.refresh_token_expires_at,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      deletedAt: user.deleted_at,
    });

    return { user: userEntity };
  } catch (error) {
    throw mapPrismaError(error);
  }
}
