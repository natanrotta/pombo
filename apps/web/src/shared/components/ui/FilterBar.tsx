import { memo } from "react";
import { chakra, Flex, Icon, Input, InputGroup } from "@chakra-ui/react";
import { FiSearch, FiX } from "@/shared/components/icons";
import { useTranslation } from "react-i18next";

interface FilterBarProps {
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
}

function FilterBarComponent({
  searchPlaceholder,
  searchValue,
  onSearchChange,
}: FilterBarProps) {
  const { t } = useTranslation("common");

  return (
    <Flex align="center" gap={2.5} flexWrap="wrap">
      {/* data-animate-host: lets the nested FiSearch icon animate on focus/hover of the group */}
      <InputGroup
        data-animate-host
        flex={1}
        minW={{ base: "0", md: "200px" }}
        maxW={{ md: "360px" }}
        startElement={
          <Icon color="text.muted" boxSize={4}>
            <FiSearch />
          </Icon>
        }
        endElement={
          searchValue ? (
            <chakra.button
              type="button"
              aria-label={t("actions.clear")}
              onClick={() => onSearchChange("")}
              color="text.muted"
              _hover={{ color: "text.secondary" }}
              cursor="pointer"
            >
              <Icon boxSize={3.5}>
                <FiX />
              </Icon>
            </chakra.button>
          ) : undefined
        }
      >
        <Input
          type="text"
          placeholder={searchPlaceholder ?? t("filter.searchPlaceholder")}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          bg="bg.surface"
          borderColor="border.default"
          borderWidth="1.5px"
          borderRadius="sm"
          size="sm"
          h={{ base: "40px", md: "36px" }}
          fontSize={{ base: "16px", md: "sm" }}
          pl={10}
          _hover={{ borderColor: "border.strong" }}
          _focus={{ borderColor: "border.focus", boxShadow: "input-focus" }}
        />
      </InputGroup>
    </Flex>
  );
}

export const FilterBar = memo(FilterBarComponent);
