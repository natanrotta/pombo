import { Flex } from "@chakra-ui/react";
import { ColorModeToggle } from "@/shared/components/ui/ColorModeToggle";
import { LanguageSelector } from "@/shared/components/ui/LanguageSelector";

/** Theme and language switches, identical on every auth screen. */
export function AuthControls() {
  return (
    <Flex align="center" gap={2}>
      <ColorModeToggle shape="pill" />
      <LanguageSelector />
    </Flex>
  );
}
