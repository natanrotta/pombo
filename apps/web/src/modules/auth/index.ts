export type {
  AuthUser,
  AuthSession,
  SignInInput,
  SignUpInput,
  GoogleSignInInput,
  UpdateProfileInput,
} from "@/modules/auth/domain/entities/AuthUser";

export { useAuth } from "@/modules/auth/presentation/context/useAuth";
export { getPostAuthDestination } from "@/modules/auth/presentation/utils/postAuthDestination";
