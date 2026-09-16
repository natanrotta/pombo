import { GetMeUseCase } from "./get-me.use-case";
import { mockUserRepository } from "@test/mocks";
import { makeUser } from "@test/factories";
import { NotFoundError } from "@shared/error";
import { ErrorCodes } from "@shared/error/error-codes";
import { AuthProfileBuilder } from "@modules/auth/application/service/auth-profile.builder";

describe("GetMeUseCase", () => {
  let sut: GetMeUseCase;
  let userRepository: ReturnType<typeof mockUserRepository>;
  let profileBuilder: AuthProfileBuilder;

  beforeEach(() => {
    userRepository = mockUserRepository();
    profileBuilder = new AuthProfileBuilder();
    vi.clearAllMocks();
    sut = new GetMeUseCase(userRepository, profileBuilder);
  });

  it("returns the profile for the authenticated user", async () => {
    const user = makeUser({ id: "u-1" });
    userRepository.findById.mockResolvedValue(user);

    const result = await sut.execute(user.id);

    expect(userRepository.findById).toHaveBeenCalledWith(user.id);
    expect(result.id).toBe(user.id);
    expect(result.email).toBe(user.email);
  });

  it("throws NotFoundError when user does not exist", async () => {
    userRepository.findById.mockResolvedValue(null);

    await expect(sut.execute("non-existent")).rejects.toThrow(NotFoundError);
    await expect(sut.execute("non-existent")).rejects.toMatchObject({
      code: ErrorCodes.USER_NOT_FOUND,
    });
  });
});
