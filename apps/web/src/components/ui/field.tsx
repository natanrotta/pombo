import { Field as ChakraField } from "@chakra-ui/react";
import * as React from "react";

export interface FieldProps extends Omit<ChakraField.RootProps, "label"> {
  label?: React.ReactNode;
  helperText?: React.ReactNode;
  errorText?: React.ReactNode;
  optionalText?: React.ReactNode;
}

/**
 * Label and error styling come from the v2 `FormLabel` / `FormError` theme
 * overrides — in v3 those are Field slots, so they live here.
 */
export const Field = React.forwardRef<HTMLDivElement, FieldProps>(
  function Field(props, ref) {
    const { label, children, helperText, errorText, optionalText, ...rest } =
      props;
    return (
      <ChakraField.Root ref={ref} width="full" {...rest}>
        {label && (
          <ChakraField.Label
            textStyle="eyebrow"
            color="text.muted"
            mb="1.5"
          >
            {label}
            <ChakraField.RequiredIndicator fallback={optionalText} />
          </ChakraField.Label>
        )}
        {children}
        {helperText && (
          <ChakraField.HelperText>{helperText}</ChakraField.HelperText>
        )}
        {errorText && (
          <ChakraField.ErrorText
            fontSize="xs"
            fontWeight="500"
            color="status.error.fg"
            mt="1.5"
          >
            {errorText}
          </ChakraField.ErrorText>
        )}
      </ChakraField.Root>
    );
  },
);

export const FieldRoot = ChakraField.Root;
export const FieldLabel = ChakraField.Label;
export const FieldErrorText = ChakraField.ErrorText;
export const FieldHelperText = ChakraField.HelperText;
