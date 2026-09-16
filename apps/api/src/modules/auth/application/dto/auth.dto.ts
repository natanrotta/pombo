import { z } from "zod";
import type {
  GoogleSignInResponseDTO,
  MeResponseDTO,
  SignUpResponseDTO,
} from "@pombo/shared-types";

export type { MeResponseDTO };

// Use-case results. They are NOT the wire bodies (those live in
// `@pombo/shared-types`): a session-minting use case also hands the controller
// the refresh token, which the controller puts in the `pombo_rt` cookie before
// writing `{ user, token, csrfToken }`.

/** Output of every session-minting use case (sign-in, verify-email PIN). */
export interface AuthSessionResult {
  user: MeResponseDTO;
  token: string;
  refreshToken: string;
}

export type SignInResult = AuthSessionResult;

export type GoogleSignInResult = Pick<GoogleSignInResponseDTO, "kind"> &
  AuthSessionResult;

export interface RefreshTokenResult {
  token: string;
  refreshToken: string;
}

/** The sign-up body minus the CSRF token the controller adds. */
export type SignUpResult = Omit<SignUpResponseDTO, "csrfToken">;

export const SignInDTOSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export type SignInDTO = z.infer<typeof SignInDTOSchema>;

export const SignUpDTOSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().toLowerCase().email("Invalid email format"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/\d/, "Password must contain a number")
    .regex(/[^A-Za-z0-9]/, "Password must contain a special character"),
  /** UI-supplied locale at signup time. Persisted as `user.language`.
   *  Optional — falls back to the schema default (pt-BR). */
  language: z.enum(["en", "pt-BR", "es"]).optional(),
});

export type SignUpDTO = z.infer<typeof SignUpDTOSchema>;

export const GoogleSignInDTOSchema = z.object({
  credential: z.string().min(1, "Google credential is required"),
  /** UI-supplied locale at signup time. Same semantics as SignUpDTOSchema. */
  language: z.enum(["en", "pt-BR", "es"]).optional(),
});

export type GoogleSignInDTO = z.infer<typeof GoogleSignInDTOSchema>;

export const RefreshTokenDTOSchema = z.object({
  // Optional: the web app sends the refresh token via the httpOnly `pombo_rt`
  // cookie and posts an empty body. The controller reads the cookie first and
  // only falls back to this body field for non-browser/API clients.
  refreshToken: z.string().min(1, "Refresh token is required").optional(),
});

export type RefreshTokenDTO = z.infer<typeof RefreshTokenDTOSchema>;

export const UpdateProfileDTOSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email format")
    .optional(),
  language: z.enum(["en", "pt-BR", "es"]).optional(),
});

export type UpdateProfileDTO = z.infer<typeof UpdateProfileDTOSchema>;

const PasswordStrengthSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/\d/, "Password must contain a number")
  .regex(/[^A-Za-z0-9]/, "Password must contain a special character");

export const RequestPasswordResetDTOSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email format"),
});

export type RequestPasswordResetDTO = z.infer<
  typeof RequestPasswordResetDTOSchema
>;

export const ResetPasswordDTOSchema = z.object({
  token: z.string().trim().min(1, "Token is required"),
  password: PasswordStrengthSchema,
});

export type ResetPasswordDTO = z.infer<typeof ResetPasswordDTOSchema>;

/** Body for `POST /auth/email-verification/verify`. The `userId` is taken
 *  from the verify-email-scoped JWT, the client only supplies the 6-digit
 *  PIN. */
export const VerifyEmailPinDTOSchema = z.object({
  pin: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "PIN must be 6 digits"),
});

export type VerifyEmailPinBodyDTO = z.infer<typeof VerifyEmailPinDTOSchema>;

/** Input to {@link VerifyEmailPinUseCase} — body PIN + the userId resolved
 *  from the scoped token by the controller. */
export interface VerifyEmailPinDTO extends VerifyEmailPinBodyDTO {
  userId: string;
}

/** Input to {@link SendEmailVerificationPinUseCase}. No request body — the
 *  userId comes from the verify-email-scoped JWT. */
export interface SendEmailVerificationPinDTO {
  userId: string;
}
