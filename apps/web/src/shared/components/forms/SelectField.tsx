import { memo } from "react";
import { Field } from "@/components/ui/field";
import {
  NativeSelectField,
  NativeSelectRoot,
} from "@/components/ui/native-select";
import type { NativeSelect } from "@chakra-ui/react";

export interface SelectOption {
  label: string;
  value: string;
}

interface SelectFieldProps extends Omit<
  NativeSelect.FieldProps,
  "onChange" | "value"
> {
  label?: string;
  options: SelectOption[];
  value: string;
  error?: string;
  onChange: (value: string) => void;
}

function SelectFieldComponent({
  label,
  options,
  value,
  error,
  onChange,
  placeholder,
  ...props
}: SelectFieldProps) {
  return (
    <Field invalid={Boolean(error)} label={label} errorText={error}>
      <NativeSelectRoot>
        <NativeSelectField
          value={value}
          onChange={(event) => onChange(event.target.value)}
          cursor="pointer"
          color={value ? undefined : "text.muted"}
          {...props}
        >
          {placeholder && (
            <option value="" disabled hidden>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </NativeSelectField>
      </NativeSelectRoot>
    </Field>
  );
}

export const SelectField = memo(SelectFieldComponent);
