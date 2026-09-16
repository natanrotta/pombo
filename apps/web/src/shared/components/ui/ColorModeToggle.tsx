import { memo } from "react";
import { chakra, Flex, Icon } from "@chakra-ui/react";
import { useColorMode } from "@/components/ui/color-mode";
import { FiMoon, FiSun } from "@/shared/components/icons";
import type { IconType } from "@/shared/components/icons";
import { useTranslation } from "react-i18next";

interface ColorModeToggleProps {
  /** `pill` on the auth screens, `rounded` inside a settings card. */
  shape?: "pill" | "rounded";
}

type Mode = "dark" | "light";

/**
 * Two segmented buttons — moon and sun — with the current mode outlined in
 * the accent. The pressed state (`aria-pressed`) is what a screen reader
 * announces; each button carries its own label ("dark theme" / "light theme").
 */
function ColorModeToggleComponent({ shape = "rounded" }: ColorModeToggleProps) {
  const { t } = useTranslation("common");
  const { colorMode, setColorMode } = useColorMode();

  const options: { mode: Mode; icon: IconType; label: string }[] = [
    { mode: "dark", icon: FiMoon, label: t("theme.dark") },
    { mode: "light", icon: FiSun, label: t("theme.light") },
  ];

  return (
    <Flex
      gap="2px"
      p="3px"
      bg="bg.canvas"
      borderWidth="1px"
      borderColor="border.default"
      borderRadius={shape === "pill" ? "full" : "md"}
      flexShrink={0}
    >
      {options.map(({ mode, icon: ModeIcon, label }) => {
        const isActive = colorMode === mode;
        return (
          <chakra.button
            key={mode}
            type="button"
            aria-label={label}
            aria-pressed={isActive}
            data-cy={`color-mode-${mode}`}
            onClick={() => setColorMode(mode)}
            display="grid"
            placeItems="center"
            w={shape === "pill" ? "38px" : "36px"}
            h="30px"
            borderRadius={shape === "pill" ? "full" : "sm"}
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
            <Icon boxSize={3.5}>
              <ModeIcon />
            </Icon>
          </chakra.button>
        );
      })}
    </Flex>
  );
}

export const ColorModeToggle = memo(ColorModeToggleComponent);
