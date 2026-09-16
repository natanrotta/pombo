import { RequestPasswordResetUseCase } from "./request-password-reset.use-case";
import {
  mockAppConfig,
  mockUserRepository,
  mockPasswordResetTokenRepository,
  mockMailProvider,
  mockLoggerProvider,
} from "@test/mocks";
import { makeUser } from "@test/factories";

describe("RequestPasswordResetUseCase", () => {
  let sut: RequestPasswordResetUseCase;
  let userRepository: ReturnType<typeof mockUserRepository>;
  let tokenRepository: ReturnType<typeof mockPasswordResetTokenRepository>;
  let mailProvider: ReturnType<typeof mockMailProvider>;
  let logger: ReturnType<typeof mockLoggerProvider>;

  beforeEach(() => {
    userRepository = mockUserRepository();
    tokenRepository = mockPasswordResetTokenRepository();
    mailProvider = mockMailProvider();
    logger = mockLoggerProvider();
    vi.clearAllMocks();
    sut = new RequestPasswordResetUseCase(
      userRepository,
      tokenRepository,
      mailProvider,
      logger,
      mockAppConfig(),
    );
  });

  it("creates a hashed token and sends the reset email when user is eligible", async () => {
    const user = makeUser({ password: "hashed-pw" });
    userRepository.findByEmail.mockResolvedValue(user);
    tokenRepository.deleteUnusedForUser.mockResolvedValue(undefined);
    tokenRepository.create.mockResolvedValue({
      id: "token-1",
      userId: user.id,
      tokenHash: "hash",
      expiresAt: new Date(),
      usedAt: null,
      createdAt: new Date(),
    });

    await sut.execute({ email: user.email });

    expect(tokenRepository.deleteUnusedForUser).toHaveBeenCalledWith(user.id);
    expect(tokenRepository.create).toHaveBeenCalledTimes(1);
    const createArgs = tokenRepository.create.mock.calls[0]![0]!;
    expect(createArgs.userId).toBe(user.id);
    // Raw token should never be persisted — only its SHA-256 hash (64 hex chars)
    expect(createArgs.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createArgs.expiresAt.getTime()).toBeGreaterThan(Date.now());

    expect(mailProvider.send).toHaveBeenCalledTimes(1);
    const mail = mailProvider.send.mock.calls[0]![0]!;
    expect(mail.to).toBe(user.email);
    expect(mail.text).toContain("/reset-password?token=");
  });

  it("silently succeeds when the email is unknown (no enumeration)", async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    await expect(
      sut.execute({ email: "ghost@test.com" }),
    ).resolves.toBeUndefined();

    expect(tokenRepository.create).not.toHaveBeenCalled();
    expect(mailProvider.send).not.toHaveBeenCalled();
  });

  it("logs the noop with a reason but NEVER with the e-mail address (SEC-C7)", async () => {
    userRepository.findByEmail.mockResolvedValue(null);

    await sut.execute({ email: "ghost@test.com" });

    expect(logger.info).toHaveBeenCalledTimes(1);
    const [context] = logger.info.mock.calls[0]!;
    expect(context).toEqual({ reason: "unknown-email" });
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain(
      "ghost@test.com",
    );
  });

  it("silently succeeds when the account has no password (Google-only)", async () => {
    userRepository.findByEmail.mockResolvedValue(makeUser({ password: null }));

    await sut.execute({ email: "g@test.com" });

    expect(tokenRepository.create).not.toHaveBeenCalled();
    expect(mailProvider.send).not.toHaveBeenCalled();
  });

  it("silently succeeds when the account is not active", async () => {
    userRepository.findByEmail.mockResolvedValue(
      makeUser({ password: "pw", status: "PENDING" }),
    );

    await sut.execute({ email: "inactive@test.com" });

    expect(tokenRepository.create).not.toHaveBeenCalled();
    expect(mailProvider.send).not.toHaveBeenCalled();
  });
});
