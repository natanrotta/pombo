import { IUserRepository } from "@modules/user/domain/repository/user-repository.interface";
import { IPasswordResetTokenRepository } from "@modules/auth/domain/repository/password-reset-token-repository.interface";
import { IEmailVerificationPinRepository } from "@modules/auth/domain/repository/email-verification-pin-repository.interface";

type MockOf<T> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any
    ? ReturnType<typeof vi.fn>
    : T[K];
};

export function mockUserRepository(): MockOf<IUserRepository> {
  return {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    findByGoogleId: vi.fn(),
    findByRefreshTokenHash: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    incrementTokenVersion: vi.fn(),
    markEmailVerified: vi.fn(),
    setRefreshTokenHash: vi.fn(),
    clearRefreshToken: vi.fn(),
    setTokenData: vi.fn(),
    updateAvatarUrl: vi.fn(),
    linkGoogleId: vi.fn(),
    signUpTransaction: vi.fn(),
  };
}

export function mockPasswordResetTokenRepository(): MockOf<IPasswordResetTokenRepository> {
  return {
    create: vi.fn(),
    findByTokenHash: vi.fn(),
    markAsUsed: vi.fn(),
    invalidateAllForUser: vi.fn(),
    deleteUnusedForUser: vi.fn(),
  };
}

export function mockEmailVerificationPinRepository(): MockOf<IEmailVerificationPinRepository> {
  return {
    create: vi.fn(),
    findActiveByUserId: vi.fn(),
    incrementAttempts: vi.fn(),
    markAsUsed: vi.fn(),
    deleteUnusedForUser: vi.fn(),
  };
}
