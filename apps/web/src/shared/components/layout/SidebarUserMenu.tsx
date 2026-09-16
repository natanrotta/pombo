import { Box, Flex, Icon, Text } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
import {
  FiChevronUp,
  FiLogOut,
  FiMoon,
  FiSun,
  FiUser,
} from "@/shared/components/icons";
import { useAuth } from "@/modules/auth";
import { ROUTE_PATHS } from "@/app/router/RoutePaths";

interface SidebarUserMenuProps {
  isCollapsed: boolean;
}

/** Account row pinned to the bottom of the sidebar: profile, theme toggle,
 *  sign-out and the build version. Renders nothing without a user. */
export function SidebarUserMenu({ isCollapsed }: SidebarUserMenuProps) {
  const { t } = useTranslation("common");
  const { user, signOut, isSubmitting } = useAuth();
  const navigate = useNavigate();
  const { colorMode, toggleColorMode } = useColorMode();
  const isDark = colorMode === "dark";

  if (!user) return null;

  return (
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
                  bg="bg.brand.solid"
                  color="text.onBrand"
                  fontSize="xs"
                  fontWeight="700"
                  flexShrink={0}
                />
                {!isCollapsed && (
                  <>
                    <Box flex={1} minW={0}>
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
                    <Icon
                      boxSize={4}
                      color="text.muted"
                      flexShrink={0}
                      aria-hidden
                    >
                      <FiChevronUp />
                    </Icon>
                  </>
                )}
              </Flex>
            </Box>
          </MenuTrigger>
        </Tooltip>
        <MenuContent fontSize="sm">
          <MenuItem value="profile" onClick={() => navigate(ROUTE_PATHS.profile)}>
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
          </MenuItem>
        </MenuContent>
      </MenuRoot>
    </Flex>
  );
}
