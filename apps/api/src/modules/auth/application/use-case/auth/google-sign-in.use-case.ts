import { inject, injectable } from "tsyringe";
import { DI_TOKENS } from "@core/container/tokens";
import { OAuth2Client } from "google-auth-library";
import { IUserRepository } from "@modules/user/domain/repository/user-repository.interface";
import { IJwtProvider } from "@shared/provider";
import { GoogleSignInDTO, GoogleSignInResponseDTO } from "../../dto/auth.dto";
import { UnauthorizedError } from "@shared/error";
import { ErrorCodes } from "@shared/error/error-codes";
import { DEFAULT_LOCALE } from "@shared/constant/defaults";
import type { User } from "@modules/user/domain/entity/user.entity";
import { AuthProfileBuilder } from "@modules/auth/application/service/auth-profile.builder";

/**
 * Google ID-token sign-in — single-user boilerplate. Find-or-create the user
 * and mint a full session either way. The `kind` discriminator lets the FE
 * pick the right post-auth route (existing → sign-in, new → sign-up).
 */
@injectable()
export class GoogleSignInUseCase {
  private readonly googleClient: OAuth2Client;
  private readonly googleClientId: string;

  constructor(
    @inject(DI_TOKENS.UserRepository)
    private readonly userRepository: IUserRepository,

    @inject(DI_TOKENS.JwtProvider)
    private readonly jwtProvider: IJwtProvider,

    @inject(DI_TOKENS.AuthProfileBuilder)
    private readonly profileBuilder: AuthProfileBuilder,

    @inject(DI_TOKENS.GoogleClientId)
    googleClientId: string,
  ) {
    this.googleClientId = googleClientId;
    this.googleClient = new OAuth2Client(googleClientId);
  }

  async execute(data: GoogleSignInDTO): Promise<GoogleSignInResponseDTO> {
    const payload = await this.verifyGoogleToken(data.credential);

    const googleId = payload.sub!;
    const email = payload.email!;
    const userName = (payload.name ?? email.split("@")[0]) as string;
    const picture = payload.picture;

    // 1. Returning user matched by googleId.
    let user = await this.userRepository.findByGoogleId(googleId);
    if (user) {
      const refreshed =
        !user.avatarUrl && picture
          ? await this.userRepository.updateAvatarUrl(user.id, picture)
          : user;
      return this.issueSession(refreshed, "sign-in");
    }

    // 2. Existing user by e-mail — link Google account, then sign in.
    user = await this.userRepository.findByEmail(email);
    if (user) {
      const linked = await this.userRepository.linkGoogleId(
        user.id,
        googleId,
        !user.avatarUrl ? picture : undefined,
      );
      return this.issueSession(linked, "sign-in");
    }

    // 3. New user — create the user row atomically.
    return this.createNewGoogleUser({
      googleId,
      email,
      name: userName,
      picture,
      language: data.language,
    });
  }

  private async verifyGoogleToken(credential: string) {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: credential,
        audience: this.googleClientId,
      });

      const payload = ticket.getPayload();

      if (!payload || !payload.email) {
        throw new UnauthorizedError(
          "Invalid Google token",
          undefined,
          ErrorCodes.AUTH_GOOGLE_TOKEN_INVALID,
        );
      }

      return payload;
    } catch {
      throw new UnauthorizedError(
        "Invalid Google credential",
        undefined,
        ErrorCodes.AUTH_GOOGLE_TOKEN_INVALID,
      );
    }
  }

  private async issueSession(
    user: User,
    kind: "sign-in" | "sign-up",
  ): Promise<GoogleSignInResponseDTO> {
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
      kind,
      user: this.profileBuilder.buildProfile(user),
      token,
      refreshToken,
    };
  }

  private async createNewGoogleUser(data: {
    googleId: string;
    email: string;
    name: string;
    picture?: string;
    language?: string;
  }): Promise<GoogleSignInResponseDTO> {
    const { refreshToken, tokenExpiresAt, refreshTokenExpiresAt } =
      this.jwtProvider.issueRefreshCredential();

    const persistedLanguage = data.language ?? DEFAULT_LOCALE;

    const result = await this.userRepository.signUpTransaction({
      name: data.name,
      email: data.email,
      googleId: data.googleId,
      status: "ACTIVE",
      // Google vouches for the address — skip the PIN-confirmation step.
      emailVerified: true,
      tokenExpiresAt,
      refreshTokenHash: this.jwtProvider.hashRefreshToken(refreshToken),
      refreshTokenExpiresAt,
      avatarUrl: data.picture,
      language: persistedLanguage,
    });

    const token = this.jwtProvider.sign({
      userId: result.user.id,
      tokenVersion: result.user.tokenVersion,
    });

    return {
      kind: "sign-up",
      user: this.profileBuilder.buildProfile(result.user),
      token,
      refreshToken,
    };
  }
}
