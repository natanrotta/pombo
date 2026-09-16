import { memo } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";

/** Ink of the number. `default` is the primary text color. */
export type StatTileTone = "default" | "success" | "error" | "info";

export interface StatTileItem {
  label: string;
  value: string;
  tone?: StatTileTone;
}

interface StatTilesProps {
  items: StatTileItem[];
}

const toneColors: Record<StatTileTone, string> = {
  default: "text.primary",
  success: "status.success.fg",
  error: "status.error.fg",
  info: "status.info.fg",
};

/**
 * The counters above a list: one bordered block split into equal tiles by 1px
 * rules (the grid's own `gap` over a border-colored background), each with a
 * tiny uppercase label and a big mono number.
 */
function StatTilesComponent({ items }: StatTilesProps) {
  return (
    <Box
      display="grid"
      gridTemplateColumns={{
        base: "repeat(2, 1fr)",
        md: "repeat(auto-fit, minmax(118px, 1fr))",
      }}
      gap="1px"
      bg="border.default"
      borderWidth="1px"
      borderColor="border.default"
      borderRadius="lg"
      overflow="hidden"
      data-cy="stat-tiles"
    >
      {items.map((item, index) => (
        <Flex
          key={item.label}
          direction="column"
          gap={2}
          bg="bg.surface"
          px={4.5}
          py={4}
          // Two per row on a phone: an odd last tile takes the whole row
          // instead of leaving a hole in the block.
          gridColumn={{
            base:
              index === items.length - 1 && items.length % 2 === 1
                ? "span 2"
                : "auto",
            md: "auto",
          }}
        >
          <Text textStyle="eyebrow" color="text.muted">
            {item.label}
          </Text>
          <Text textStyle="metric" color={toneColors[item.tone ?? "default"]}>
            {item.value}
          </Text>
        </Flex>
      ))}
    </Box>
  );
}

export const StatTiles = memo(StatTilesComponent);
