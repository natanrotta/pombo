import { memo, type ReactNode } from "react";
import { Box, chakra, Flex, Icon, Text } from "@chakra-ui/react";
import { FiX } from "@/shared/components/icons";
import { useTranslation } from "react-i18next";

interface FilterBarProps {
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  /** Rendered inside the bar, after a rule — e.g. a status select. */
  trailing?: ReactNode;
}

/**
 * The list filter: one bordered row with a mono `/` prompt, the query, and an
 * optional control after a rule (design foundation § "controles").
 *
 * The input is a `chakra.input` rather than the shared `FormField`: it carries
 * no label or error, and it has to sit flush inside the bar's own border.
 */
function FilterBarComponent({
  searchPlaceholder,
  searchValue,
  onSearchChange,
  trailing,
}: FilterBarProps) {
  const { t } = useTranslation("common");
  const placeholder = searchPlaceholder ?? t("filter.searchPlaceholder");

  return (
    <Flex
      align="center"
      h="38px"
      bg="bg.surface"
      borderWidth="1px"
      borderColor="border.default"
      borderRadius="md"
      transition="border-color 150ms ease"
      _focusWithin={{ borderColor: "border.focus" }}
    >
      <chakra.label
        flex={1}
        minW={0}
        display="flex"
        alignItems="center"
        gap={2}
        h="100%"
        px={3}
        cursor="text"
      >
        <Text textStyle="mono" color="text.brand" userSelect="none">
          /
        </Text>
        <chakra.input
          data-cy="filter-bar-search"
          type="text"
          aria-label={placeholder}
          placeholder={placeholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          flex={1}
          minW={0}
          border="0"
          outline="none"
          bg="transparent"
          color="text.primary"
          fontFamily="mono"
          fontSize={{ base: "16px", md: "13.5px" }}
          _placeholder={{ color: "text.muted" }}
        />
        {searchValue && (
          <chakra.button
            type="button"
            aria-label={t("actions.clear")}
            onClick={() => onSearchChange("")}
            color="text.muted"
            _hover={{ color: "text.primary" }}
            cursor="pointer"
            display="flex"
            alignItems="center"
          >
            <Icon boxSize={3.5}>
              <FiX />
            </Icon>
          </chakra.button>
        )}
      </chakra.label>

      {trailing && (
        <>
          <Box w="1px" h="22px" bg="border.default" flexShrink={0} />
          {trailing}
        </>
      )}
    </Flex>
  );
}

export const FilterBar = memo(FilterBarComponent);
