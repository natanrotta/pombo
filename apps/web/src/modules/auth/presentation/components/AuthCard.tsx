import type { PropsWithChildren } from "react";
import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  TRANSITION_PAGE_SWAP,
  TRANSITION_SLOW,
} from "@/shared/constants/animation";

const MotionBox = motion.create(Box);

/** Horizontal distance the card travels on a sign-in ↔ register swap. */
const SWAP_OFFSET = 64;

interface AuthCardProps extends PropsWithChildren {
  /** `split`: the floating card next to the hero. `centered`: the secondary
   *  steps, which carry the platform name above the title instead. */
  variant: "split" | "centered";
  title: string;
  subtitle: string;
  /** Side the card slides in from after switching between sign-in and
   *  register; without it the card fades up. */
  enterFrom?: "left" | "right";
}

export function AuthCard({
  variant,
  title,
  subtitle,
  enterFrom,
  children,
}: AuthCardProps) {
  const { t } = useTranslation("common");
  const isSplit = variant === "split";

  const initial = enterFrom
    ? { opacity: 0, x: enterFrom === "left" ? -SWAP_OFFSET : SWAP_OFFSET }
    : { opacity: 0, y: 12 };

  return (
    <MotionBox
      bg="bg.surface"
      borderWidth="1px"
      borderColor="border.subtle"
      boxShadow={isSplit ? "shadow.authCard" : "shadow.panel"}
      borderRadius="3xl"
      p={{ base: 6, md: 8 }}
      initial={initial}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={enterFrom ? TRANSITION_PAGE_SWAP : TRANSITION_SLOW}
      w="full"
    >
      <Stack gap={isSplit ? 1.5 : 2} mb={isSplit ? 7 : 6}>
        {!isSplit && (
          <Text
            fontWeight="700"
            color="text.brand"
            letterSpacing="wide"
            fontSize="sm"
          >
            {t("platform.name")}
          </Text>
        )}
        <Heading size="lg" letterSpacing={isSplit ? "-0.01em" : undefined}>
          {title}
        </Heading>
        <Text color="text.secondary" fontSize={isSplit ? "sm" : undefined}>
          {subtitle}
        </Text>
      </Stack>
      {children}
    </MotionBox>
  );
}
