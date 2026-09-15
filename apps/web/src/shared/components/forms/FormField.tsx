import { memo } from "react";
import { Input, type InputProps } from "@chakra-ui/react";
import { Field } from "@/components/ui/field";

interface FormFieldProps extends Omit<InputProps, "onChange"> {
  label?: string;
  error?: string;
  /** Optional helper copy rendered under the input when no error is present. */
  helperText?: string;
  value: string;
  onChange: (value: string) => void;
}

export const FormField = memo(function FormField({
  label,
  error,
  helperText,
  value,
  onChange,
  ...props
}: FormFieldProps) {
  return (
    <Field
      invalid={Boolean(error)}
      label={label}
      errorText={error}
      helperText={error ? undefined : helperText}
    >
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...props}
      />
    </Field>
  );
});
