import { defineTokens } from "@chakra-ui/react";

// Base color palettes (Chakra v3 tokens). Semantic aliases (bg.*, text.*,
// border.*, status.*) live in `semantic-tokens.ts` and reference these via the
// `{colors.<palette>.<step>}` syntax. Palettes NOT defined here (gray, red,
// green, blue, purple, blackAlpha, whiteAlpha, …) come from `defaultConfig`.

// Emerald ramp — the single brand color of the platform. Anchored on #10B981
// (the accent identity) with #059669 as the button-safe "deep" emerald. 50 =
// lightest, 900 = near-black forest. A messaging-gateway green that fits the
// Pombo mascot and the "communication" domain (WhatsApp lineage), tuned for
// contrast: white text sits on 600+, and 700 is the readable "green text".
const emerald = {
  50: { value: "#ecfdf5" },
  100: { value: "#d1fae5" },
  200: { value: "#a7f3d0" },
  300: { value: "#6ee7b7" },
  400: { value: "#34d399" },
  500: { value: "#10b981" }, // Emerald — the accent identity color
  600: { value: "#059669" }, // Deep emerald — the primary button fill (light mode)
  700: { value: "#047857" },
  800: { value: "#065f46" },
  900: { value: "#064e3b" },
};

export const colors = defineTokens.colors({
  // `brand` and `accent` intentionally share ONE emerald ramp. The platform has
  // a single, confident green identity — `brand.*` carries the strong usages
  // (primary button, links, active nav) and `accent.*` the soft highlights
  // (subtle washes, stat cards); keeping them the same hue is what makes the UI
  // feel cohesive ("orna") instead of two-toned.
  brand: emerald,
  accent: emerald,
  // Faintly green-slate neutrals — a desaturated cool gray with a whisper of
  // emerald so surfaces, text and borders read as part of the same family
  // instead of a flat gray next to the green.
  neutral: {
    50: { value: "#f5f7f6" },
    100: { value: "#e9edeb" },
    200: { value: "#d6deda" },
    300: { value: "#bcc7c1" },
    400: { value: "#8f9c96" },
    500: { value: "#647069" },
    600: { value: "#4a564f" },
    700: { value: "#39433d" },
    800: { value: "#262f2a" },
    900: { value: "#171d1a" },
  },
  surface: {
    DEFAULT: { value: "#ffffff" },
    subtle: { value: "#f5f7f6" },
    muted: { value: "#eef1f0" },
  },
});
