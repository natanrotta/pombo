import { defineTokens } from "@chakra-ui/react";

// Base color palettes (Chakra v3 tokens). Semantic aliases (bg.*, text.*,
// border.*, status.*) live in `semantic-tokens.ts` and reference these via the
// `{colors.<palette>.<step>}` syntax. Palettes NOT defined here (gray, red,
// green, blue, purple, blackAlpha, whiteAlpha, …) come from `defaultConfig`.

// Emerald ramp — the single brand color of the platform, anchored on the
// handoff's accent (#3FE08A at 400) and its hover (#6BF0AB at 300). The dark
// theme uses the bright end (the accent glows on a near-black canvas); the
// light theme uses 700, the first step that clears WCAG AA with white text.
const emerald = {
  50: { value: "#e9fbf2" },
  100: { value: "#cff6e1" },
  200: { value: "#a3eec6" },
  300: { value: "#6bf0ab" }, // Accent hover (dark)
  400: { value: "#3fe08a" }, // THE accent — brand identity
  500: { value: "#22c776" },
  600: { value: "#12a45e" },
  700: { value: "#0c7f49" }, // Primary button fill and brand text (light)
  800: { value: "#0a5b36" },
  900: { value: "#07301e" },
};

export const colors = defineTokens.colors({
  // `brand` and `accent` intentionally share ONE emerald ramp: the product has
  // a single green identity. `brand.*` carries the strong usages (primary
  // action, active nav, focus) and `accent.*` the soft washes.
  brand: emerald,
  accent: emerald,
  // Green-tinted neutrals. The dark steps are the handoff's own surfaces, so a
  // panel next to the accent reads as the same family instead of flat grey.
  neutral: {
    50: { value: "#f4f7f5" },
    100: { value: "#e8edea" }, // Primary ink on dark
    200: { value: "#d5ded9" },
    300: { value: "#b3c0ba" },
    400: { value: "#8b9a93" }, // Metadata ink
    500: { value: "#6e7c76" },
    600: { value: "#5a6862" }, // Disabled ink on dark
    700: { value: "#2e3a35" }, // Border hover on dark
    800: { value: "#1c2220" }, // Border on dark
    900: { value: "#141a18" }, // Hover surface on dark
    950: { value: "#0e1211" }, // Panel on dark
  },
  surface: {
    DEFAULT: { value: "#ffffff" },
    subtle: { value: "#f7f9f8" },
    muted: { value: "#edf1ef" },
    // The handoff's two dark anchors, named so the semantic layer reads well.
    canvas: { value: "#0b0e0d" },
    panel: { value: "#0e1211" },
    // Green-washed surface behind an active nav item, a badge or a soft button.
    active: { value: "#16211b" },
    // The resting green border (an online device, a secondary button).
    line: { value: "#223a2c" },
  },
});
