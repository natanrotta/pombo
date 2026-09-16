import { createHash } from "crypto";
import {
  VerifyEmailPinUseCase,
  EMAIL_VERIFICATION_MAX_ATTEMPTS,
} from "./verify-email-pin.use-case";
import {
  mockUserRepository,
  mockEmailVerificationPinRepository,
  mockJwtProvider,
  mockLoggerProvider,
} from "@test/mocks";
import { makeUser } from "@test/factories";
import { TooManyRequestsError } from "@shared/error";
import { ErrorCodes } from "@shared/error/error-codes";
import { AuthProfileBuilder } from "@modules/auth/application/service/auth-profile.builder";

const VALID_PIN = "123456";
const hashPin = (pin: string) => createHash("sha256").update(pin).digest("hex");

function activePin(overrides: Record<string, unknown> = {}) {
  return {
    id: "pin-1",
    userId: "u-1",
    pinHash: hashPin(VALID_PIN),
    expiresAt: new Date(Date.now() + 60_000),
    attempts: 0,
    usedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe("VerifyEmailPinUseCase", () => {
  let sut: VerifyEmailPinUseCase;
  let userRepository: ReturnType<typeof mockUserRepository>;
  let pinRepository: ReturnType<typeof mockEmailVerificationPinRepository>;
  let jwtProvider: ReturnType<typeof mockJwtProvider>;
  let logger: ReturnType<typeof mockLoggerProvider>;
  let builder: AuthProfileBuilder;

  beforeEach(() => {
    userRepository = mockUserRepository();
    pinRepository = mockEmailVerificationPinRepository();
    jwtProvider = mockJwtProvider();
    logger = mockLoggerProvider();
    builder = new AuthProfileBuilder();
    sut = new VerifyEmailPinUseCase(
      userRepository,
      pinRepository,
      jwtProvider,
      builder,
      logger,
    );

    jwtProvider.generateTokenPair.mockReturnValue({
      token: "final-token",
      refreshToken: "refresh-token",
      tokenExpiresAt: new Date(),
      refreshTokenExpiresAt: new Date(),
    });
  });

  it("verifies a correct PIN and returns a full session", async () => {
    const unverified = makeUser({ id: "u-1", emailVerified: false });
    const verified = makeUser({ id: "u-1", emailVerified: true });
    userRepository.findById
      .mockResolvedValueOnce(unverified)
      .mockResolvedValueOnce(verified);
    pinRepository.findActiveByUserId.mockResolvedValue(activePin());

    const result = await sut.execute({ userId: "u-1", pin: VALID_PIN });

    expect(pinRepository.markAsUsed).toHaveBeenCalledWith("pin-1");
    expect(userRepository.markEmailVerified).toHaveBeenCalledWith("u-1");
    expect(result.token).toBe("final-token");
    expect(result.refreshToken).toBe("refresh-token");
    expect(result.user.emailVerified).toBe(true);
  });

  it("rejects a wrong PIN and bumps the attempt counter", async () => {
    const user = makeUser({ id: "u-1", emailVerified: false });
    userRepository.findById.mockResolvedValue(user);
    pinRepository.findActiveByUserId.mockResolvedValue(activePin());
    pinRepository.incrementAttempts.mockResolvedValue(1);

    await expect(
      sut.execute({ userId: "u-1", pin: "000000" }),
    ).rejects.toMatchObject({
      code: ErrorCodes.AUTH_EMAIL_VERIFICATION_PIN_INVALID,
    });
    expect(pinRepository.incrementAttempts).toHaveBeenCalledWith("pin-1");
    expect(userRepository.markEmailVerified).not.toHaveBeenCalled();
  });

  it("locks out after the max attempts is reached", async () => {
    const user = makeUser({ id: "u-1", emailVerified: false });
    userRepository.findById.mockResolvedValue(user);
    pinRepository.findActiveByUserId.mockResolvedValue(activePin());
    pinRepository.incrementAttempts.mockResolvedValue(
      EMAIL_VERIFICATION_MAX_ATTEMPTS,
    );

    await expect(
      sut.execute({ userId: "u-1", pin: "000000" }),
    ).rejects.toBeInstanceOf(TooManyRequestsError);
  });

  it("rejects when the counter is already at the cap (locked code)", async () => {
    const user = makeUser({ id: "u-1", emailVerified: false });
    userRepository.findById.mockResolvedValue(user);
    pinRepository.findActiveByUserId.mockResolvedValue(
      activePin({ attempts: EMAIL_VERIFICATION_MAX_ATTEMPTS }),
    );

    await expect(
      sut.execute({ userId: "u-1", pin: VALID_PIN }),
    ).rejects.toMatchObject({
      code: ErrorCodes.AUTH_EMAIL_VERIFICATION_RATE_LIMITED,
    });
    expect(pinRepository.markAsUsed).not.toHaveBeenCalled();
  });

  it("throws when the PIN is missing or expired", async () => {
    const user = makeUser({ id: "u-1", emailVerified: false });
    userRepository.findById.mockResolvedValue(user);
    pinRepository.findActiveByUserId.mockResolvedValue(
      activePin({ expiresAt: new Date(Date.now() - 1000) }),
    );

    await expect(
      sut.execute({ userId: "u-1", pin: VALID_PIN }),
    ).rejects.toMatchObject({
      code: ErrorCodes.AUTH_EMAIL_VERIFICATION_PIN_EXPIRED,
    });
  });

  it("is idempotent — an already-verified user gets a fresh session without PIN checks", async () => {
    const verified = makeUser({ id: "u-1", emailVerified: true });
    userRepository.findById.mockResolvedValue(verified);

    const result = await sut.execute({ userId: "u-1", pin: "000000" });

    expect(pinRepository.findActiveByUserId).not.toHaveBeenCalled();
    expect(pinRepository.markAsUsed).not.toHaveBeenCalled();
    expect(result.token).toBe("final-token");
  });
});
