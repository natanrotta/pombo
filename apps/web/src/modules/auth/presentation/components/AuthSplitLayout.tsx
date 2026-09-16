import type { PropsWithChildren } from "react";
import {
  Box,
  chakra,
  Flex,
  Heading,
  Image,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { AuthControls } from "@/modules/auth/presentation/components/AuthControls";
import pomboIcon from "@assets/pombo-icon.svg";

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
      <Stack gap={3} position="relative" maxW="520px" w="full">
        <BrandTile />
        <BrandEyebrow />

        <Heading
          as="h1"
          fontFamily="heading"
          fontWeight="600"
          fontSize={{ lg: "46px", xl: "56px" }}
          lineHeight="1.04"
          letterSpacing="-3px"
          maxW="13ch"
          color="text.primary"
          mt={2}
        >
          {t("hero.titleLead")}{" "}
          <chakra.span
            // The one word that carries the brand, swept by a slow gradient.
            backgroundImage="linear-gradient(100deg, {colors.brand.400}, {colors.brand.200}, {colors.brand.400})"
            backgroundSize="200% auto"
            backgroundClip="text"
            color="transparent"
            animation="brandSweep 5s linear infinite"
          >
            {t("hero.titleHighlight")}
          </chakra.span>
          <chakra.span color="text.brand" aria-hidden="true">
            .
          </chakra.span>
        </Heading>

        <Text fontSize="17px" lineHeight="1.5" color="text.secondary" maxW="36ch">
          {tc("platform.tagline")}
        </Text>

        <Flex gap={2} wrap="wrap" mt={2.5}>
          <HeroPill label={t("hero.pills.api")} isLive />
          <HeroPill label={t("hero.pills.pace")} />
          <HeroPill label={t("hero.pills.webhooks")} />
        </Flex>
      </Stack>
    </Flex>
  );
}

/** The brand mark: the icon on a panel tile, floating, with a ring leaving it. */
function BrandTile() {
  const { t } = useTranslation("common");

  return (
    <Box position="relative" w="74px" h="74px" animation="brandFloat 5.5s ease-in-out infinite">
      <Box
        aria-hidden
        position="absolute"
        inset={0}
        borderRadius="xl"
        borderWidth="1px"
        borderColor="border.brand"
        animation="brandRing 3.2s ease-out infinite"
      />
      <Flex
        position="relative"
        w="74px"
        h="74px"
        align="center"
        justify="center"
        borderRadius="xl"
        bg="bg.surface"
        borderWidth="1px"
        borderColor="border.accent"
        boxShadow="shadow.brandMark"
      >
        <Image src={pomboIcon} alt={t("platform.name")} w="44px" h="44px" />
      </Flex>
    </Box>
  );
}

/** A capability the product states on the auth screen. */
function HeroPill({ label, isLive = false }: { label: string; isLive?: boolean }) {
  return (
    <Flex
      align="center"
      gap={2}
      bg="bg.surface"
      borderWidth="1px"
      borderColor="border.default"
      borderRadius="full"
      px={3.5}
      py={2}
      textStyle="mono"
      fontSize="13.5px"
      color="text.secondary"
    >
      {isLive && (
        <Box
          as="span"
          w="5px"
          h="5px"
          borderRadius="full"
          bg="status.success.fg"
          boxShadow="0 0 8px currentColor"
          color="status.success.fg"
          animation="statusBlink 2.4s ease-in-out infinite"
        />
      )}
      {label}
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
      fontFamily="mono"
      fontSize="12.5px"
      fontWeight="500"
      letterSpacing="3.4px"
      textTransform="uppercase"
      color="text.brand"
    >
      {t("platform.name")}
    </Text>
  );
}
