import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Link,
  Stack,
  Text,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { FormEvent, useMemo, useState } from "react";
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
import { isPasswordStrong } from "@/shared/utils/passwordValidation";
import { LanguageSelector } from "@/shared/components/ui/LanguageSelector";

const MotionBox = motion.create(Box);

interface ResetFormErrors {
  password?: string;
  confirm?: string;
}

export function ResetPasswordPage() {
  const { t } = useTranslation("auth");
  const { t: tc } = useTranslation("common");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { resetPassword } = useAuth();
  const { showError, showSuccess } = useNotify();

  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<ResetFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    const next: ResetFormErrors = {};
    if (!password) {
      next.password = t("resetPassword.passwordRequired");
    } else if (!isPasswordStrong(password)) {
      next.password = t("resetPassword.passwordWeak");
    }
    if (password !== confirm) {
      next.confirm = t("resetPassword.confirmMismatch");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await resetPassword({ token, password });
      showSuccess(t("resetPassword.success"));
      navigate(ROUTE_PATHS.signIn, { replace: true });
    } catch (error) {
      showError(error, t("resetPassword.failure"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const invalidToken = !token;

  const card = (
    <MotionBox
      bg="bg.surface"
      borderWidth="1px"
      borderColor="border.subtle"
      boxShadow="shadow.panel"
      borderRadius="3xl"
      p={{ base: 6, md: 8 }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      w="full"
    >
      <Stack gap={2} mb={6}>
        <Text
          fontWeight="700"
          color="brand.600"
          letterSpacing="wide"
          fontSize="sm"
        >
          {tc("platform.name")}
        </Text>
        <Heading size="lg">{t("resetPassword.title")}</Heading>
        <Text color="text.secondary">{t("resetPassword.subtitle")}</Text>
      </Stack>

      {invalidToken ? (
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
      ) : (
        <Stack as="form" gap={4} onSubmit={handleSubmit}>
          <PasswordField
            label={t("resetPassword.passwordLabel")}
            value={password}
            error={errors.password}
            onChange={setPassword}
            placeholder={t("resetPassword.passwordPlaceholder")}
          />
          <PasswordStrengthIndicator password={password} />
          <PasswordField
            label={t("resetPassword.confirmLabel")}
            value={confirm}
            error={errors.confirm}
            onChange={setConfirm}
            placeholder={t("resetPassword.confirmPlaceholder")}
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
            <Link asChild color="brand.600" fontWeight="600">
              <RouterLink to={ROUTE_PATHS.signIn}>
                {t("resetPassword.backToSignIn")}
              </RouterLink>
            </Link>
          </Text>
        </Stack>
      )}
    </MotionBox>
  );

  return (
    <Flex minH="100vh" align="center" justify="center" px={4} py={8}>
      <Container maxW="md" px={0}>
        <Flex justify="flex-end" mb={4}>
          <LanguageSelector />
        </Flex>
        {card}
      </Container>
    </Flex>
  );
}
