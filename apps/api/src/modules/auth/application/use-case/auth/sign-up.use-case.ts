import { inject, injectable } from "tsyringe";
import { DI_TOKENS } from "@core/container/tokens";
import { IUserRepository } from "@modules/user/domain/repository/user-repository.interface";
import { IHashProvider, IJwtProvider } from "@shared/provider";
import { SignUpDTO, SignUpResult } from "../../dto/auth.dto";
import { ConflictError } from "@shared/error";
import { ErrorCodes } from "@shared/error/error-codes";
import { DEFAULT_LOCALE } from "@shared/constant/defaults";
import {
  JWT_SCOPES,
  EMAIL_VERIFICATION_TOKEN_TTL_SECONDS,
} from "@modules/auth/constant/jwt-scopes";

/**
 * E-mail + password signup. Creates the user row, but the user starts
 * **unverified** (`email_verified: false`). Instead of a final session it
 * emits a short-lived `email:verify`-scoped JWT; only the send/verify-PIN
 * endpoints accept it. The user confirms a 6-digit PIN to upgrade into a
 * full session.
 *
 * `issueRefreshCredential` provides the refresh-token hash the signup
 * transaction requires; that credential is overwritten when the verify step
 * mints the real session, and is never handed to the client here.
 */
@injectable()
export class SignUpUseCase {
  constructor(
    @inject(DI_TOKENS.UserRepository)
    private readonly userRepository: IUserRepository,

    @inject(DI_TOKENS.HashProvider)
    private readonly hashProvider: IHashProvider,

    @inject(DI_TOKENS.JwtProvider)
    private readonly jwtProvider: IJwtProvider,
  ) {}

  async execute(data: SignUpDTO): Promise<SignUpResult> {
    const existingUser = await this.userRepository.findByEmail(data.email);

    if (existingUser) {
      throw new ConflictError(
        "Email already in use",
        undefined,
        ErrorCodes.AUTH_EMAIL_ALREADY_EXISTS,
      );
    }

    const hashedPassword = await this.hashProvider.hash(data.password);

    const { refreshToken, tokenExpiresAt, refreshTokenExpiresAt } =
      this.jwtProvider.issueRefreshCredential();

    const persistedLanguage = data.language ?? DEFAULT_LOCALE;

    const result = await this.userRepository.signUpTransaction({
      name: data.name,
      email: data.email,
      password: hashedPassword,
      status: "ACTIVE",
      tokenExpiresAt,
      refreshTokenHash: this.jwtProvider.hashRefreshToken(refreshToken),
      refreshTokenExpiresAt,
      language: persistedLanguage,
    });

    // Email+password signups are gated behind PIN confirmation: issue a
    // narrow `email:verify`-scoped token instead of a full session.
    const { token } = this.jwtProvider.signScoped(
      {
        userId: result.user.id,
        tokenVersion: result.user.tokenVersion,
      },
      JWT_SCOPES.EmailVerification,
      EMAIL_VERIFICATION_TOKEN_TTL_SECONDS,
    );

    return {
      requiresEmailVerification: true,
      token,
      email: result.user.email,
    };
  }
}
