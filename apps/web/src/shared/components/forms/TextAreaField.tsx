import { memo, type ReactNode } from "react";
import { Textarea, type TextareaProps } from "@chakra-ui/react";
import { Field } from "@/components/ui/field";

interface TextAreaFieldProps extends Omit<TextareaProps, "onChange" | "value"> {
  label?: ReactNode;
  value: string;
  error?: string;
  /** Optional helper copy rendered under the textarea when no error is present. */
  helperText?: string;
  onChange: (value: string) => void;
}

function TextAreaFieldComponent({
  label,
  value,
  error,
  helperText,
  onChange,
  ...props
}: TextAreaFieldProps) {
  return (
    <Field
      invalid={Boolean(error)}
      label={label}
      errorText={error}
      helperText={error ? undefined : helperText}
    >
      <Textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        {...props}
      />
    </Field>
  );
}

export const TextAreaField = memo(TextAreaFieldComponent);
