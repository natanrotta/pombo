import { memo } from "react";
import { Box, Flex, Icon, Text } from "@chakra-ui/react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FiCode,
  FiSend,
  FiSmartphone,
  FiUser,
} from "@/shared/components/icons";
import type { IconType } from "@/shared/components/icons";
import { ROUTE_PATHS } from "@/app/router/RoutePaths";

interface BottomNavItem {
  labelKey: string;
  to: string;
  icon: IconType;
  matchPaths?: string[];
}

const bottomNavItems: BottomNavItem[] = [
  {
    labelKey: "nav.devices",
    to: ROUTE_PATHS.devices,
    icon: FiSmartphone,
    matchPaths: [ROUTE_PATHS.devices],
  },
  {
    labelKey: "nav.sandbox",
    to: ROUTE_PATHS.sandbox,
    icon: FiSend,
  },
  {
    labelKey: "nav.profile",
    to: ROUTE_PATHS.profile,
    icon: FiUser,
  },
  {
    labelKey: "nav.api",
    to: ROUTE_PATHS.api,
    icon: FiCode,
  },
];

const NavItem = memo(function NavItem({
  item,
  isActive,
}: {
  item: BottomNavItem;
  isActive: boolean;
}) {
  const { t } = useTranslation("common");

  return (
    <NavLink to={item.to} style={{ flex: 1 }}>
      <Flex
        direction="column"
        align="center"
        justify="center"
        gap={0.5}
        py={1.5}
        color={isActive ? "text.brand" : "text.muted"}
        cursor="pointer"
        transition="color 0.15s ease"
        _active={{ transform: "scale(0.92)" }}
        role="group"
      >
        <Flex
          align="center"
          justify="center"
          w={10}
          h={7}
          borderRadius="full"
          bg={isActive ? "bg.brand.subtle" : "transparent"}
          transition="background 0.2s ease"
        >
          <Icon boxSize={5}>
            <item.icon />
          </Icon>
        </Flex>
        <Text
          fontSize="2xs"
          fontWeight={isActive ? "700" : "500"}
          lineHeight="1"
          letterSpacing="0.01em"
        >
          {t(item.labelKey)}
        </Text>
      </Flex>
    </NavLink>
  );
});

export const MobileBottomNav = memo(function MobileBottomNav() {
  const location = useLocation();

  return (
    <Box
      display={{ base: "block", lg: "none" }}
      position="fixed"
      bottom="calc(env(safe-area-inset-bottom) + 12px)"
      left={3}
      right={3}
      zIndex={10}
      bg="bg.topbar"
      backdropFilter="blur(20px)"
      borderWidth="1px"
      borderColor="border.subtle"
      borderRadius="2xl"
      boxShadow="shadow.cardHover"
      overflow="hidden"
    >
      <Flex as="nav" role="navigation" aria-label="Main navigation">
        {bottomNavItems.map((item) => {
          const isActive =
            location.pathname === item.to ||
            (item.matchPaths?.some((p) => location.pathname.startsWith(p)) ??
              false);

          return <NavItem key={item.to} item={item} isActive={isActive} />;
        })}
      </Flex>
    </Box>
  );
});
