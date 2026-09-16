import { Box, Flex, Skeleton, SkeletonCircle } from "@chakra-ui/react";
import { SIDEBAR_WIDTH } from "@/shared/constants/layout";
import { navigationSections } from "@/shared/components/layout/navigation";
import { useSidebar } from "@/shared/contexts/useSidebar";
import { RouteContentSkeleton } from "./RouteContentSkeleton";

const NAV_ITEM_COUNT = navigationSections.reduce(
  (count, section) => count + section.items.length,
  0,
);

/**
 * Placeholder for the whole authenticated shell while the session is being
 * resolved. Mirrors `AppShell`'s frame — sidebar column (collapsed or
 * expanded, as the user left it) on `lg`, top bar below it — so nothing jumps
 * when the real shell mounts.
 */
export function AppShellSkeleton() {
  const { isCollapsed } = useSidebar();

  return (
    <Flex minH="100vh" aria-busy="true">
      <Flex
        direction="column"
        gap={3}
        w={isCollapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded}
        h="100vh"
        position="sticky"
        top={0}
        flexShrink={0}
        px={isCollapsed ? 2 : 4}
        py={4}
        borderRightWidth="1px"
        borderColor="border.subtle"
        bg="bg.surface"
        display={{ base: "none", lg: "flex" }}
      >
        <Flex
          align="center"
          gap={3}
          px={1}
          justify={isCollapsed ? "center" : "flex-start"}
        >
          <Skeleton boxSize={9} borderRadius="22%" flexShrink={0} />
          {!isCollapsed && (
            <Box flex={1}>
              <Skeleton h="14px" w="60%" mb={1.5} borderRadius="md" />
              <Skeleton h="12px" w="85%" borderRadius="md" />
            </Box>
          )}
        </Flex>

        <Flex direction="column" gap={1} mt={9}>
          {Array.from({ length: NAV_ITEM_COUNT }).map((_, i) => (
            <Skeleton key={i} h={9} borderRadius="md" />
          ))}
        </Flex>

        <Flex
          mt="auto"
          align="center"
          gap={3}
          pt={3}
          borderTopWidth="1px"
          borderColor="border.subtle"
          justify={isCollapsed ? "center" : "flex-start"}
        >
          <SkeletonCircle size="8" />
          {!isCollapsed && (
            <Box flex={1}>
              <Skeleton h="12px" w="70%" mb={1.5} borderRadius="md" />
              <Skeleton h="10px" w="50%" borderRadius="md" />
            </Box>
          )}
        </Flex>
      </Flex>

      <Flex direction="column" flex={1} minW={0}>
        <Flex
          display={{ base: "flex", lg: "none" }}
          align="center"
          justify="space-between"
          px={4}
          py={2.5}
          borderBottomWidth="1px"
          borderColor="border.subtle"
          bg="bg.topbar"
        >
          <Flex align="center" gap={3}>
            <Skeleton boxSize="40px" borderRadius="md" />
            <Skeleton boxSize={7} borderRadius="22%" />
            <Skeleton h="14px" w="56px" borderRadius="md" />
          </Flex>
          <SkeletonCircle size="8" />
        </Flex>

        {/* The content placeholder carries RouteContentSkeleton's reveal delay:
            a quick session check shows only the frame. */}
        <Box px={{ base: 4, md: 6, xl: 8 }} py={{ base: 4, md: 6 }}>
          <RouteContentSkeleton />
        </Box>
      </Flex>
    </Flex>
  );
}
