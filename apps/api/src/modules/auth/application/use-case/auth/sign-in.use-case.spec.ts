import { SignInUseCase } from "./sign-in.use-case";
import {
  mockUserRepository,
  mockHashProvider,
  mockJwtProvider,
} from "@test/mocks";
import { makeUser } from "@test/factories";
import { AuthProfileBuilder } from "@modules/auth/application/service/auth-profile.builder";
import { UnauthorizedError } from "@shared/error";
import { ErrorCodes } from "@shared/error/error-codes";

describe("SignInUseCase", () => {
  let sut: SignInUseCase;
  let userRepository: ReturnType<typeof mockUserRepository>;
  let hashProvider: ReturnType<typeof mockHashProvider>;
  let jwtProvider: ReturnType<typeof mockJwtProvider>;
  let profileBuilder: AuthProfileBuilder;

  beforeEach(() => {
    vi.clearAllMocks();
    userRepository = mockUserRepository();
    hashProvider = mockHashProvider();
    jwtProvider = mockJwtProvider();
    profileBuilder = new AuthProfileBuilder();

    jwtProvider.generateTokenPair.mockReturnValue({
      token: "access-token",
      refreshToken: "refresh-token",
      tokenExpiresAt: new Date(),
      refreshTokenExpiresAt: new Date(),
    });
    userRepository.setTokenData.mockResolvedValue(undefined);

    sut = new SignInUseCase(
      userRepository,
      hashProvider,
      jwtProvider,
      profileBuilder,
    );
  });

  it("returns a full session + user profile when credentials are valid", async () => {
    const user = makeUser({ password: "hashed-pw" });
    userRepository.findByEmail.mockResolvedValue(user);
    hashProvider.compare.mockResolvedValue(true);

    const result = await sut.execute({
      email: user.email,
      password: "plain-pw",
    });

    expect(hashProvider.compare).toHaveBeenCalledWith("plain-pw", "hashed-pw");
    expect(jwtProvider.generateTokenPair).toHaveBeenCalledWith(
      expect.objectContaining({ userId: user.id }),
    );
    expect(result.token).toBe("access-token");
    expect(result.refreshToken).toBe("refresh-token");
    expect(result.user.id).toBe(user.id);
    expect(result.user.email).toBe(user.email);
    expect(userRepository.setTokenData).toHaveBeenCalled();
  });

  it("throws UnauthorizedError when user not found", async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    await expect(
      sut.execute({ email: "x@test.com", password: "pw" }),
    ).rejects.toThrow(UnauthorizedError);
    await expect(
      sut.execute({ email: "x@test.com", password: "pw" }),
    ).rejects.toMatchObject({
      code: ErrorCodes.AUTH_INVALID_CREDENTIALS,
    });
  });

  it("throws UnauthorizedError when password does not match", async () => {
    userRepository.findByEmail.mockResolvedValue(
      makeUser({ password: "hashed" }),
    );
    hashProvider.compare.mockResolvedValue(false);

    await expect(
      sut.execute({ email: "test@test.com", password: "wrong" }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("throws AUTH_GOOGLE_ONLY when user has no password (Google-only account)", async () => {
    userRepository.findByEmail.mockResolvedValue(makeUser({ password: null }));

    await expect(
      sut.execute({ email: "test@test.com", password: "pw" }),
    ).rejects.toMatchObject({
      code: ErrorCodes.AUTH_GOOGLE_ONLY,
    });
  });

  it("throws UnauthorizedError when user is not active", async () => {
    userRepository.findByEmail.mockResolvedValue(
      makeUser({ password: "hashed", status: "PENDING" }),
    );
    hashProvider.compare.mockResolvedValue(true);

    await expect(
      sut.execute({ email: "test@test.com", password: "pw" }),
    ).rejects.toThrow(UnauthorizedError);
  });
});
