import { z } from "zod";
import i18n from "@/shared/i18n";
import { isPasswordStrong } from "@/shared/utils/passwordValidation";

const tAuth = (key: string): string => i18n.t(key, { ns: "auth" });

/**
 * Lazy schema builders so the i18n messages reflect the active language
 * at the moment the form mounts. If the user toggles language on a page
 * that already instantiated the schema, a second submit will still show
 * the previous translation — acceptable trade-off for this low-traffic
 * path (auth screens don't live long enough to matter).
 */
export function buildSignInSchema() {
  return z.object({
    email: z
      .string()
      .trim()
      .min(1, tAuth("signIn.emailRequired"))
      .email(tAuth("signIn.emailRequired")),
    password: z.string().min(1, tAuth("signIn.passwordRequired")),
  });
}

export type SignInFormValues = z.infer<ReturnType<typeof buildSignInSchema>>;

export function buildRegisterSchema() {
  return z.object({
    name: z.string().trim().min(1, tAuth("register.nameRequired")),
    email: z
      .string()
      .trim()
      .min(1, tAuth("register.emailRequired"))
      .email(tAuth("register.emailRequired")),
    password: z
      .string()
      .min(1, tAuth("register.passwordRequired"))
      .refine(isPasswordStrong, { message: tAuth("register.passwordWeak") }),
  });
}

export type RegisterFormValues = z.infer<ReturnType<typeof buildRegisterSchema>>;

export function buildForgotPasswordSchema() {
  return z.object({
    email: z
      .string()
      .trim()
      .min(1, tAuth("forgotPassword.emailRequired"))
      .email(tAuth("forgotPassword.emailRequired")),
  });
}

export type ForgotPasswordFormValues = z.infer<
  ReturnType<typeof buildForgotPasswordSchema>
>;

export function buildResetPasswordSchema() {
  return z
    .object({
      password: z
        .string()
        .min(1, tAuth("resetPassword.passwordRequired"))
        .refine(isPasswordStrong, {
          message: tAuth("resetPassword.passwordWeak"),
        }),
      confirm: z.string(),
    })
    .refine((values) => values.password === values.confirm, {
      message: tAuth("resetPassword.confirmMismatch"),
      path: ["confirm"],
    });
}

export type ResetPasswordFormValues = z.infer<
  ReturnType<typeof buildResetPasswordSchema>
>;
