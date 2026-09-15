import { memo } from "react";
import { Box, Button, Icon, Text, VStack } from "@chakra-ui/react";
import { motion } from "framer-motion";
import { FiInbox } from "@/shared/components/icons";
import type { IconType } from "@/shared/components/icons";

const MotionVStack = motion.create(VStack);
const MotionBox = motion.create(Box);
const MotionText = motion.create(Text);

import { EASE_ORGANIC as ease } from "@/shared/constants/animation";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Secondary action shown as a ghost link next to the primary CTA. */
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  icon?: IconType;
  size?: "sm" | "md" | "lg";
}

const sizeStyles = {
  sm: {
    py: { base: 6, md: 8 },
    iconBox: 10,
    iconSize: 5,
    titleSize: "sm" as const,
    ringSize: 14,
  },
  md: {
    py: { base: 10, md: 14 },
    iconBox: 14,
    iconSize: 6,
    titleSize: "md" as const,
    ringSize: 20,
  },
  lg: {
    py: { base: 14, md: 20 },
    iconBox: 16,
    iconSize: 7,
    titleSize: "lg" as const,
    ringSize: 24,
  },
};

function EmptyStateComponent({
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  icon: IconComponent = FiInbox,
  size = "md",
}: EmptyStateProps) {
  const s = sizeStyles[size];

  return (
    <MotionVStack
      gap={4}
      textAlign="center"
      py={s.py}
      px={4}
      borderRadius="xl"
      bg="bg.surface"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease }}
    >
      {/* Icon with float + pulse ring */}
      <MotionBox
        position="relative"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease }}
      >
        {/* Pulse ring */}
        <Box
          position="absolute"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          w={s.ringSize}
          h={s.ringSize}
          borderRadius="full"
          bgGradient="to-br"
          gradientFrom="brand.50"
          gradientTo="accent.50"
          animation="emptyStatePulse 3s ease-in-out infinite"
          css={{
            "@keyframes emptyStatePulse": {
              "0%, 100%": {
                opacity: 0.6,
                transform: "translate(-50%, -50%) scale(1)",
              },
              "50%": {
                opacity: 0,
                transform: "translate(-50%, -50%) scale(1.4)",
              },
            },
          }}
        />

        {/* Floating icon */}
        <MotionBox
          p={3}
          borderRadius="full"
          w={s.iconBox}
          h={s.iconBox}
          display="flex"
          alignItems="center"
          justifyContent="center"
          bgGradient="to-br"
          gradientFrom="brand.50"
          gradientTo="accent.50"
          color="brand.500"
          position="relative"
          animate={{ y: [0, -4, 0] }}
          transition={{
            y: {
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            },
          }}
        >
          <Icon boxSize={s.iconSize}>
            <IconComponent />
          </Icon>
        </MotionBox>
      </MotionBox>

      {/* Title */}
      <MotionBox
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1, ease }}
      >
        <Text fontWeight="700" fontSize={s.titleSize}>
          {title}
        </Text>
      </MotionBox>

      {/* Description */}
      <MotionText
        color="text.secondary"
        maxW="420px"
        fontSize="sm"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2, ease }}
      >
        {description}
      </MotionText>

      {/* Action buttons (primary + optional secondary as a ghost link) */}
      {actionLabel && onAction ? (
        <MotionBox
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.3, ease }}
          display="flex"
          alignItems="center"
          gap={2}
        >
          <Button variant="subtle" onClick={onAction}>
            {actionLabel}
          </Button>
          {secondaryActionLabel && onSecondaryAction ? (
            <Button variant="ghost" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          ) : null}
        </MotionBox>
      ) : null}
    </MotionVStack>
  );
}

export const EmptyState = memo(EmptyStateComponent);
