import { NumberInput as ChakraNumberInput } from "@chakra-ui/react";
import * as React from "react";
import { fieldBase } from "@/app/theme/foundations/recipes";

export interface NumberInputProps extends ChakraNumberInput.RootProps {}

export const NumberInputRoot = React.forwardRef<
  HTMLDivElement,
  NumberInputProps
>(function NumberInputRoot(props, ref) {
  const { children, ...rest } = props;
  return (
    <ChakraNumberInput.Root ref={ref} variant="outline" width="full" {...rest}>
      {children}
      <ChakraNumberInput.Control
        borderColor="border.default"
        color="text.muted"
      >
        <ChakraNumberInput.IncrementTrigger _active={{ bg: "bg.hover" }} />
        <ChakraNumberInput.DecrementTrigger _active={{ bg: "bg.hover" }} />
      </ChakraNumberInput.Control>
    </ChakraNumberInput.Root>
  );
});

// Same story as `NativeSelectField`: NumberInput is a slot recipe, so the
// `input` recipe does not reach its field. `rest` stays last so call sites can
// still override.
export const NumberInputField = React.forwardRef<
  HTMLInputElement,
  ChakraNumberInput.InputProps
>(function NumberInputField(props, ref) {
  return (
    <ChakraNumberInput.Input
      ref={ref}
      {...fieldBase}
      h="40px"
      fontSize="sm"
      focusVisibleRing="none"
      {...props}
    />
  );
});

export const NumberInputLabel = ChakraNumberInput.Label;
