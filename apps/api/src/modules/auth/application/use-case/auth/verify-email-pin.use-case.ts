import { createHash, timingSafeEqual } from "crypto";
import { inject, injectable } from "tsyringe";
import { DI_TOKENS } from "@core/container/tokens";
import { IUserRepository } from "@modules/user/domain/repository/user-repository.interface";
import { IEmailVerificationPinRepository } from "@modules/auth/domain/repository/email-verification-pin-repository.interface";
import { IJwtProvider, ILoggerProvider } from "@shared/provider";
import { AuthResponseDTO, VerifyEmailPinDTO } from "../../dto/auth.dto";
import {
  BadRequestError,
  TooManyRequestsError,
  UnauthorizedError,
} from "@shared/error";
import { ErrorCodes } from "@shared/error/error-codes";
import { AuthProfileBuilder } from "@modules/auth/application/service/auth-profile.builder";

/** Wrong-PIN attempts before the code is locked and the user must resend. */
export const EMAIL_VERIFICATION_MAX_ATTEMPTS = 5;

function hashPin(pin: string): string {
  return createHash("sha256").update(pin).digest("hex");
}

/** Constant-time hash comparison — both inputs are fixed-length hex SHA-256
 *  digests, so the buffers always share length. */
function hashesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Consumes the e-mail-confirmation PIN. On success it flips
 * `user.email_verified` to true and upgrades the verify-email-scoped session
 * into a full session.
 *
 * Security notes:
 * - PIN is matched against the at-rest SHA-256 hash, constant-time.
 * - After {@link EMAIL_VERIFICATION_MAX_ATTEMPTS} wrong tries the code is
 *   locked (rate-limited) and the user must request a new one.
 * - Idempotent: a second verify on an already-verified user re-issues a fresh
 *   session instead of erroring.
 * - `userId` always comes from the verify-email-scoped JWT, never the body.
 */
@injectable()
export class VerifyEmailPinUseCase {
  constructor(
    @inject(DI_TOKENS.UserRepository)
    private readonly userRepository: IUserRepository,
    @inject(DI_TOKENS.EmailVerificationPinRepository)
    private readonly pinRepository: IEmailVerificationPinRepository,
    @inject(DI_TOKENS.JwtProvider)
    private readonly jwtProvider: IJwtProvider,
    @inject(DI_TOKENS.AuthProfileBuilder)
    private readonly profileBuilder: AuthProfileBuilder,
    @inject(DI_TOKENS.LoggerProvider)
    private readonly logger: ILoggerProvider,
  ) {}

  async execute(data: VerifyEmailPinDTO): Promise<AuthResponseDTO> {
    let user = await this.userRepository.findById(data.userId);
    if (!user) {
      throw new UnauthorizedError(
        "User not found for verification",
        undefined,
        ErrorCodes.AUTH_TOKEN_INVALID,
      );
    }

    if (!user.emailVerified) {
      const record = await this.pinRepository.findActiveByUserId(user.id);

      if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
        throw new BadRequestError(
          "Verification code expired or not found",
          undefined,
          ErrorCodes.AUTH_EMAIL_VERIFICATION_PIN_EXPIRED,
        );
      }

      if (record.attempts >= EMAIL_VERIFICATION_MAX_ATTEMPTS) {
        throw new TooManyRequestsError(
          "Too many incorrect attempts. Request a new code.",
          undefined,
          ErrorCodes.AUTH_EMAIL_VERIFICATION_RATE_LIMITED,
        );
      }

      if (!hashesMatch(hashPin(data.pin), record.pinHash)) {
        const attempts = await this.pinRepository.incrementAttempts(record.id);
        this.logger.warn(
          { userId: user.id, attempts },
          "Incorrect email verification PIN attempt",
        );
        if (attempts >= EMAIL_VERIFICATION_MAX_ATTEMPTS) {
          throw new TooManyRequestsError(
            "Too many incorrect attempts. Request a new code.",
            undefined,
            ErrorCodes.AUTH_EMAIL_VERIFICATION_RATE_LIMITED,
          );
        }
        throw new BadRequestError(
          "Invalid verification code",
          undefined,
          ErrorCodes.AUTH_EMAIL_VERIFICATION_PIN_INVALID,
        );
      }

      // Flip verification BEFORE consuming the PIN so a crash between the two
      // writes leaves the user verified (the desired end state).
      await this.userRepository.markEmailVerified(user.id);
      await this.pinRepository.markAsUsed(record.id);
      this.logger.info({ userId: user.id }, "Email verified via PIN");

      const refreshed = await this.userRepository.findById(user.id);
      if (!refreshed) {
        throw new UnauthorizedError(
          "User not found after verification",
          undefined,
          ErrorCodes.AUTH_TOKEN_INVALID,
        );
      }
      user = refreshed;
    }

    const { token, refreshToken, tokenExpiresAt, refreshTokenExpiresAt } =
      this.jwtProvider.generateTokenPair({
        userId: user.id,
        tokenVersion: user.tokenVersion,
      });

    await this.userRepository.setTokenData(user.id, {
      tokenExpiresAt,
      refreshTokenHash: this.jwtProvider.hashRefreshToken(refreshToken),
      refreshTokenExpiresAt,
    });

    return {
      user: this.profileBuilder.buildProfile(user),
      token,
      refreshToken,
    };
  }
}
