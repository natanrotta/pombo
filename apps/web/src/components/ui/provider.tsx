import { ChakraProvider } from "@chakra-ui/react";
import { system } from "@/app/theme";
import {
  ColorModeProvider,
  type ColorModeProviderProps,
} from "@/components/ui/color-mode";

export function Provider(props: ColorModeProviderProps) {
  return (
    <ChakraProvider value={system}>
      <ColorModeProvider {...props} />
    </ChakraProvider>
  );
}
