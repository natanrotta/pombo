import type { PropsWithChildren } from "react";
import {
  Box,
  Flex,
  Heading,
  Image,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { AuthControls } from "@/modules/auth/presentation/components/AuthControls";
import pomboIcon from "@assets/pombo-icon.svg";

const MotionImage = motion.create(Image);

interface GlowSpec {
  id: string;
  position: { top?: string; left?: string; bottom?: string; right?: string };
  size: string;
  // Full literal per glow: the token-contract spec reads semantic token names
  // straight from the source.
  image: string;
}

// Full-page ambient gradients behind the whole screen.
const GLOWS: GlowSpec[] = [
  {
    id: "primary",
    position: { top: "-20%", left: "-15%" },
    size: "780px",
    image: "radial-gradient(circle, {colors.bg.glow.primary}, transparent 70%)",
  },
  {
    id: "secondary",
    position: { bottom: "-25%", right: "-15%" },
    size: "720px",
    image: "radial-gradient(circle, {colors.bg.glow.secondary}, transparent 70%)",
  },
  {
    id: "tertiary",
    position: { top: "40%", left: "45%" },
    size: "520px",
    image: "radial-gradient(circle, {colors.bg.glow.tertiary}, transparent 70%)",
  },
];

/**
 * Two-column frame for sign-in and register: the brand hero on the left
 * (`lg`+), the card on the right, a compact brand above the card on mobile.
 */
export function AuthSplitLayout({ children }: PropsWithChildren) {
  return (
    <Box position="relative" minH="100vh" bg="bg.canvas" overflow="hidden">
      {GLOWS.map((glow) => (
        <Box
          key={glow.id}
          aria-hidden
          position="absolute"
          {...glow.position}
          w={glow.size}
          h={glow.size}
          borderRadius="full"
          backgroundImage={glow.image}
          pointerEvents="none"
          zIndex={0}
        />
      ))}

      <Box
        position="absolute"
        top={{ base: 4, md: 6 }}
        right={{ base: 4, md: 6 }}
        zIndex={2}
      >
        <AuthControls />
      </Box>

      <SimpleGrid
        columns={{ base: 1, lg: 2 }}
        minH="100vh"
        maxW="7xl"
        mx="auto"
        position="relative"
        zIndex={1}
      >
        <AuthHero />

        <Flex
          direction="column"
          align={{ base: "center", lg: "flex-start" }}
          justify="center"
          px={{ base: 4, md: 8, lg: 16 }}
          py={{ base: 8, md: 12 }}
        >
          <Box w="full" maxW="440px">
            <AuthMobileBrand />
            {children}
          </Box>
        </Flex>
      </SimpleGrid>
    </Box>
  );
}

function AuthHero() {
  const { t } = useTranslation("auth");
  const { t: tc } = useTranslation("common");

  return (
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
          <BrandEyebrow />
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
}

function AuthMobileBrand() {
  const { t } = useTranslation("common");

  return (
    <Stack
      gap={3}
      align="center"
      mb={6}
      display={{ base: "flex", lg: "none" }}
      position="relative"
    >
      <Image
        src={pomboIcon}
        alt={t("platform.name")}
        w={16}
        h={16}
        borderRadius="22%"
        objectFit="cover"
        boxShadow="shadow.brandMarkSm"
      />
      <BrandEyebrow />
    </Stack>
  );
}

function BrandEyebrow() {
  const { t } = useTranslation("common");

  return (
    <Text
      fontSize="xs"
      fontWeight="700"
      letterSpacing="0.18em"
      textTransform="uppercase"
      color="text.brand"
    >
      {t("platform.name")}
    </Text>
  );
}
