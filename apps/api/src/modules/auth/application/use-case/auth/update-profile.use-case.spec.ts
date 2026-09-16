import { UpdateProfileUseCase } from "./update-profile.use-case";
import { mockUserRepository } from "@test/mocks";
import { makeUser } from "@test/factories";
import { NotFoundError, ConflictError } from "@shared/error";
import { ErrorCodes } from "@shared/error/error-codes";
import { AuthProfileBuilder } from "@modules/auth/application/service/auth-profile.builder";

describe("UpdateProfileUseCase", () => {
  let sut: UpdateProfileUseCase;
  let userRepository: ReturnType<typeof mockUserRepository>;
  let profileBuilder: AuthProfileBuilder;

  beforeEach(() => {
    vi.clearAllMocks();
    userRepository = mockUserRepository();
    profileBuilder = new AuthProfileBuilder();
    sut = new UpdateProfileUseCase(userRepository, profileBuilder);
  });

  it("updates name/email/language and returns the refreshed profile", async () => {
    const user = makeUser({ id: "user-1", name: "Old Name" });
    const updatedUser = makeUser({
      id: "user-1",
      name: "New Name",
      email: "new@test.com",
    });
    userRepository.findById.mockResolvedValue(user);
    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.update.mockResolvedValue(updatedUser);

    const result = await sut.execute("user-1", {
      name: "New Name",
      email: "new@test.com",
      language: "en",
    });

    expect(userRepository.update).toHaveBeenCalledWith("user-1", {
      name: "New Name",
      email: "new@test.com",
      language: "en",
    });
    expect(result.name).toBe("New Name");
    expect(result.email).toBe("new@test.com");
  });

  it("throws NotFoundError when the user does not exist", async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(sut.execute("missing", { name: "X" })).rejects.toThrow(
      NotFoundError,
    );
    await expect(sut.execute("missing", { name: "X" })).rejects.toMatchObject({
      code: ErrorCodes.USER_NOT_FOUND,
    });
  });

  it("throws ConflictError when the new email is already taken by another user", async () => {
    const user = makeUser({ id: "user-1", email: "me@test.com" });
    userRepository.findById.mockResolvedValue(user);
    userRepository.findByEmail.mockResolvedValue(
      makeUser({ id: "other", email: "taken@test.com" }),
    );

    await expect(
      sut.execute("user-1", { email: "taken@test.com" }),
    ).rejects.toThrow(ConflictError);
    expect(userRepository.update).not.toHaveBeenCalled();
  });
});
