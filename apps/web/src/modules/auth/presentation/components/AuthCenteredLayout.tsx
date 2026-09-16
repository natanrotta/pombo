import type { PropsWithChildren } from "react";
import { Container, Flex } from "@chakra-ui/react";
import { AuthControls } from "@/modules/auth/presentation/components/AuthControls";

/** Single centered column for the secondary auth steps (forgot, reset, verify). */
export function AuthCenteredLayout({ children }: PropsWithChildren) {
  return (
    <Flex minH="100vh" align="center" justify="center" px={4} py={8}>
      <Container maxW="md" px={0}>
        <Flex justify="flex-end" mb={4}>
          <AuthControls />
        </Flex>
        {children}
      </Container>
    </Flex>
  );
}
