import { useState } from "react";
import { Button, Flex, Icon, Link, Stack, Text } from "@chakra-ui/react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { FiCheckCircle } from "@/shared/components/icons";
import { ROUTE_PATHS } from "@/app/router/RoutePaths";
import { isRateLimitError } from "@/core/errors/AppError";
import { useAuth } from "@/modules/auth/presentation/context/useAuth";
import { useNotify } from "@/shared/hooks/useNotify";
import { FormField } from "@/shared/components/forms/FormField";
import { AuthCenteredLayout } from "@/modules/auth/presentation/components/AuthCenteredLayout";
import { AuthCard } from "@/modules/auth/presentation/components/AuthCard";
import {
  buildForgotPasswordSchema,
  type ForgotPasswordFormValues,
} from "@/modules/auth/domain/schemas";

export function ForgotPasswordPage() {
  const { t } = useTranslation("auth");
  const { requestPasswordReset } = useAuth();
  const { showError } = useNotify();

  // The address the reset link went to; set once the request succeeds.
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(buildForgotPasswordSchema()),
    defaultValues: { email: "" },
    mode: "onSubmit",
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    try {
      await requestPasswordReset({ email });
      setSentTo(email);
    } catch (error) {
      // Only a rate limit is worth detailing; anything else stays generic.
      showError(
        isRateLimitError(error) ? error : undefined,
        t("forgotPassword.requestError"),
      );
    }
  });

  return (
    <AuthCenteredLayout>
      <AuthCard
        variant="centered"
        title={t("forgotPassword.title")}
        subtitle={t("forgotPassword.subtitle")}
      >
        {sentTo ? (
          <Stack gap={5} align="stretch">
            <Flex
              align="center"
              gap={3}
              p={4}
              bg="bg.accent.subtle"
              color="text.brand"
              borderRadius="xl"
              borderWidth="1px"
              borderColor="border.accent"
            >
              <Icon boxSize={5} flexShrink={0}>
                <FiCheckCircle />
              </Icon>
              <Text fontSize="sm" fontWeight="500">
                {t("forgotPassword.sentMessage", { email: sentTo })}
              </Text>
            </Flex>
            <Text fontSize="sm" color="text.secondary">
              {t("forgotPassword.sentHint")}
            </Text>
            <Button asChild variant="outline" size="lg">
              <RouterLink to={ROUTE_PATHS.signIn}>
                {t("forgotPassword.backToSignIn")}
              </RouterLink>
            </Button>
          </Stack>
        ) : (
          <Stack asChild gap={4}>
            <form onSubmit={onSubmit} noValidate>
              <Controller
                control={control}
                name="email"
                render={({ field }) => (
                  <FormField
                    label={t("forgotPassword.emailLabel")}
                    type="email"
                    autoComplete="email"
                    value={field.value}
                    error={errors.email?.message}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder={t("forgotPassword.emailPlaceholder")}
                  />
                )}
              />
              <Button
                type="submit"
                size="lg"
                loading={isSubmitting}
                loadingText={t("forgotPassword.submitting")}
                mt={2}
              >
                {t("forgotPassword.submit")}
              </Button>
              <Text color="text.secondary" fontSize="sm" textAlign="center">
                <Link asChild color="text.brand" fontWeight="600">
                  <RouterLink to={ROUTE_PATHS.signIn}>
                    {t("forgotPassword.backToSignIn")}
                  </RouterLink>
                </Link>
              </Text>
            </form>
          </Stack>
        )}
      </AuthCard>
    </AuthCenteredLayout>
  );
}
