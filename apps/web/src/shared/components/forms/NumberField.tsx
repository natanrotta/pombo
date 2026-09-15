import { memo } from "react";
import { Field } from "@/components/ui/field";
import {
  NumberInputField,
  NumberInputRoot,
  type NumberInputProps,
} from "@/components/ui/number-input";

interface NumberFieldProps extends Omit<
  NumberInputProps,
  "onChange" | "onValueChange" | "value"
> {
  label?: string;
  value: number;
  error?: string;
  onChange: (value: number) => void;
}

function NumberFieldComponent({
  label,
  value,
  error,
  onChange,
  ...props
}: NumberFieldProps) {
  return (
    <Field invalid={Boolean(error)} label={label} errorText={error}>
      {/* v3 keeps the committed value as a string and reports both forms on
          change; the public `number` contract is preserved by converting at the
          boundary. An empty/partial entry yields NaN — coerced to 0, as before. */}
      <NumberInputRoot
        value={String(value)}
        onValueChange={({ valueAsNumber }) =>
          onChange(Number.isNaN(valueAsNumber) ? 0 : valueAsNumber)
        }
        {...props}
      >
        <NumberInputField />
      </NumberInputRoot>
    </Field>
  );
}

export const NumberField = memo(NumberFieldComponent);
