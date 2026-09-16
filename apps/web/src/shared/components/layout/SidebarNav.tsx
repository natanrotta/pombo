import { Box, Flex, Icon, IconButton, Image, Text } from "@chakra-ui/react";
import { Avatar } from "@/components/ui/avatar";
import {
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/menu";
import { Tooltip } from "@/components/ui/tooltip";
import { useColorMode } from "@/components/ui/color-mode";
import { NavLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FiChevronUp,
  FiChevronsLeft,
  FiChevronsRight,
  FiLogOut,
  FiMoon,
  FiSun,
  FiUser,
} from "@/shared/components/icons";
import { navigationSections } from "@/shared/components/layout/navigation";
import { AppVersion } from "@/shared/components/layout/AppVersion";
import { useAuth } from "@/modules/auth";
import { ROUTE_PATHS } from "@/app/router/RoutePaths";
import { useSidebar } from "@/shared/contexts/useSidebar";
import pomboIcon from "@assets/pombo-icon.svg";

interface SidebarNavProps {
  forceExpanded?: boolean;
  onNavigate?: () => void;
}

export function SidebarNav({ forceExpanded, onNavigate }: SidebarNavProps) {
  const { t } = useTranslation("common");
  const { user, signOut, isSubmitting } = useAuth();
  const sidebar = useSidebar();
  const navigate = useNavigate();
  const { colorMode, toggleColorMode } = useColorMode();
  const isDark = colorMode === "dark";

  const isCollapsed = forceExpanded ? false : sidebar.isCollapsed;
  const toggleSidebar = sidebar.toggleSidebar;

  const showToggle = !forceExpanded;

  return (
    <Flex
      direction="column"
      h="full"
      px={isCollapsed ? 2 : 4}
      py={4}
      gap={3}
      overflow="hidden"
      transition="padding 0.2s ease"
    >
      {/* Logo */}
      <Flex
        align="center"
        gap={3}
        px={1}
        justify={isCollapsed ? "center" : "flex-start"}
      >
        <Image
          src={pomboIcon}
          alt={t("platform.name", "Pombo")}
          w={9}
          h={9}
          borderRadius="22%"
          objectFit="cover"
          boxShadow="shadow.card"
          flexShrink={0}
        />
        <Box
          flex={1}
          minW={0}
          opacity={isCollapsed ? 0 : 1}
          transition="opacity 0.15s ease"
          display={isCollapsed ? "none" : "block"}
        >
          <Text
            fontSize="sm"
            fontWeight="800"
            color="text.primary"
            letterSpacing="-0.01em"
            whiteSpace="nowrap"
          >
            {t("platform.name", "Pombo")}
          </Text>
          <Text fontSize="xs" color="text.muted" whiteSpace="nowrap">
            {t("platform.tagline", "")}
          </Text>
        </Box>
      </Flex>

      {/* Toggle button — separate row */}
      {showToggle && (
        <Flex justify={isCollapsed ? "center" : "flex-end"} px={1}>
          <IconButton
            aria-label={
              isCollapsed
                ? t("sidebar.expand", "Expandir menu")
                : t("sidebar.collapse", "Recolher menu")
            }
            size="xs"
            variant="ghost"
            color="text.muted"
            _hover={{ color: "text.primary", bg: "bg.hover" }}
            onClick={toggleSidebar}
          >
            <Icon>
              {isCollapsed ? <FiChevronsRight /> : <FiChevronsLeft />}
            </Icon>
          </IconButton>
        </Flex>
      )}

      {/* Navigation */}
      <Flex
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
          <Box key={index}>
            <Flex direction="column" gap={1}>
              {section.items.map((item) => {
                const ItemIcon = item.icon;

                const renderItem = (isActive: boolean) => {
                  const navItem = (
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
                        transform:
                          isActive || isCollapsed ? "none" : "translateX(2px)",
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
                        {t(item.labelKey)}
                      </Text>
                    </Flex>
                  );

                  if (isCollapsed) {
                    return (
                      <Tooltip
                        content={t(item.labelKey)}
                        positioning={{ placement: "right" }}
                        showArrow
                        openDelay={200}
                      >
                        {navItem}
                      </Tooltip>
                    );
                  }

                  return navItem;
                };

                return (
                  <NavLink key={item.to} to={item.to} onClick={onNavigate}>
                    {({ isActive }) => renderItem(isActive)}
                  </NavLink>
                );
              })}
            </Flex>
          </Box>
        ))}
      </Flex>

      {/* User area - Discord style */}
      {user && (
        <Flex
          align="center"
          gap={2}
          borderTopWidth="1px"
          borderColor="border.subtle"
          px={isCollapsed ? 0 : 3}
          py={2}
          mx={isCollapsed ? 0 : -1}
        >
          <MenuRoot positioning={{ placement: "top-start" }}>
            <Tooltip
              content={isCollapsed ? user.name : ""}
              positioning={{ placement: "right" }}
              showArrow
              disabled={!isCollapsed}
            >
              <MenuTrigger
                asChild
                data-cy="user-menu-trigger"
                cursor="pointer"
                borderRadius="lg"
                _hover={{ bg: "bg.hover" }}
                transition="all 0.15s ease"
                flex={1}
                minW={0}
                px={isCollapsed ? 0 : 1}
                py={1}
              >
                <Box>
                  <Flex
                    align="center"
                    gap={3}
                    justify={isCollapsed ? "center" : "flex-start"}
                  >
                    <Avatar
                      size="sm"
                      name={user.name}
                      src={user.avatarUrl || undefined}
                      bg="brand.500"
                      color="text.onBrand"
                      fontSize="xs"
                      fontWeight="700"
                      flexShrink={0}
                    />
                    <Box
                      flex={1}
                      minW={0}
                      opacity={isCollapsed ? 0 : 1}
                      display={isCollapsed ? "none" : "block"}
                      transition="opacity 0.15s ease"
                    >
                      <Text
                        fontSize="sm"
                        fontWeight="600"
                        color="text.primary"
                        lineClamp={1}
                        lineHeight="short"
                        whiteSpace="nowrap"
                      >
                        {user.name}
                      </Text>
                      <Text
                        fontSize="xs"
                        color="text.muted"
                        lineClamp={1}
                        lineHeight="short"
                        whiteSpace="nowrap"
                      >
                        {user.email}
                      </Text>
                    </Box>
                    {!isCollapsed && (
                      <Icon
                        boxSize={4}
                        color="text.muted"
                        flexShrink={0}
                        aria-hidden
                      >
                        <FiChevronUp />
                      </Icon>
                    )}
                  </Flex>
                </Box>
              </MenuTrigger>
            </Tooltip>
            <MenuContent fontSize="sm">
              <MenuItem
                value="profile"
                onClick={() => navigate(ROUTE_PATHS.profile)}
              >
                <Icon boxSize={4}>
                  <FiUser />
                </Icon>
                {t("nav.profile")}
              </MenuItem>
              <MenuItem
                value="color-mode"
                onClick={toggleColorMode}
                closeOnSelect={false}
              >
                <Icon boxSize={4}>{isDark ? <FiSun /> : <FiMoon />}</Icon>
                {isDark ? t("theme.switchToLight") : t("theme.switchToDark")}
              </MenuItem>
              <MenuSeparator />
              {/* Icon rendered as a child (not the `icon` prop) so the row's
               *  children are direct flex items — lets <AppVersion ml="auto">
               *  push the version to the far right. */}
              <MenuItem
                value="sign-out"
                data-cy="user-menu-sign-out"
                color="status.error.fg"
                onClick={signOut}
                disabled={isSubmitting}
              >
                <Icon boxSize={4} me={3} aria-hidden>
                  <FiLogOut />
                </Icon>
                {t("actions.signOut")}
                <AppVersion ml="auto" pl={3} />
              </MenuItem>
            </MenuContent>
          </MenuRoot>
        </Flex>
      )}
    </Flex>
  );
}
