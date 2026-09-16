import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";
// Palettes, semantic aliases, type scale, radii, shadows and component recipes
// live in `@pombo/theme`. Everything below is web-only surface styling.
import { pomboThemeConfig } from "@pombo/theme";

/**
 * Preserved from the pre-v3 theme so a returning user keeps the color mode they
 * chose. Consumed by the `next-themes` provider (`storageKey`) in
 * `components/ui/provider`, which also keeps `defaultTheme="system"` — the OS
 * preference wins on the very first visit, the explicit choice sticks after.
 */
export const COLOR_MODE_STORAGE_KEY = "pombo-color-mode";

const config = defineConfig({
  globalCss: {
    body: {
      bg: "bg.canvas",
      color: "text.primary",
      textStyle: "body",
      minH: "100vh",
      // The one texture in the system: a faint accent dot grid, 22px apart,
      // over the whole canvas (design foundation § "Textura").
      backgroundImage:
        "radial-gradient(rgba(18, 164, 94, 0.05) 1px, transparent 0)",
      backgroundSize: "22px 22px",
      _dark: {
        backgroundImage:
          "radial-gradient(rgba(63, 224, 138, 0.055) 1px, transparent 0)",
      },
    },
    "*::placeholder": {
      color: "text.muted",
    },
  },
  theme: {
    keyframes: {
      // A live device breathes; nothing else in the UI glows.
      livePulse: {
        "0%, 100%": { boxShadow: "var(--chakra-shadows-shadow-live-low)" },
        "50%": { boxShadow: "var(--chakra-shadows-shadow-live-high)" },
      },
      // A transient state (pairing, sending) blinks its dot.
      statusBlink: {
        "0%, 100%": { opacity: "1" },
        "50%": { opacity: "0.35" },
      },
    },
  },
});

export const system = createSystem(defaultConfig, pomboThemeConfig, config);
