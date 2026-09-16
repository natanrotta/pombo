import { Box, Flex, Icon, IconButton } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { FiChevronsLeft, FiChevronsRight } from "@/shared/components/icons";
import { BrandMark } from "@/shared/components/layout/BrandMark";
import { SidebarNavItems } from "@/shared/components/layout/SidebarNavItems";
import { SidebarUserMenu } from "@/shared/components/layout/SidebarUserMenu";
import { useSidebar } from "@/shared/contexts/useSidebar";

interface SidebarNavProps {
  /** Drawer usage: always expanded, and no collapse toggle. */
  forceExpanded?: boolean;
  onNavigate?: () => void;
}

export function SidebarNav({ forceExpanded, onNavigate }: SidebarNavProps) {
  const { t } = useTranslation("common");
  const sidebar = useSidebar();
  const isCollapsed = forceExpanded ? false : sidebar.isCollapsed;

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
      <Box px={1}>
        <BrandMark variant="sidebar" isCollapsed={isCollapsed} />
      </Box>

      {!forceExpanded && (
        <Flex justify={isCollapsed ? "center" : "flex-end"} px={1}>
          <IconButton
            aria-label={
              isCollapsed ? t("sidebar.expand") : t("sidebar.collapse")
            }
            size="xs"
            variant="ghost"
            color="text.muted"
            _hover={{ color: "text.primary", bg: "bg.hover" }}
            onClick={sidebar.toggleSidebar}
          >
            <Icon>
              {isCollapsed ? <FiChevronsRight /> : <FiChevronsLeft />}
            </Icon>
          </IconButton>
        </Flex>
      )}

      <SidebarNavItems isCollapsed={isCollapsed} onNavigate={onNavigate} />

      <SidebarUserMenu isCollapsed={isCollapsed} />
    </Flex>
  );
}
