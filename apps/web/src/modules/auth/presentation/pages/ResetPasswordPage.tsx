import { Button, Link, Stack, Text } from "@chakra-ui/react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import {
  Link as RouterLink,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { ROUTE_PATHS } from "@/app/router/RoutePaths";
import { useAuth } from "@/modules/auth/presentation/context/useAuth";
import { useNotify } from "@/shared/hooks/useNotify";
import { PasswordField } from "@/shared/components/forms/PasswordField";
import { PasswordStrengthIndicator } from "@/shared/components/forms/PasswordStrengthIndicator";
import { AuthCenteredLayout } from "@/modules/auth/presentation/components/AuthCenteredLayout";
import { AuthCard } from "@/modules/auth/presentation/components/AuthCard";
import {
  buildResetPasswordSchema,
  type ResetPasswordFormValues,
} from "@/modules/auth/domain/schemas";

export function ResetPasswordPage() {
  const { t } = useTranslation("auth");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { resetPassword } = useAuth();
  const { showError, showSuccess } = useNotify();

  // The e-mailed link is `/reset-password?token=…`.
  const token = searchParams.get("token") ?? "";

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(buildResetPasswordSchema()),
    defaultValues: { password: "", confirm: "" },
    mode: "onSubmit",
  });

  const password = watch("password");

  const onSubmit = handleSubmit(async (values) => {
    try {
      await resetPassword({ token, password: values.password });
      showSuccess(t("resetPassword.success"));
      navigate(ROUTE_PATHS.signIn, { replace: true });
    } catch (error) {
      showError(error, t("resetPassword.failure"));
    }
  });

  return (
    <AuthCenteredLayout>
      <AuthCard
        variant="centered"
        title={t("resetPassword.title")}
        subtitle={t("resetPassword.subtitle")}
      >
        {token ? (
          <Stack asChild gap={4}>
            <form onSubmit={onSubmit} noValidate>
              <Controller
                control={control}
                name="password"
                render={({ field }) => (
                  <PasswordField
                    label={t("resetPassword.passwordLabel")}
                    value={field.value}
                    error={errors.password?.message}
                    onChange={field.onChange}
                    placeholder={t("resetPassword.passwordPlaceholder")}
                    autoComplete="new-password"
                  />
                )}
              />
              <PasswordStrengthIndicator password={password} />
              <Controller
                control={control}
                name="confirm"
                render={({ field }) => (
                  <PasswordField
                    label={t("resetPassword.confirmLabel")}
                    value={field.value}
                    error={errors.confirm?.message}
                    onChange={field.onChange}
                    placeholder={t("resetPassword.confirmPlaceholder")}
                    autoComplete="new-password"
                  />
                )}
              />
              <Button
                type="submit"
                size="lg"
                loading={isSubmitting}
                loadingText={t("resetPassword.submitting")}
                mt={2}
              >
                {t("resetPassword.submit")}
              </Button>
              <Text color="text.secondary" fontSize="sm" textAlign="center">
                <Link asChild color="text.brand" fontWeight="600">
                  <RouterLink to={ROUTE_PATHS.signIn}>
                    {t("resetPassword.backToSignIn")}
                  </RouterLink>
                </Link>
              </Text>
            </form>
          </Stack>
        ) : (
          <Stack gap={4}>
            <Text color="text.secondary" fontSize="sm">
              {t("resetPassword.missingToken")}
            </Text>
            <Button asChild size="lg">
              <RouterLink to={ROUTE_PATHS.forgotPassword}>
                {t("resetPassword.requestNew")}
              </RouterLink>
            </Button>
          </Stack>
        )}
      </AuthCard>
    </AuthCenteredLayout>
  );
}
