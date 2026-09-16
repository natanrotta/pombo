import { GoogleSignInUseCase } from "./google-sign-in.use-case";
import { mockUserRepository, mockJwtProvider } from "@test/mocks";
import { makeUser } from "@test/factories";
import { UnauthorizedError } from "@shared/error";
import { ErrorCodes } from "@shared/error/error-codes";
import { AuthProfileBuilder } from "@modules/auth/application/service/auth-profile.builder";

const mockVerifyIdToken = vi.fn();
vi.mock("google-auth-library", () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({
    verifyIdToken: mockVerifyIdToken,
  })),
}));

describe("GoogleSignInUseCase", () => {
  let sut: GoogleSignInUseCase;
  let userRepository: ReturnType<typeof mockUserRepository>;
  let jwtProvider: ReturnType<typeof mockJwtProvider>;
  let builder: AuthProfileBuilder;

  const tokenPair = {
    token: "access-token",
    refreshToken: "refresh-token",
    tokenExpiresAt: new Date(),
    refreshTokenExpiresAt: new Date(),
  };

  beforeEach(() => {
    userRepository = mockUserRepository();
    jwtProvider = mockJwtProvider();
    builder = new AuthProfileBuilder();
    sut = new GoogleSignInUseCase(
      userRepository,
      jwtProvider,
      builder,
      "test-google-client-id",
    );
    jwtProvider.generateTokenPair.mockReturnValue(tokenPair);
  });

  function mockGooglePayload(overrides: Record<string, unknown> = {}) {
    mockVerifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: "google-123",
        email: "google@test.com",
        name: "Google User",
        picture: "https://photo.url/pic.jpg",
        ...overrides,
      }),
    });
  }

  it("returns kind=sign-in with a full session for an existing Google user", async () => {
    mockGooglePayload();
    const user = makeUser({
      googleId: "google-123",
      avatarUrl: "https://existing.jpg",
    });
    userRepository.findByGoogleId.mockResolvedValue(user);
    userRepository.setTokenData.mockResolvedValue(undefined);

    const result = await sut.execute({ credential: "google-jwt" });

    expect(result.kind).toBe("sign-in");
    expect(result.token).toBe("access-token");
    expect(result.user.id).toBe(user.id);
    expect(userRepository.signUpTransaction).not.toHaveBeenCalled();
    expect(jwtProvider.generateTokenPair).toHaveBeenCalledWith(
      expect.objectContaining({ userId: user.id }),
    );
  });

  it("links Google ID and signs in when user found by email without avatar", async () => {
    mockGooglePayload();
    const user = makeUser({ googleId: null, avatarUrl: null });
    const linkedUser = makeUser({ id: user.id, googleId: "google-123" });

    userRepository.findByGoogleId.mockResolvedValue(null);
    userRepository.findByEmail.mockResolvedValue(user);
    userRepository.linkGoogleId.mockResolvedValue(linkedUser);
    userRepository.setTokenData.mockResolvedValue(undefined);

    const result = await sut.execute({ credential: "google-jwt" });

    expect(userRepository.linkGoogleId).toHaveBeenCalledWith(
      user.id,
      "google-123",
      "https://photo.url/pic.jpg",
    );
    expect(result.kind).toBe("sign-in");
    expect(userRepository.signUpTransaction).not.toHaveBeenCalled();
  });

  it("creates the user for first-time Google users (kind=sign-up)", async () => {
    mockGooglePayload();
    const newUser = makeUser({
      id: "u-new",
      name: "Google User",
      googleId: "google-123",
    });

    userRepository.findByGoogleId.mockResolvedValue(null);
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.signUpTransaction.mockResolvedValue({ user: newUser });
    jwtProvider.issueRefreshCredential.mockReturnValue({
      refreshToken: "refresh-token",
      tokenExpiresAt: new Date(),
      refreshTokenExpiresAt: new Date(),
    });
    jwtProvider.sign.mockReturnValue("final-token");

    const result = await sut.execute({ credential: "google-jwt" });

    expect(userRepository.signUpTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        googleId: "google-123",
        status: "ACTIVE",
        emailVerified: true,
        avatarUrl: "https://photo.url/pic.jpg",
      }),
    );
    expect(result.kind).toBe("sign-up");
    expect(result.token).toBe("final-token");
    expect(result.user.id).toBe("u-new");
    expect(jwtProvider.sign).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u-new" }),
    );
  });

  it("throws AUTH_GOOGLE_TOKEN_INVALID for invalid Google credential", async () => {
    mockVerifyIdToken.mockRejectedValue(new Error("Invalid token"));

    await expect(sut.execute({ credential: "bad-jwt" })).rejects.toThrow(
      UnauthorizedError,
    );
    await expect(sut.execute({ credential: "bad-jwt" })).rejects.toMatchObject({
      code: ErrorCodes.AUTH_GOOGLE_TOKEN_INVALID,
    });
  });

  it("throws UnauthorizedError when user is inactive", async () => {
    mockGooglePayload();
    const user = makeUser({
      googleId: "google-123",
      status: "PENDING",
      avatarUrl: "https://existing.jpg",
    });
    userRepository.findByGoogleId.mockResolvedValue(user);

    await expect(sut.execute({ credential: "google-jwt" })).rejects.toThrow(
      UnauthorizedError,
    );
  });
});
