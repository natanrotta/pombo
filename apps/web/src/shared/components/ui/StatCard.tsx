import { memo } from "react";
import { Box, Flex, Icon, Stat, Text } from "@chakra-ui/react";
import type { IconType } from "@/shared/components/icons";
import { SectionCard } from "@/shared/components/ui/SectionCard";

/** Accent palette for the icon chip + value. `brand` is the default; the
 *  others pull from the shared semantic status tokens (never raw hex). */
export type StatCardTone =
  "brand" | "success" | "info" | "neutral" | "error" | "blue";

interface StatCardProps {
  label: string;
  value: string;
  hint: string;
  icon: IconType;
  trend?: "up" | "down" | "neutral";
  tone?: StatCardTone;
}

const trendColors = {
  up: "text.accent",
  down: "status.error.fg",
  neutral: "text.secondary",
} as const;

const toneStyles = {
  brand: { bg: "bg.brand.subtle", border: "border.brand", fg: "text.brand" },
  success: {
    bg: "status.success.bg",
    border: "status.success.border",
    fg: "status.success.fg",
  },
  info: {
    bg: "status.info.bg",
    border: "status.info.border",
    fg: "status.info.fg",
  },
  neutral: {
    bg: "status.neutral.bg",
    border: "status.neutral.border",
    fg: "status.neutral.fg",
  },
  error: {
    bg: "status.error.bg",
    border: "status.error.border",
    fg: "status.error.fg",
  },
  blue: {
    bg: "status.blue.bg",
    border: "status.blue.border",
    fg: "status.blue.fg",
  },
} as const;

export const StatCard = memo(function StatCard({
  label,
  value,
  hint,
  icon: IconComponent,
  trend = "neutral",
  tone = "brand",
}: StatCardProps) {
  const accent = toneStyles[tone];
  return (
    <SectionCard>
      <Flex justify="space-between" align="flex-start">
        <Stat.Root>
          <Stat.Label color="text.secondary" fontWeight="500">
            {label}
          </Stat.Label>
          <Stat.ValueText
            mt={2}
            fontSize={{ base: "2xl", md: "3xl" }}
            color={accent.fg}
          >
            {value}
          </Stat.ValueText>
          <Stat.HelpText mb={0} mt={2}>
            <Text color={trendColors[trend]} fontWeight="600" as="span">
              {hint}
            </Text>
          </Stat.HelpText>
        </Stat.Root>

        <Box
          p={2.5}
          borderRadius="md"
          bg={accent.bg}
          color={accent.fg}
          borderWidth="1px"
          borderColor={accent.border}
        >
          <Icon boxSize={5}>
            <IconComponent />
          </Icon>
        </Box>
      </Flex>
    </SectionCard>
  );
});
