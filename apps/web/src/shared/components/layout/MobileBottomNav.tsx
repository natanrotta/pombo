import { memo } from "react";
import { Box, Flex, Icon, Text } from "@chakra-ui/react";
import { NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  navigationSections,
  type NavigationItem,
} from "@/shared/components/layout/navigation";

// Same source as the sidebar: the bottom nav is the flat list of every item.
const bottomNavItems: NavigationItem[] = navigationSections.flatMap(
  (section) => section.items,
);

const NavItem = memo(function NavItem({ item }: { item: NavigationItem }) {
  const { t } = useTranslation("common");
  const ItemIcon = item.icon;

  return (
    <NavLink to={item.to} style={{ flex: 1 }}>
      {({ isActive }) => (
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
              <ItemIcon />
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
      )}
    </NavLink>
  );
});

export const MobileBottomNav = memo(function MobileBottomNav() {
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
        {bottomNavItems.map((item) => (
          <NavItem key={item.to} item={item} />
        ))}
      </Flex>
    </Box>
  );
});
