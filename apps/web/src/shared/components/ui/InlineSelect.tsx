import { memo } from "react";
import { Box, chakra, Icon } from "@chakra-ui/react";
import { FiChevronDown } from "@/shared/components/icons";

export interface InlineSelectOption<T extends string> {
  value: T;
  label: string;
}

interface InlineSelectProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: InlineSelectOption<T>[];
  ariaLabel: string;
  dataCy?: string;
}

/**
 * A borderless select that sits inside another control's chrome (the
 * `FilterBar`'s status picker). It is a `chakra.select` rather than the
 * `NativeSelectField` snippet on purpose: that snippet brings its own border
 * and height, which would draw a second box inside the bar.
 */
function InlineSelectComponent<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  dataCy,
}: InlineSelectProps<T>) {
  return (
    <Box position="relative" display="flex" alignItems="center" h="100%">
      <chakra.select
        data-cy={dataCy}
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        appearance="none"
        border="0"
        outline="none"
        bg="transparent"
        h="100%"
        pl={3}
        pr={8}
        color="text.secondary"
        fontFamily="mono"
        fontSize="12.5px"
        cursor="pointer"
        transition="color 150ms ease"
        _hover={{ color: "text.primary" }}
      >
        {options.map((option) => (
          <chakra.option key={option.value} value={option.value}>
            {option.label}
          </chakra.option>
        ))}
      </chakra.select>
      <Icon
        boxSize={3}
        color="text.muted"
        position="absolute"
        right={3}
        pointerEvents="none"
      >
        <FiChevronDown />
      </Icon>
    </Box>
  );
}

export const InlineSelect = memo(
  InlineSelectComponent,
) as typeof InlineSelectComponent;
