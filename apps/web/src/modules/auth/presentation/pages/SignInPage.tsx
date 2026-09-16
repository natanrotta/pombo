import {
  Box,
  Button,
  Separator,
  Flex,
  Heading,
  Icon,
  Image,
  Input,
  Link,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import { Field } from "@/components/ui/field";
import { motion } from "framer-motion";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { FiArrowRight } from "@/shared/components/icons";
import { ROUTE_PATHS } from "@/app/router/RoutePaths";
import { useAuth } from "@/modules/auth/presentation/context/useAuth";
import { getPostAuthDestination } from "@/modules/auth/presentation/utils/postAuthDestination";
import type { AuthUser } from "@/modules/auth/domain/entities/AuthUser";

/**
 * Bridges deep-links that bounce through sign-in (e.g. /workplace-invite/:code)
 * with the standard post-auth destination logic. When the caller set
 * `location.state.from.pathname`, return there so the user lands exactly
 * where they intended; otherwise defer to {@link getPostAuthDestination}.
 */
function resolveSignInRedirect(state: unknown, user: AuthUser | null): string {
  if (state && typeof state === "object" && "from" in state) {
    const from = (state as { from?: { pathname?: string } }).from;
    if (from?.pathname && from.pathname !== ROUTE_PATHS.signIn) {
      return from.pathname;
    }
  }
  return getPostAuthDestination(user);
}
import { useNotify } from "@/shared/hooks/useNotify";
import { PasswordField } from "@/shared/components/forms/PasswordField";
import { GoogleSignInButton } from "@/modules/auth/presentation/components/GoogleSignInButton";
import { LanguageSelector } from "@/shared/components/ui/LanguageSelector";
import { ColorModeToggle } from "@/shared/components/ui/ColorModeToggle";
import {
  buildSignInSchema,
  type SignInFormValues,
} from "@/modules/auth/domain/schemas";
import {
  TRANSITION_PAGE_SWAP,
  TRANSITION_SLOW,
} from "@/shared/constants/animation";
import pomboIcon from "@assets/pombo-icon.svg";

const MotionBox = motion.create(Box);
const MotionImage = motion.create(Image);

export function SignInPage() {
  const { t, i18n } = useTranslation("auth");
  const { t: tc } = useTranslation("common");
  const navigate = useNavigate();
  const location = useLocation();
  const { showError } = useNotify();
  const { signIn, signInWithGoogle, isSubmitting } = useAuth();

  // Slide horizontally on directional entry; fall back to y-fade for direct visits.
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
    } catch {
      showError(undefined, t("signIn.googleError"));
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
    } catch {
      showError(undefined, t("signIn.authError"));
    }
  });

  const heroPanel = (
    <Flex
      direction="column"
      justify="center"
      align={{ lg: "flex-end" }}
      position="relative"
      px={{ base: 6, md: 12, lg: 16 }}
      py={{ base: 10, lg: 0 }}
      minH={{ lg: "100vh" }}
      display={{ base: "none", lg: "flex" }}
    >
      <Stack gap={7} position="relative" maxW="440px" w="full">
        <MotionImage
          src={pomboIcon}
          alt={tc("platform.name")}
          w={24}
          h={24}
          borderRadius="22%"
          objectFit="cover"
          boxShadow="shadow.brandMark"
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        />

        <Stack gap={3}>
          <Text
            fontSize="xs"
            fontWeight="700"
            letterSpacing="0.18em"
            textTransform="uppercase"
            color="text.brand"
          >
            {tc("platform.name")}
          </Text>
          <Heading
            fontSize={{ lg: "4xl", xl: "5xl" }}
            lineHeight="1.1"
            letterSpacing="-0.02em"
            color="text.primary"
            fontWeight="800"
          >
            {t("signIn.subtitle")}
          </Heading>
          <Text fontSize="md" color="text.secondary">
            {tc("platform.tagline")}
          </Text>
        </Stack>
      </Stack>
    </Flex>
  );

  const mobileBrand = (
    <Stack
      gap={3}
      align="center"
      mb={6}
      display={{ base: "flex", lg: "none" }}
      position="relative"
    >
      <Image
        src={pomboIcon}
        alt={tc("platform.name")}
        w={16}
        h={16}
        borderRadius="22%"
        objectFit="cover"
        boxShadow="shadow.brandMarkSm"
      />
      <Text
        fontSize="xs"
        fontWeight="700"
        letterSpacing="0.18em"
        textTransform="uppercase"
        color="text.brand"
      >
        {tc("platform.name")}
      </Text>
    </Stack>
  );

  const loginCard = (
    <MotionBox
      bg="bg.surface"
      borderWidth="1px"
      borderColor="border.subtle"
      boxShadow="shadow.authCard"
      borderRadius="3xl"
      p={{ base: 6, md: 8 }}
      initial={fromRegister ? { opacity: 0, x: -64 } : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={fromRegister ? TRANSITION_PAGE_SWAP : TRANSITION_SLOW}
      w="full"
    >
      <Stack gap={1.5} mb={7}>
        <Heading size="lg" letterSpacing="-0.01em">
          {t("signIn.title")}
        </Heading>
        <Text color="text.secondary" fontSize="sm">
          {t("signIn.subtitle")}
        </Text>
      </Stack>

      <GoogleSignInButton
        onSuccess={handleGoogleSuccess}
        onError={() => showError(undefined, t("signIn.googleInitError"))}
      />

      <Flex align="center" my={4}>
        <Separator flex="1" />
        <Text px={3} color="text.secondary" fontSize="sm" whiteSpace="nowrap">
          {t("signIn.or")}
        </Text>
        <Separator flex="1" />
      </Flex>

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
    </MotionBox>
  );

  return (
    <Box position="relative" minH="100vh" bg="bg.canvas" overflow="hidden">
      {/* Full-page ambient gradient — sits behind everything */}
      <Box
        aria-hidden
        position="absolute"
        top="-20%"
        left="-15%"
        w="780px"
        h="780px"
        borderRadius="full"
        backgroundImage="radial-gradient(circle, {colors.bg.glow.primary}, transparent 70%)"
        pointerEvents="none"
        zIndex={0}
      />
      <Box
        aria-hidden
        position="absolute"
        bottom="-25%"
        right="-15%"
        w="720px"
        h="720px"
        borderRadius="full"
        backgroundImage="radial-gradient(circle, {colors.bg.glow.secondary}, transparent 70%)"
        pointerEvents="none"
        zIndex={0}
      />
      <Box
        aria-hidden
        position="absolute"
        top="40%"
        left="45%"
        w="520px"
        h="520px"
        borderRadius="full"
        backgroundImage="radial-gradient(circle, {colors.bg.glow.tertiary}, transparent 70%)"
        pointerEvents="none"
        zIndex={0}
      />

      <Flex
        position="absolute"
        top={{ base: 4, md: 6 }}
        right={{ base: 4, md: 6 }}
        zIndex={2}
        align="center"
        gap={2}
      >
        <ColorModeToggle size="sm" />
        <LanguageSelector />
      </Flex>

      <SimpleGrid
        columns={{ base: 1, lg: 2 }}
        minH="100vh"
        maxW="7xl"
        mx="auto"
        position="relative"
        zIndex={1}
      >
        {heroPanel}

        <Flex
          direction="column"
          align={{ base: "center", lg: "flex-start" }}
          justify="center"
          px={{ base: 4, md: 8, lg: 16 }}
          py={{ base: 8, md: 12 }}
        >
          <Box w="full" maxW="440px">
            {mobileBrand}
            {loginCard}
          </Box>
        </Flex>
      </SimpleGrid>
    </Box>
  );
}
