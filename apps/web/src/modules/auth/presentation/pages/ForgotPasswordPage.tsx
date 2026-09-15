import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  Icon,
  Link,
  Stack,
  Text,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { FiCheckCircle } from "@/shared/components/icons";
import { ROUTE_PATHS } from "@/app/router/RoutePaths";
import { useAuth } from "@/modules/auth/presentation/context/useAuth";
import { useNotify } from "@/shared/hooks/useNotify";
import { FormField } from "@/shared/components/forms/FormField";
import { LanguageSelector } from "@/shared/components/ui/LanguageSelector";

const MotionBox = motion.create(Box);

export function ForgotPasswordPage() {
  const { t } = useTranslation("auth");
  const { t: tc } = useTranslation("common");
  const { requestPasswordReset } = useAuth();
  const { showError } = useNotify();

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!email.trim()) {
      setEmailError(t("forgotPassword.emailRequired"));
      return;
    }
    setEmailError(undefined);

    setIsSubmitting(true);
    try {
      await requestPasswordReset({ email });
      setSent(true);
    } catch {
      showError(undefined, t("forgotPassword.requestError"));
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <Heading size="lg">{t("forgotPassword.title")}</Heading>
        <Text color="text.secondary">{t("forgotPassword.subtitle")}</Text>
      </Stack>

      {sent ? (
        <Stack gap={5} align="stretch">
          <Flex
            align="center"
            gap={3}
            p={4}
            bg="brand.50"
            color="brand.700"
            borderRadius="xl"
            borderWidth="1px"
            borderColor="brand.100"
          >
            <Icon boxSize={5} flexShrink={0}>
              <FiCheckCircle />
            </Icon>
            <Text fontSize="sm" fontWeight="500">
              {t("forgotPassword.sentMessage", { email })}
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
        <Stack as="form" gap={4} onSubmit={handleSubmit}>
          <FormField
            label={t("forgotPassword.emailLabel")}
            type="email"
            value={email}
            error={emailError}
            onChange={setEmail}
            placeholder={t("forgotPassword.emailPlaceholder")}
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
            <Link asChild color="brand.600" fontWeight="600">
              <RouterLink to={ROUTE_PATHS.signIn}>
                {t("forgotPassword.backToSignIn")}
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
