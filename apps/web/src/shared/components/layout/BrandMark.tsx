import { Box, Flex, Image, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import pomboIcon from "@assets/pombo-icon.svg";

interface BrandMarkProps {
  /** `sidebar`: larger logo with the tagline. `header`: compact mobile bar. */
  variant: "sidebar" | "header";
  /** Hides the name (and tagline), leaving the logo centered. */
  isCollapsed?: boolean;
}

export function BrandMark({ variant, isCollapsed = false }: BrandMarkProps) {
  const { t } = useTranslation("common");
  const isSidebar = variant === "sidebar";
  const name = t("platform.name");

  return (
    <Flex
      align="center"
      gap={isSidebar ? 3 : 2}
      justify={isCollapsed ? "center" : "flex-start"}
    >
      <Image
        src={pomboIcon}
        // Decorative next to the visible name; the only label when collapsed.
        alt={isCollapsed ? name : ""}
        boxSize={isSidebar ? 9 : 7}
        borderRadius="22%"
        objectFit="cover"
        boxShadow={isSidebar ? "shadow.card" : undefined}
        flexShrink={0}
      />
      {!isCollapsed && (
        <Box flex={1} minW={0}>
          <Text
            fontFamily="mono"
            fontSize="14.5px"
            fontWeight="600"
            color="text.primary"
            letterSpacing="-0.2px"
            textTransform="lowercase"
            whiteSpace="nowrap"
          >
            {name}
          </Text>
          {isSidebar && (
            <Text textStyle="mono" color="text.muted" whiteSpace="nowrap">
              {t("platform.tagline")}
            </Text>
          )}
        </Box>
      )}
    </Flex>
  );
}
