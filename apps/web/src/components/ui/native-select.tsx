import { NativeSelect as Select } from "@chakra-ui/react";
import * as React from "react";
import { fieldBase } from "@/app/theme/foundations/recipes";

interface NativeSelectRootProps extends Select.RootProps {
  icon?: React.ReactNode;
}

export const NativeSelectRoot = React.forwardRef<
  HTMLDivElement,
  NativeSelectRootProps
>(function NativeSelectRoot(props, ref) {
  const { icon, children, ...rest } = props;
  return (
    <Select.Root ref={ref} width="full" {...rest}>
      {children}
      <Select.Indicator color="text.muted" transition="color 0.2s ease">
        {icon}
      </Select.Indicator>
    </Select.Root>
  );
});

interface NativeSelectItem {
  value: string;
  label: string;
  disabled?: boolean;
}

interface NativeSelectFieldProps extends Select.FieldProps {
  items?: Array<string | NativeSelectItem>;
}

export const NativeSelectField = React.forwardRef<
  HTMLSelectElement,
  NativeSelectFieldProps
>(function NativeSelectField(props, ref) {
  const { items: itemsProp, children, ...rest } = props;

  const items = React.useMemo(
    () =>
      itemsProp?.map((item) =>
        typeof item === "string" ? { label: item, value: item } : item,
      ),
    [itemsProp],
  );

  return (
    // `NativeSelect` is a slot recipe, so the `input` recipe does not reach it.
    // Spreading `fieldBase` keeps a select visually identical to the text
    // inputs it sits next to in a form. `_focus` mirrors `_focusVisible`
    // because a native <select> focused by mouse does not always match
    // `:focus-visible`. `rest` stays last so call sites can still override.
    <Select.Field
      ref={ref}
      {...fieldBase}
      h={{ base: "44px", md: "40px" }}
      focusVisibleRing="none"
      _focus={{
        borderColor: "border.focus",
        boxShadow: "input-focus",
        bg: "bg.surface",
      }}
      {...rest}
    >
      {children}
      {items?.map((item) => (
        <option key={item.value} value={item.value} disabled={item.disabled}>
          {item.label}
        </option>
      ))}
    </Select.Field>
  );
});
