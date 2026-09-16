import { Box, Button, Icon, Input, Link, Stack, Text } from "@chakra-ui/react";
import { Field } from "@/components/ui/field";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { FiArrowLeft } from "@/shared/components/icons";
import { ROUTE_PATHS } from "@/app/router/RoutePaths";
import { isRateLimitError } from "@/core/errors/AppError";
import { useAuth } from "@/modules/auth/presentation/context/useAuth";
import { getPostAuthDestination } from "@/modules/auth/presentation/utils/postAuthDestination";
import { useNotify } from "@/shared/hooks/useNotify";
import { PasswordField } from "@/shared/components/forms/PasswordField";
import { PasswordStrengthIndicator } from "@/shared/components/forms/PasswordStrengthIndicator";
import { GoogleSignInButton } from "@/modules/auth/presentation/components/GoogleSignInButton";
import { AuthSplitLayout } from "@/modules/auth/presentation/components/AuthSplitLayout";
import { AuthCard } from "@/modules/auth/presentation/components/AuthCard";
import { AuthDivider } from "@/modules/auth/presentation/components/AuthDivider";
import {
  buildRegisterSchema,
  type RegisterFormValues,
} from "@/modules/auth/domain/schemas";

export function RegisterPage() {
  const { t, i18n } = useTranslation("auth");
  const navigate = useNavigate();
  const location = useLocation();
  const { showError } = useNotify();
  const { signUp, signInWithGoogle, isSubmitting } = useAuth();

  // Slide in from the right when arriving from sign-in; fade up otherwise.
  const fromSignIn =
    (location.state as { from?: string } | null)?.from === "signIn";

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(buildRegisterSchema()),
    defaultValues: { name: "", email: "", password: "" },
    mode: "onSubmit",
  });

  const password = watch("password");

  const handleGoogleSuccess = async (credential: string) => {
    try {
      // Pass the current UI locale so the backend persists it on user.language
      // for new accounts (no-op on existing accounts — they keep their saved
      // preference).
      const session = await signInWithGoogle({
        credential,
        language: i18n.language,
      });
      navigate(getPostAuthDestination(session.user), { replace: true });
    } catch (error) {
      // Same limiter as sign-in: only a rate limit is worth detailing.
      showError(
        isRateLimitError(error) ? error : undefined,
        t("register.googleError"),
      );
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await signUp({
        name: values.name,
        email: values.email,
        password: values.password,
        // The chosen locale reaches the backend with the very first request so
        // user.language is persisted from the start.
        language: i18n.language,
      });
      // Account created unverified — confirm the e-mail PIN. The email is
      // carried in route state for the copy.
      navigate(ROUTE_PATHS.verifyEmail, {
        replace: true,
        state: { email: result.email },
      });
    } catch (error) {
      showError(error, t("register.createError"));
    }
  });

  return (
    <AuthSplitLayout>
      <AuthCard
        variant="split"
        title={t("register.title")}
        subtitle={t("register.subtitle")}
        enterFrom={fromSignIn ? "right" : undefined}
      >
        <GoogleSignInButton
          onSuccess={handleGoogleSuccess}
          onError={() => showError(undefined, t("register.googleError"))}
        />

        <AuthDivider label={t("register.or")} />

        <Stack asChild gap={4}>
          <form onSubmit={onSubmit} noValidate>
            <Field
              invalid={Boolean(errors.name)}
              label={t("register.nameLabel")}
              errorText={errors.name?.message}
            >
              {/* F-H6 exception: RHF register() needs a ref-spread input; FormField is controlled-only. */}
              <Input
                placeholder={t("register.namePlaceholder")}
                autoComplete="name"
                {...register("name")}
              />
            </Field>

            <Field
              invalid={Boolean(errors.email)}
              label={t("register.emailLabel")}
              errorText={errors.email?.message}
            >
              {/* F-H6 exception: RHF register() needs a ref-spread input; FormField is controlled-only. */}
              <Input
                type="email"
                placeholder={t("register.emailPlaceholder")}
                autoComplete="email"
                {...register("email")}
              />
            </Field>

            <Box>
              <Controller
                control={control}
                name="password"
                render={({ field }) => (
                  <PasswordField
                    label={t("register.passwordLabel")}
                    value={field.value}
                    error={errors.password?.message}
                    onChange={field.onChange}
                    placeholder={t("register.passwordPlaceholder")}
                    autoComplete="new-password"
                  />
                )}
              />
              <PasswordStrengthIndicator password={password ?? ""} />
            </Box>

            <Button
              type="submit"
              size="lg"
              loading={isSubmitting}
              loadingText={t("register.loading")}
              mt={2}
            >
              {t("register.button")}
            </Button>
          </form>
        </Stack>

        <Text color="text.secondary" fontSize="sm" mt={6} textAlign="center">
          {t("register.hasAccount")}{" "}
          <Link
            asChild
            color="text.brand"
            fontWeight="600"
            display="inline-flex"
            alignItems="center"
            gap={1}
          >
            <RouterLink to={ROUTE_PATHS.signIn} state={{ from: "register" }}>
              <Icon aria-hidden boxSize={3.5}>
                <FiArrowLeft />
              </Icon>
              {t("register.signIn")}
            </RouterLink>
          </Link>
        </Text>
      </AuthCard>
    </AuthSplitLayout>
  );
}
