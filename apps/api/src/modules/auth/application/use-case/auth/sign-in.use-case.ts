import { inject, injectable } from "tsyringe";
import { DI_TOKENS } from "@core/container/tokens";
import { IUserRepository } from "@modules/user/domain/repository/user-repository.interface";
import { IHashProvider, IJwtProvider } from "@shared/provider";
import { SignInDTO, SignInResponseDTO } from "../../dto/auth.dto";
import { UnauthorizedError } from "@shared/error";
import { ErrorCodes } from "@shared/error/error-codes";
import { AuthProfileBuilder } from "@modules/auth/application/service/auth-profile.builder";

/**
 * E-mail + password sign-in. Single-user boilerplate: on a valid credential
 * we mint a final session (token + refresh token) and return the user's
 * profile directly — there is no account picker.
 */
@injectable()
export class SignInUseCase {
  constructor(
    @inject(DI_TOKENS.UserRepository)
    private readonly userRepository: IUserRepository,
    @inject(DI_TOKENS.HashProvider)
    private readonly hashProvider: IHashProvider,
    @inject(DI_TOKENS.JwtProvider)
    private readonly jwtProvider: IJwtProvider,
    @inject(DI_TOKENS.AuthProfileBuilder)
    private readonly profileBuilder: AuthProfileBuilder,
  ) {}

  async execute(data: SignInDTO): Promise<SignInResponseDTO> {
    const user = await this.userRepository.findByEmail(data.email);

    if (!user) {
      throw new UnauthorizedError(
        "Invalid credentials",
        undefined,
        ErrorCodes.AUTH_INVALID_CREDENTIALS,
      );
    }

    if (!user.password) {
      throw new UnauthorizedError(
        "This account uses Google sign-in",
        undefined,
        ErrorCodes.AUTH_GOOGLE_ONLY,
      );
    }

    const passwordMatch = await this.hashProvider.compare(
      data.password,
      user.password,
    );
    if (!passwordMatch) {
      throw new UnauthorizedError(
        "Invalid credentials",
        undefined,
        ErrorCodes.AUTH_INVALID_CREDENTIALS,
      );
    }

    if (!user.isActive) {
      throw new UnauthorizedError(
        "Account is not active",
        undefined,
        ErrorCodes.AUTH_INVALID_CREDENTIALS,
      );
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
