import { Button, Flex, Icon, Input, Link, Stack, Text } from "@chakra-ui/react";
import { Field } from "@/components/ui/field";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { FiArrowRight } from "@/shared/components/icons";
import { ROUTE_PATHS } from "@/app/router/RoutePaths";
import { isRateLimitError } from "@/core/errors/AppError";
import { useAuth } from "@/modules/auth/presentation/context/useAuth";
import { resolveSignInRedirect } from "@/modules/auth/presentation/utils/postAuthDestination";
import { useNotify } from "@/shared/hooks/useNotify";
import { PasswordField } from "@/shared/components/forms/PasswordField";
import { GoogleSignInButton } from "@/modules/auth/presentation/components/GoogleSignInButton";
import { AuthSplitLayout } from "@/modules/auth/presentation/components/AuthSplitLayout";
import { AuthCard } from "@/modules/auth/presentation/components/AuthCard";
import { AuthDivider } from "@/modules/auth/presentation/components/AuthDivider";
import {
  buildSignInSchema,
  type SignInFormValues,
} from "@/modules/auth/domain/schemas";

export function SignInPage() {
  const { t, i18n } = useTranslation("auth");
  const navigate = useNavigate();
  const location = useLocation();
  const { showError } = useNotify();
  const { signIn, signInWithGoogle, isSubmitting } = useAuth();

  // Slide in from the left when arriving from register; fade up otherwise.
  const fromRegister =
    (location.state as { from?: string } | null)?.from === "register";

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<SignInFormValues>({
    resolver: zodResolver(buildSignInSchema()),
    defaultValues: { email: "", password: "" },
    mode: "onSubmit",
  });

  const handleGoogleSuccess = async (credential: string) => {
    try {
      // Forward UI locale so brand-new accounts reaching here via Google
      // get user.language seeded correctly. Existing accounts ignore it.
      const session = await signInWithGoogle({
        credential,
        language: i18n.language,
      });
      navigate(resolveSignInRedirect(location.state, session.user), {
        replace: true,
      });
    } catch (error) {
      showError(
        isRateLimitError(error) ? error : undefined,
        t("signIn.googleError"),
      );
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    try {
      const session = await signIn({
        email: values.email,
        password: values.password,
      });
      navigate(resolveSignInRedirect(location.state, session.user), {
        replace: true,
      });
    } catch (error) {
      // Credential failures stay generic; a rate limit tells the user to wait.
      showError(
        isRateLimitError(error) ? error : undefined,
        t("signIn.authError"),
      );
    }
  });

  return (
    <AuthSplitLayout>
      <AuthCard
        variant="split"
        title={t("signIn.title")}
        subtitle={t("signIn.subtitle")}
        enterFrom={fromRegister ? "left" : undefined}
      >
        <GoogleSignInButton
          onSuccess={handleGoogleSuccess}
          onError={() => showError(undefined, t("signIn.googleInitError"))}
        />

        <AuthDivider label={t("signIn.or")} />

        <Stack asChild gap={4}>
          <form onSubmit={onSubmit} noValidate>
            <Field
              invalid={Boolean(errors.email)}
              label={t("signIn.emailLabel")}
              errorText={errors.email?.message}
            >
              {/* F-H6 exception: RHF register() needs a ref-spread input; FormField is controlled-only. */}
              <Input
                type="email"
                placeholder={t("signIn.emailPlaceholder")}
                autoComplete="email"
                {...register("email")}
              />
            </Field>

            <Controller
              control={control}
              name="password"
              render={({ field }) => (
                <PasswordField
                  label={t("signIn.passwordLabel")}
                  value={field.value}
                  error={errors.password?.message}
                  onChange={field.onChange}
                  placeholder={t("signIn.passwordPlaceholder")}
                  autoComplete="current-password"
                />
              )}
            />

            <Flex justify="flex-end" mt={-1}>
              <Link asChild color="text.brand" fontSize="sm" fontWeight="500">
                <RouterLink to={ROUTE_PATHS.forgotPassword}>
                  {t("signIn.forgotPassword")}
                </RouterLink>
              </Link>
            </Flex>

            <Button
              type="submit"
              size="lg"
              loading={isSubmitting}
              loadingText={t("signIn.loading")}
              mt={2}
            >
              {t("signIn.button")}
            </Button>
          </form>
        </Stack>

        <Text color="text.secondary" fontSize="sm" mt={6} textAlign="center">
          {t("signIn.noAccount")}{" "}
          <Link
            asChild
            color="text.brand"
            fontWeight="600"
            display="inline-flex"
            alignItems="center"
            gap={1}
          >
            <RouterLink to={ROUTE_PATHS.register} state={{ from: "signIn" }}>
              {t("signIn.createAccount")}
              <Icon aria-hidden boxSize={3.5}>
                <FiArrowRight />
              </Icon>
            </RouterLink>
          </Link>
        </Text>
      </AuthCard>
    </AuthSplitLayout>
  );
}
