import { UpdateAvatarUseCase } from "./update-avatar.use-case";
import {
  mockUserRepository,
  mockStorageProvider,
  mockLoggerProvider,
} from "@test/mocks";
import { makeUser } from "@test/factories";
import { NotFoundError, BadRequestError } from "@shared/error";
import { ErrorCodes } from "@shared/error/error-codes";
import { AuthProfileBuilder } from "@modules/auth/application/service/auth-profile.builder";

vi.mock("@shared/util/extract-s3-key", () => ({
  extractS3Key: vi.fn((url: string) => `key-from-${url}`),
}));

describe("UpdateAvatarUseCase", () => {
  let sut: UpdateAvatarUseCase;
  let userRepository: ReturnType<typeof mockUserRepository>;
  let storageProvider: ReturnType<typeof mockStorageProvider>;
  let loggerProvider: ReturnType<typeof mockLoggerProvider>;
  let profileBuilder: AuthProfileBuilder;

  const file = {
    buffer: Buffer.from("image-data"),
    mimetype: "image/png",
    originalname: "avatar.png",
    size: 4096,
  } as Express.Multer.File;

  beforeEach(() => {
    vi.clearAllMocks();
    userRepository = mockUserRepository();
    storageProvider = mockStorageProvider();
    loggerProvider = mockLoggerProvider();
    profileBuilder = new AuthProfileBuilder();
    sut = new UpdateAvatarUseCase(
      userRepository,
      storageProvider,
      loggerProvider,
      profileBuilder,
    );
  });

  it("uploads the avatar and returns the updated profile", async () => {
    const user = makeUser({ avatarUrl: null });
    const updatedUser = makeUser({
      id: user.id,
      avatarUrl: "https://s3/new-avatar.png",
    });

    userRepository.findById.mockResolvedValue(user);
    storageProvider.upload.mockResolvedValue({
      url: "https://s3/new-avatar.png",
      key: "key",
    });
    userRepository.updateAvatarUrl.mockResolvedValue(updatedUser);

    const result = await sut.execute(user.id, file);

    expect(storageProvider.upload).toHaveBeenCalledWith(
      file.buffer,
      `avatars/${user.id}.png`,
      "image/png",
    );
    expect(userRepository.updateAvatarUrl).toHaveBeenCalledWith(
      user.id,
      "https://s3/new-avatar.png",
    );
    expect(result.avatarUrl).toBe("https://s3/new-avatar.png");
  });

  it("derives the S3 key extension from the validated MIME, never from the filename (SEC-H6)", async () => {
    const user = makeUser({ avatarUrl: null });
    userRepository.findById.mockResolvedValue(user);
    storageProvider.upload.mockResolvedValue({ url: "https://s3/a", key: "k" });
    userRepository.updateAvatarUrl.mockResolvedValue(user);

    await sut.execute(user.id, {
      ...file,
      mimetype: "image/png",
      originalname: "evil.svg",
    } as Express.Multer.File);

    expect(storageProvider.upload).toHaveBeenCalledWith(
      file.buffer,
      `avatars/${user.id}.png`,
      "image/png",
    );
  });

  it("rejects a MIME outside the allowlist even if the middleware was bypassed", async () => {
    userRepository.findById.mockResolvedValue(makeUser());

    await expect(
      sut.execute("user-1", {
        ...file,
        mimetype: "image/svg+xml",
        originalname: "x.png",
      } as Express.Multer.File),
    ).rejects.toMatchObject({ code: ErrorCodes.FILE_INVALID_TYPE });
    expect(storageProvider.upload).not.toHaveBeenCalled();
  });

  it("throws NotFoundError when the user does not exist", async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(sut.execute("missing", file)).rejects.toThrow(NotFoundError);
    await expect(sut.execute("missing", file)).rejects.toMatchObject({
      code: ErrorCodes.USER_NOT_FOUND,
    });
  });

  it("throws BadRequestError when no file is provided", async () => {
    userRepository.findById.mockResolvedValue(makeUser());

    await expect(
      sut.execute("user-1", undefined as unknown as Express.Multer.File),
    ).rejects.toThrow(BadRequestError);
  });
});
