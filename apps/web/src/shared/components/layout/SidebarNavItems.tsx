import { memo } from "react";
import { Box, Flex, Icon, Text } from "@chakra-ui/react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Tooltip } from "@/components/ui/tooltip";
import {
  navigationSections,
  type NavigationItem,
} from "@/shared/components/layout/navigation";

interface SidebarNavItemsProps {
  isCollapsed: boolean;
  onNavigate?: () => void;
}

export function SidebarNavItems({
  isCollapsed,
  onNavigate,
}: SidebarNavItemsProps) {
  const { t } = useTranslation("common");

  return (
    <Flex
      as="nav"
      aria-label={t("layout.mainNavigation")}
      direction="column"
      gap={4}
      flex={1}
      minH={0}
      overflowY="auto"
      css={{
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": { display: "none" },
      }}
    >
      {navigationSections.map((section, index) => (
        // Static config: sections never reorder, and they have no id.
        <Box key={index}>
          <Flex direction="column" gap={1}>
            {section.items.map((item) => (
              <SidebarNavItem
                key={item.to}
                item={item}
                isCollapsed={isCollapsed}
                onNavigate={onNavigate}
              />
            ))}
          </Flex>
        </Box>
      ))}
    </Flex>
  );
}

interface SidebarNavItemProps {
  item: NavigationItem;
  isCollapsed: boolean;
  onNavigate?: () => void;
}

const SidebarNavItem = memo(function SidebarNavItem({
  item,
  isCollapsed,
  onNavigate,
}: SidebarNavItemProps) {
  const { t } = useTranslation("common");
  const ItemIcon = item.icon;
  const label = t(item.labelKey);

  return (
    <NavLink to={item.to} onClick={onNavigate}>
      {({ isActive }) => {
        const row = (
          <Flex
            align="center"
            justify={isCollapsed ? "center" : "flex-start"}
            gap={3}
            px={isCollapsed ? 0 : 3}
            py={{ base: 2.5, lg: 2 }}
            borderRadius="md"
            bg={isActive ? "bg.brand.subtle" : "transparent"}
            color={isActive ? "text.brand" : "text.secondary"}
            borderLeftWidth={isCollapsed ? "0" : "3px"}
            borderLeftColor={isActive ? "brand.500" : "transparent"}
            cursor="pointer"
            _hover={{
              bg: isActive ? "bg.brand.subtle" : "bg.hover",
              transform: isActive || isCollapsed ? "none" : "translateX(2px)",
            }}
            transition="all 0.18s cubic-bezier(0.22, 1, 0.36, 1)"
          >
            <Icon boxSize="18px" flexShrink={0}>
              <ItemIcon />
            </Icon>
            <Text
              fontWeight={isActive ? "700" : "500"}
              fontSize="sm"
              opacity={isCollapsed ? 0 : 1}
              w={isCollapsed ? 0 : "auto"}
              overflow="hidden"
              transition="opacity 0.15s ease"
              whiteSpace="nowrap"
            >
              {label}
            </Text>
          </Flex>
        );

        if (!isCollapsed) return row;

        return (
          <Tooltip
            content={label}
            positioning={{ placement: "right" }}
            showArrow
            openDelay={200}
          >
            {row}
          </Tooltip>
        );
      }}
    </NavLink>
  );
});
