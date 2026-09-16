import { memo } from "react";
import { chakra, Flex } from "@chakra-ui/react";
import { FiGrid, FiList } from "@/shared/components/icons";

export type ListView = "grid" | "list";

interface ViewToggleProps {
  value: ListView;
  onChange: (value: ListView) => void;
  gridLabel: string;
  listLabel: string;
}

/**
 * Two segmented buttons that switch a list between cards and rows.
 *
 * A `chakra.button` rather than `IconButton`: the button recipe's icon rule
 * shrinks a bare lucide glyph to its fallback size inside an icon-only button.
 */
function ViewToggleComponent({
  value,
  onChange,
  gridLabel,
  listLabel,
}: ViewToggleProps) {
  const options: { view: ListView; label: string; icon: typeof FiGrid }[] = [
    { view: "grid", label: gridLabel, icon: FiGrid },
    { view: "list", label: listLabel, icon: FiList },
  ];

  return (
    <Flex
      gap="2px"
      p="3px"
      bg="bg.surface"
      borderWidth="1px"
      borderColor="border.default"
      borderRadius="md"
      flexShrink={0}
    >
      {options.map(({ view, label, icon: OptionIcon }) => {
        const isActive = value === view;
        return (
          <chakra.button
            key={view}
            type="button"
            aria-label={label}
            aria-pressed={isActive}
            data-cy={`view-${view}`}
            onClick={() => onChange(view)}
            display="grid"
            placeItems="center"
            w="34px"
            h="30px"
            borderRadius="sm"
            cursor="pointer"
            color={isActive ? "text.brand" : "text.secondary"}
            bg={isActive ? "bg.brand.subtle" : "transparent"}
            boxShadow={
              isActive
                ? "inset 0 0 0 1px var(--chakra-colors-border-accent)"
                : undefined
            }
            transition="background-color 150ms ease, color 150ms ease"
            _hover={
              isActive ? { bg: "bg.brand.subtle" } : { color: "text.primary" }
            }
            _focusVisible={{
              outline: "2px solid",
              outlineColor: "border.focus",
              outlineOffset: "1px",
            }}
          >
            {/* Inline size: a bare lucide glyph otherwise falls back to its
                1em box, which reads as a dot at this button size. */}
            <OptionIcon width={15} height={15} style={{ width: 15, height: 15 }} />
          </chakra.button>
        );
      })}
    </Flex>
  );
}

export const ViewToggle = memo(ViewToggleComponent);
