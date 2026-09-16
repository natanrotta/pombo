import { injectable } from "tsyringe";
import { User } from "@modules/user/domain/entity/user.entity";
import {
  IUserRepository,
  CreateUserData,
  UpdateUserData,
  SignUpTransactionData,
  SignUpTransactionResult,
  SetTokenData,
} from "@modules/user/domain/repository/user-repository.interface";
import { prisma } from "@core/database/prisma/prisma-client";
import { mapPrismaError } from "@core/database/prisma/prisma-error-mapper";
import {
  executeSignUpTransaction,
  provisionAccountForUser,
} from "./user-signup.transaction";
import { user as PrismaUser } from "@generated/prisma/client";
import type { UserStatus } from "@modules/user/domain/value-object/user-status";

@injectable()
export class PrismaUserRepository implements IUserRepository {
  private toEntity(data: PrismaUser): User {
    return new User({
      id: data.id,
      accountId: data.account_id,
      name: data.name,
      email: data.email,
      password: data.password,
      googleId: data.google_id,
      status: data.status as UserStatus,
      emailVerified: data.email_verified,
      avatarUrl: data.avatar_url,
      language: data.language,
      tokenVersion: data.token_version,
      tokenExpiresAt: data.token_expires_at,
      refreshTokenHash: data.refresh_token_hash,
      refreshTokenExpiresAt: data.refresh_token_expires_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      deletedAt: data.deleted_at,
    });
  }

  async findById(id: string): Promise<User | null> {
    try {
      // Soft delete is the default (R2): a soft-deleted user is not found. This
      // also keeps the read-aside cache from ever holding a deleted user.
      const user = await prisma.user.findFirst({
        where: { id, deleted_at: null },
      });
      return user ? this.toEntity(user) : null;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      return user ? this.toEntity(user) : null;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { google_id: googleId },
      });
      return user ? this.toEntity(user) : null;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async findByRefreshTokenHash(hash: string): Promise<User | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { refresh_token_hash: hash },
      });
      return user ? this.toEntity(user) : null;
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async create(data: CreateUserData): Promise<User> {
    try {
      // Every user belongs to an account (BASELINE R1). MVP is 1:1 — this
      // admin-create path shares the account provisioning with signup.
      const user = await prisma.$transaction(async (tx) => {
        const accountId = await provisionAccountForUser(tx, data.name);
        return tx.user.create({
          data: {
            account_id: accountId,
            name: data.name,
            email: data.email,
            password: data.password ?? null,
            status: data.status as "ACTIVE" | "PENDING" | undefined,
          },
        });
      });
      return this.toEntity(user);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async update(id: string, data: UpdateUserData): Promise<User> {
    try {
      const user = await prisma.user.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.email !== undefined && { email: data.email }),
          ...(data.password !== undefined && { password: data.password }),
          ...(data.status !== undefined && {
            status: data.status as "ACTIVE" | "PENDING",
          }),
          ...(data.language !== undefined && { language: data.language }),
        },
      });
      return this.toEntity(user);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async softDelete(id: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { id },
        data: {
          deleted_at: new Date(),
          refresh_token_hash: null,
          refresh_token_expires_at: null,
          token_version: { increment: 1 },
        },
      });
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async incrementTokenVersion(id: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { id },
        data: { token_version: { increment: 1 } },
      });
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async markEmailVerified(id: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { id },
        data: { email_verified: true },
      });
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async setRefreshTokenHash(
    id: string,
    hash: string,
    expiresAt: Date,
  ): Promise<void> {
    try {
      await prisma.user.update({
        where: { id },
        data: { refresh_token_hash: hash, refresh_token_expires_at: expiresAt },
      });
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async clearRefreshToken(id: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { id },
        data: { refresh_token_hash: null, refresh_token_expires_at: null },
      });
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async signUpTransaction(
    data: SignUpTransactionData,
  ): Promise<SignUpTransactionResult> {
    return executeSignUpTransaction(data);
  }

  async setTokenData(id: string, data: SetTokenData): Promise<void> {
    try {
      await prisma.user.update({
        where: { id },
        data: {
          token_expires_at: data.tokenExpiresAt,
          refresh_token_hash: data.refreshTokenHash,
          refresh_token_expires_at: data.refreshTokenExpiresAt,
        },
      });
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async updateAvatarUrl(id: string, avatarUrl: string): Promise<User> {
    try {
      const user = await prisma.user.update({
        where: { id },
        data: { avatar_url: avatarUrl },
      });
      return this.toEntity(user);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async linkGoogleId(
    id: string,
    googleId: string,
    avatarUrl?: string,
  ): Promise<User> {
    try {
      const user = await prisma.user.update({
        where: { id },
        data: {
          google_id: googleId,
          ...(avatarUrl && { avatar_url: avatarUrl }),
        },
      });
      return this.toEntity(user);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }
}
