import { injectable } from "tsyringe";
import { User } from "@modules/user/domain/entity/user.entity";
import { MeResponseDTO } from "@modules/auth/application/dto/auth.dto";

/**
 * Assembles the `MeResponseDTO` for a user. Single-user boilerplate: the
 * profile is derived from the `User` alone — no account, membership, role,
 * subscription or onboarding context.
 */
@injectable()
export class AuthProfileBuilder {
  buildProfile(user: User): MeResponseDTO {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      avatarUrl: user.avatarUrl,
      language: user.language,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
