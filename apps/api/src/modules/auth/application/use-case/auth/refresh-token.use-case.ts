import { inject, injectable } from "tsyringe";
import { DI_TOKENS } from "@core/container/tokens";
import { IUserRepository } from "@modules/user/domain/repository/user-repository.interface";
import { IJwtProvider } from "@shared/provider";
import { RefreshTokenResponseDTO } from "../../dto/auth.dto";
import { UnauthorizedError } from "@shared/error";
import { ErrorCodes } from "@shared/error/error-codes";

/**
 * Refresh swap. Rotates the refresh token and mints a fresh access token for
 * the same user. The user is looked up by the at-rest hash of the raw token
 * from the cookie — plaintext tokens never hit a repository query.
 */
@injectable()
export class RefreshTokenUseCase {
  constructor(
    @inject(DI_TOKENS.UserRepository)
    private readonly userRepository: IUserRepository,

    @inject(DI_TOKENS.JwtProvider)
    private readonly jwtProvider: IJwtProvider,
  ) {}

  async execute(currentRefreshToken: string): Promise<RefreshTokenResponseDTO> {
    const currentHash = this.jwtProvider.hashRefreshToken(currentRefreshToken);
    const user = await this.userRepository.findByRefreshTokenHash(currentHash);

    if (!user) {
      throw new UnauthorizedError(
        "Invalid refresh token",
        undefined,
        ErrorCodes.AUTH_TOKEN_INVALID,
      );
    }

    if (user.refreshTokenExpiresAt && user.refreshTokenExpiresAt < new Date()) {
      await this.userRepository.clearRefreshToken(user.id);
      throw new UnauthorizedError(
        "Refresh token expired",
        undefined,
        ErrorCodes.AUTH_TOKEN_EXPIRED,
      );
    }

    if (!user.isActive) {
      throw new UnauthorizedError(
        "Account is not active",
        undefined,
        ErrorCodes.AUTH_INVALID_CREDENTIALS,
      );
    }

    const { token, refreshToken, refreshTokenExpiresAt } =
      this.jwtProvider.generateTokenPair({
        userId: user.id,
        tokenVersion: user.tokenVersion,
      });

    const nextHash = this.jwtProvider.hashRefreshToken(refreshToken);
    await this.userRepository.setRefreshTokenHash(
      user.id,
      nextHash,
      refreshTokenExpiresAt,
    );

    return { token, refreshToken };
  }
}
