import { createHash, randomInt } from "crypto";
import { inject, injectable } from "tsyringe";
import { DI_TOKENS } from "@core/container/tokens";
import { IUserRepository } from "@modules/user/domain/repository/user-repository.interface";
import { IEmailVerificationPinRepository } from "@modules/auth/domain/repository/email-verification-pin-repository.interface";
import { IMailProvider, ILoggerProvider, AppConfig } from "@shared/provider";
import { SendEmailVerificationPinDTO } from "../../dto/auth.dto";
import {
  BadRequestError,
  TooManyRequestsError,
  UnauthorizedError,
} from "@shared/error";
import { ErrorCodes } from "@shared/error/error-codes";
import { renderEmailVerificationPinEmail } from "@modules/auth/application/service/email-verification-pin.template";

/** Seconds a user must wait between PIN sends. Enforced server-side so the
 *  UI countdown can't be bypassed by calling the endpoint directly. */
export const EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS = 60;

/** Number of digits in the PIN. 6 → 1,000,000-code space, paired with the
 *  15-min TTL and the 5-attempt lockout in the verify use case. */
const PIN_DIGITS = 6;

function generatePin(): string {
  // crypto.randomInt is uniform and CSPRNG-backed (unlike Math.random()).
  const max = 10 ** PIN_DIGITS;
  return String(randomInt(0, max)).padStart(PIN_DIGITS, "0");
}

function hashPin(pin: string): string {
  return createHash("sha256").update(pin).digest("hex");
}

/**
 * Issues (or re-issues) a 6-digit e-mail-confirmation PIN and e-mails it to
 * the user. Called once at signup and again on every "resend".
 *
 * Security notes:
 * - The DB stores only the SHA-256 hash of the PIN — a DB leak never reveals
 *   a usable code.
 * - Resend is throttled server-side ({@link EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS});
 *   the UI timer is a convenience, not the gate.
 * - The raw PIN is NEVER logged (B-H12 / R5) — only `userId` is.
 * - `userId` always comes from the verify-email-scoped JWT, never the body.
 */
@injectable()
export class SendEmailVerificationPinUseCase {
  constructor(
    @inject(DI_TOKENS.UserRepository)
    private readonly userRepository: IUserRepository,
    @inject(DI_TOKENS.EmailVerificationPinRepository)
    private readonly pinRepository: IEmailVerificationPinRepository,
    @inject(DI_TOKENS.MailProvider)
    private readonly mailProvider: IMailProvider,
    @inject(DI_TOKENS.LoggerProvider)
    private readonly logger: ILoggerProvider,
    @inject(DI_TOKENS.AppConfig)
    private readonly config: AppConfig,
  ) {}

  async execute(data: SendEmailVerificationPinDTO): Promise<void> {
    const user = await this.userRepository.findById(data.userId);
    if (!user) {
      throw new UnauthorizedError(
        "User not found for verification",
        undefined,
        ErrorCodes.AUTH_TOKEN_INVALID,
      );
    }

    if (user.emailVerified) {
      throw new BadRequestError(
        "Email already verified",
        undefined,
        ErrorCodes.AUTH_EMAIL_ALREADY_VERIFIED,
      );
    }

    // Resend cooldown — reject if the latest PIN was issued too recently.
    const existing = await this.pinRepository.findActiveByUserId(user.id);
    if (existing) {
      const elapsedMs = Date.now() - existing.createdAt.getTime();
      if (elapsedMs < EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS * 1000) {
        throw new TooManyRequestsError(
          "A verification code was just sent. Please wait before requesting another.",
          undefined,
          ErrorCodes.AUTH_EMAIL_VERIFICATION_RATE_LIMITED,
        );
      }
    }

    // Only the newest code is ever valid.
    await this.pinRepository.deleteUnusedForUser(user.id);

    const pin = generatePin();
    const expiresAt = new Date(
      Date.now() + this.config.EMAIL_VERIFICATION_PIN_TTL_MINUTES * 60 * 1000,
    );

    await this.pinRepository.create({
      userId: user.id,
      pinHash: hashPin(pin),
      expiresAt,
    });

    const { subject, html, text } = renderEmailVerificationPinEmail({
      userName: user.name,
      pin,
      ttlMinutes: this.config.EMAIL_VERIFICATION_PIN_TTL_MINUTES,
      logoUrl: `${this.config.FRONTEND_URL.replace(/\/$/, "")}/pombo-icon.svg`,
      locale: user.language,
    });

    await this.mailProvider.send({ to: user.email, subject, html, text });

    this.logger.info({ userId: user.id }, "Email verification PIN sent");
  }
}
