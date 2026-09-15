import { memo } from "react";
import { chakra, Box, Flex, Icon } from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { useColorMode } from "@/components/ui/color-mode";
import { FiMoon, FiSun } from "@/shared/components/icons";
import { useTranslation } from "react-i18next";

interface ColorModeToggleProps {
  size?: "sm" | "md";
}

/**
 * Pill-shaped sun/moon switch with personality:
 *  - Both icons live inside the track, dim — the thumb covers the
 *    CURRENT mode and the visible-dim icon advertises the DESTINATION
 *    of the toggle. Reading the control becomes "you're on sun, you
 *    can go to moon".
 *  - The thumb itself carries a brighter copy of the current-mode icon
 *    and rolls (360° rotation) as it slides across, with a springy
 *    cubic-bezier overshoot. The icon inside the thumb cross-fades and
 *    counter-rotates so the swap reads as motion, not a hard cut.
 *  - The track gains a subtle gradient + a brand-tinted halo glow
 *    around the thumb in dark mode, suggesting a moon halo without
 *    using any yellow/orange tones (per the project palette rule).
 *
 * `role="switch"` + `aria-checked` + `aria-label` keep the control
 * accessible; activation falls through to the native button defaults
 * (Space/Enter).
 */
function ColorModeToggleComponent({ size = "sm" }: ColorModeToggleProps) {
  const { t } = useTranslation("common");
  const { colorMode, toggleColorMode } = useColorMode();
  const isDark = colorMode === "dark";
  const label = isDark ? t("theme.switchToLight") : t("theme.switchToDark");

  const dims =
    size === "md"
      ? {
          trackW: "60px",
          trackH: "30px",
          thumb: "24px",
          pad: "3px",
          translate: "30px",
          decoBox: 3,
          thumbIcon: 3.5,
        }
      : {
          trackW: "52px",
          trackH: "26px",
          thumb: "20px",
          pad: "3px",
          translate: "26px",
          decoBox: 2.5,
          thumbIcon: 3,
        };

  return (
    <Tooltip
      content={label}
      positioning={{ placement: "bottom" }}
      showArrow
      openDelay={300}
    >
      <chakra.button
        type="button"
        onClick={toggleColorMode}
        role="switch"
        aria-checked={isDark}
        aria-label={label}
        position="relative"
        w={dims.trackW}
        h={dims.trackH}
        borderRadius="full"
        borderWidth="1px"
        borderColor="border.subtle"
        // Track gradient — barely-there in light, more present in dark
        // so the night side reads as "atmosphere".
        bgGradient="to-br"
        gradientFrom={isDark ? "gray.800" : "bg.muted"}
        gradientTo={isDark ? "gray.900" : "bg.sunken"}
        cursor="pointer"
        flexShrink={0}
        overflow="hidden"
        transition="background 0.3s ease, border-color 0.2s ease, box-shadow 0.3s ease"
        boxShadow={
          isDark
            ? "inset 0 1px 2px rgba(0,0,0,0.4)"
            : "inset 0 1px 2px rgba(15,23,42,0.06)"
        }
        _hover={{ borderColor: "border.default" }}
        _focusVisible={{
          outline: "2px solid",
          outlineColor: "brand.400",
          outlineOffset: "2px",
        }}
      >
        {/* Decoration: sun on the left, moon on the right. The icon
            opposite the thumb (the destination) is the one that
            remains visible at low opacity. */}
        <Flex
          position="absolute"
          left="6px"
          top="50%"
          transform="translateY(-50%)"
          align="center"
          justify="center"
          opacity={isDark ? 0.55 : 0}
          color="white"
          transition="opacity 0.3s ease"
          pointerEvents="none"
        >
          <Icon boxSize={dims.decoBox}>
            <FiSun />
          </Icon>
        </Flex>
        <Flex
          position="absolute"
          right="6px"
          top="50%"
          transform="translateY(-50%)"
          align="center"
          justify="center"
          opacity={isDark ? 0 : 0.5}
          color="text.muted"
          transition="opacity 0.3s ease"
          pointerEvents="none"
        >
          <Icon boxSize={dims.decoBox}>
            <FiMoon />
          </Icon>
        </Flex>

        {/* Thumb — slides + rotates 360° during travel. The two icons
            inside cross-fade with a counter-rotation so the swap reads
            as a coin flip rather than a hard cut. */}
        <Flex
          position="absolute"
          top={dims.pad}
          left={dims.pad}
          w={dims.thumb}
          h={dims.thumb}
          borderRadius="full"
          align="center"
          justify="center"
          bg={isDark ? "gray.900" : "white"}
          color={isDark ? "white" : "text.primary"}
          // Stack: subtle drop shadow + brand-tinted halo in dark mode.
          boxShadow={
            isDark
              ? "0 2px 6px rgba(0,0,0,0.5), 0 0 12px rgba(99,102,241,0.35)"
              : "0 1px 3px rgba(15,23,42,0.2), 0 0 6px rgba(15,23,42,0.05)"
          }
          transform={
            isDark
              ? `translateX(${dims.translate}) rotate(360deg)`
              : "translateX(0) rotate(0deg)"
          }
          // Big springy bezier — overshoots, then settles. The whole
          // motion runs ~420ms, slow enough to feel deliberate.
          transition="transform 0.42s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.25s ease, color 0.25s ease, box-shadow 0.3s ease"
        >
          <Box position="relative" w="100%" h="100%">
            <Icon
              boxSize={dims.thumbIcon}
              position="absolute"
              top="50%"
              left="50%"
              opacity={isDark ? 0 : 1}
              transform={
                isDark
                  ? "translate(-50%, -50%) rotate(-180deg) scale(0.4)"
                  : "translate(-50%, -50%) rotate(0deg) scale(1)"
              }
              transition="opacity 0.25s ease, transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)"
            >
              <FiSun />
            </Icon>
            <Icon
              boxSize={dims.thumbIcon}
              position="absolute"
              top="50%"
              left="50%"
              opacity={isDark ? 1 : 0}
              transform={
                isDark
                  ? "translate(-50%, -50%) rotate(0deg) scale(1)"
                  : "translate(-50%, -50%) rotate(180deg) scale(0.4)"
              }
              transition="opacity 0.25s ease, transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1)"
            >
              <FiMoon />
            </Icon>
          </Box>
        </Flex>
      </chakra.button>
    </Tooltip>
  );
}

export const ColorModeToggle = memo(ColorModeToggleComponent);
