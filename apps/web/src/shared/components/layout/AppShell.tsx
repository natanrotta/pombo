import type { PropsWithChildren } from "react";
import { Box, Flex, useDisclosure } from "@chakra-ui/react";
import { DrawerBody, DrawerContent, DrawerRoot } from "@/components/ui/drawer";
import { SidebarNav } from "@/shared/components/layout/SidebarNav";
import { MobileHeader } from "@/shared/components/layout/MobileHeader";
import { MobileBottomNav } from "@/shared/components/layout/MobileBottomNav";
import { useSidebar } from "@/shared/contexts/useSidebar";

export function AppShell({ children }: PropsWithChildren) {
  const { open: isOpen, onOpen, onClose } = useDisclosure();
  const { isCollapsed } = useSidebar();

  return (
    <Flex minH="100vh">
      <Box
        as="aside"
        w={isCollapsed ? "68px" : "248px"}
        borderRightWidth="1px"
        borderColor="border.subtle"
        bg="bg.surface"
        display={{ base: "none", lg: "block" }}
        position="sticky"
        top={0}
        h="100vh"
        transition="width 0.2s ease"
        overflow="hidden"
      >
        <SidebarNav />
      </Box>

      <DrawerRoot
        open={isOpen}
        placement="start"
        onOpenChange={({ open }) => {
          if (!open) onClose();
        }}
      >
        <DrawerContent maxW="248px">
          <DrawerBody p={0}>
            <SidebarNav forceExpanded onNavigate={onClose} />
          </DrawerBody>
        </DrawerContent>
      </DrawerRoot>

      <Flex direction="column" flex="1" minW={0}>
        <MobileHeader onOpenSidebar={onOpen} />

        <Box
          as="main"
          px={{ base: 4, md: 6, xl: 8 }}
          py={{ base: 4, md: 6 }}
          // Clears the floating bottom nav on mobile: ~50px pill height +
          // 12px bottom offset + ~34px breathing room, above the safe-area inset.
          pb={{ base: "calc(env(safe-area-inset-bottom) + 96px)", lg: 6 }}
        >
          {children}
        </Box>
      </Flex>

      <MobileBottomNav />
    </Flex>
  );
}
