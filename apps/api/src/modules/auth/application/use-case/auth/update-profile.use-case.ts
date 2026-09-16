import { inject, injectable } from "tsyringe";
import { DI_TOKENS } from "@core/container/tokens";
import { IUserRepository } from "@modules/user/domain/repository/user-repository.interface";
import { UpdateProfileDTO, MeResponseDTO } from "../../dto/auth.dto";
import { ConflictError, NotFoundError } from "@shared/error";
import { ErrorCodes } from "@shared/error/error-codes";
import { AuthProfileBuilder } from "@modules/auth/application/service/auth-profile.builder";

/**
 * Updates the authenticated user's own profile. Single-user boilerplate:
 * only identity scalars (name, email, language) are editable.
 */
@injectable()
export class UpdateProfileUseCase {
  constructor(
    @inject(DI_TOKENS.UserRepository)
    private readonly userRepository: IUserRepository,
    @inject(DI_TOKENS.AuthProfileBuilder)
    private readonly profileBuilder: AuthProfileBuilder,
  ) {}

  async execute(
    userId: string,
    data: UpdateProfileDTO,
  ): Promise<MeResponseDTO> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundError(
        "User not found",
        undefined,
        ErrorCodes.USER_NOT_FOUND,
      );
    }

    if (data.email && data.email !== user.email) {
      const existing = await this.userRepository.findByEmail(data.email);
      if (existing) {
        throw new ConflictError(
          "Email already in use",
          undefined,
          ErrorCodes.AUTH_EMAIL_ALREADY_EXISTS,
        );
      }
    }

    const updatedUser = await this.userRepository.update(userId, {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.language !== undefined && { language: data.language }),
    });

    return this.profileBuilder.buildProfile(updatedUser);
  }
}
