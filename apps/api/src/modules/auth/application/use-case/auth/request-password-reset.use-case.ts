import { randomBytes, createHash } from "crypto";
import { inject, injectable } from "tsyringe";
import { DI_TOKENS } from "@core/container/tokens";
import { IUserRepository } from "@modules/user/domain/repository/user-repository.interface";
import { IPasswordResetTokenRepository } from "@modules/auth/domain/repository/password-reset-token-repository.interface";
import { IMailProvider, ILoggerProvider, AppConfig } from "@shared/provider";
import { RequestPasswordResetDTO } from "../../dto/auth.dto";
import { renderPasswordResetEmail } from "@modules/auth/application/service/password-reset-email.template";

/**
 * Requests a password-reset link via email.
 *
 * Security notes:
 * - Always resolves successfully, even when the email is unknown / the user
 *   has no password / is inactive. This prevents account-enumeration attacks
 *   through response shape or timing.
 * - The raw token is only sent in the email. The DB stores a SHA-256 hash,
 *   so even a DB leak does not allow attackers to forge resets.
 * - Previous unused tokens for the same user are invalidated so only the
 *   latest link is ever usable.
 */
@injectable()
export class RequestPasswordResetUseCase {
  constructor(
    @inject(DI_TOKENS.UserRepository)
    private readonly userRepository: IUserRepository,
    @inject(DI_TOKENS.PasswordResetTokenRepository)
    private readonly tokenRepository: IPasswordResetTokenRepository,
    @inject(DI_TOKENS.MailProvider)
    private readonly mailProvider: IMailProvider,
    @inject(DI_TOKENS.LoggerProvider)
    private readonly logger: ILoggerProvider,
    @inject(DI_TOKENS.AppConfig)
    private readonly config: AppConfig,
  ) {}

  async execute(data: RequestPasswordResetDTO): Promise<void> {
    const user = await this.userRepository.findByEmail(data.email);

    if (!user || !user.password || !user.isActive) {
      // Silently succeed to avoid leaking whether the account exists. The
      // address itself is PII and must not reach the logs either (SEC-C7) —
      // the reason is enough to correlate an incident.
      this.logger.info(
        {
          reason: !user
            ? "unknown-email"
            : !user.password
              ? "no-password"
              : "inactive",
        },
        "Password reset requested for non-eligible account (noop)",
      );
      return;
    }

    // Drop any previously-issued tokens so only the newest link is valid.
    // Using delete (not markAsUsed) means a subsequent attempt with an old
    // link surfaces as INVALID ("link inválido — solicite um novo") instead
    // of USED, which is a clearer UX (the old token was never actually used).
    await this.tokenRepository.deleteUnusedForUser(user.id);

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(
      Date.now() + this.config.PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000,
    );

    await this.tokenRepository.create({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    const frontendBaseUrl = this.config.FRONTEND_URL.replace(/\/$/, "");
    const resetUrl = `${frontendBaseUrl}/reset-password?token=${rawToken}`;

    const { subject, html, text } = renderPasswordResetEmail({
      userName: user.name,
      resetUrl,
      ttlMinutes: this.config.PASSWORD_RESET_TOKEN_TTL_MINUTES,
      logoUrl: `${frontendBaseUrl}/pombo-icon.svg`,
      locale: user.language,
    });

    await this.mailProvider.send({
      to: user.email,
      subject,
      html,
      text,
    });
  }
}
