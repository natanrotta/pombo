import { defineSemanticTokens } from "@chakra-ui/react";

// Semantic aliases (Chakra v3). `base` = light value, `_dark` overrides in dark
// mode. Palette references use the `{colors.<palette>.<step>}` syntax; raw
// hex/rgba values are literal.
//
// The DARK values are the design handoff verbatim (near-black canvas #0B0E0D,
// panel #0E1211, border #1C2220, accent #3FE08A). The handoff defines no light
// theme, so the LIGHT values are derived here from the same families: white
// panels on an off-white canvas, the same green-tinted neutrals for ink and
// borders, and the emerald ramp's dark end (700) wherever green has to read on
// white. Both directions keep WCAG AA on body text and on the primary action.
export const semanticTokens = defineSemanticTokens({
  colors: {
    bg: {
      canvas: { value: { base: "{colors.surface.subtle}", _dark: "{colors.surface.canvas}" } },
      surface: { value: { base: "#ffffff", _dark: "{colors.surface.panel}" } },
      elevated: { value: { base: "#ffffff", _dark: "{colors.neutral.900}" } },
      sunken: { value: { base: "{colors.surface.muted}", _dark: "#080b0a" } },
      // Field interior. Dark inputs sit BELOW the panel (the handoff draws them
      // on the canvas), light ones stay white like the surface around them.
      field: { value: { base: "#ffffff", _dark: "{colors.surface.canvas}" } },
      muted: { value: { base: "{colors.surface.subtle}", _dark: "#121716" } },
      hover: { value: { base: "{colors.surface.muted}", _dark: "{colors.neutral.900}" } },
      active: { value: { base: "#e1e8e4", _dark: "#1a211f" } },
      glass: {
        value: {
          base: "rgba(255, 255, 255, 0.82)",
          _dark: "rgba(14, 18, 17, 0.82)",
        },
      },
      // Pill switch (ColorModeToggle): the track gradient ends and the thumb.
      switch: {
        track: { value: { base: "{colors.surface.muted}", _dark: "{colors.neutral.900}" } },
        trackEnd: { value: { base: "#e1e8e4", _dark: "#080b0a" } },
        thumb: { value: { base: "#ffffff", _dark: "{colors.surface.active}" } },
      },
      // Decorative ambient glows behind the auth screens (radial gradients).
      // Same in both modes — they sit on the canvas as light, not as surface.
      glow: {
        primary: { value: { base: "rgba(63, 224, 138, 0.20)", _dark: "rgba(63, 224, 138, 0.16)" } },
        secondary: { value: { base: "rgba(12, 127, 73, 0.16)", _dark: "rgba(34, 199, 118, 0.12)" } },
        tertiary: { value: { base: "rgba(107, 240, 171, 0.14)", _dark: "rgba(107, 240, 171, 0.10)" } },
      },
      topbar: {
        value: {
          base: "rgba(255, 255, 255, 0.92)",
          _dark: "rgba(14, 18, 17, 0.88)",
        },
      },
      brand: {
        // The green wash behind an active nav item, a soft button or a badge.
        subtle: { value: { base: "{colors.brand.50}", _dark: "{colors.surface.active}" } },
        "subtle-hover": { value: { base: "{colors.brand.100}", _dark: "#1b2c22" } },
        emphasis: { value: { base: "{colors.brand.800}", _dark: "{colors.brand.300}" } },
        // Primary action. Light mode fills with the deep emerald (700) under
        // white text; dark mode is the accent itself under near-black ink.
        solid: { value: { base: "{colors.brand.700}", _dark: "{colors.brand.400}" } },
        "solid-hover": { value: { base: "{colors.brand.800}", _dark: "{colors.brand.300}" } },
        "solid-active": { value: { base: "{colors.brand.900}", _dark: "{colors.brand.500}" } },
      },
      accent: {
        subtle: { value: { base: "{colors.accent.50}", _dark: "{colors.surface.active}" } },
      },
      overlay: {
        value: { base: "rgba(14, 22, 20, 0.45)", _dark: "rgba(0, 0, 0, 0.72)" },
      },
    },
    text: {
      primary: { value: { base: "#0e1614", _dark: "{colors.neutral.100}" } },
      secondary: { value: { base: "#46554f", _dark: "#9aa8a2" } },
      // Metadata (timestamps, phone numbers, field labels).
      muted: { value: { base: "#6b7a74", _dark: "{colors.neutral.400}" } },
      disabled: { value: { base: "{colors.neutral.300}", _dark: "{colors.neutral.600}" } },
      inverse: { value: { base: "#ffffff", _dark: "{colors.surface.canvas}" } },
      // Green ink: the accent on dark, the AA-safe deep emerald on white.
      link: { value: { base: "{colors.brand.700}", _dark: "{colors.brand.400}" } },
      brand: { value: { base: "{colors.brand.700}", _dark: "{colors.brand.400}" } },
      accent: { value: { base: "{colors.accent.700}", _dark: "{colors.accent.400}" } },
      // Text/icon ON the primary action: white over the deep emerald (light),
      // the handoff's near-black green over the accent (dark).
      onBrand: { value: { base: "#ffffff", _dark: "#07130c" } },
      // Icon on the ColorModeToggle thumb (`bg.switch.thumb`).
      switchThumb: { value: { base: "{colors.text.primary}", _dark: "{colors.brand.400}" } },
    },
    border: {
      subtle: { value: { base: "#e6ece9", _dark: "{colors.neutral.900}" } },
      default: { value: { base: "#dce4e0", _dark: "{colors.neutral.800}" } },
      strong: { value: { base: "#c3cec8", _dark: "{colors.neutral.700}" } },
      // The bright green edge: card hover, active control.
      brand: { value: { base: "{colors.brand.500}", _dark: "{colors.brand.400}" } },
      // The resting green edge: an online device, a soft button, a green badge.
      accent: { value: { base: "{colors.brand.200}", _dark: "{colors.surface.line}" } },
      focus: { value: { base: "{colors.brand.600}", _dark: "{colors.brand.400}" } },
    },
    status: {
      success: {
        fg: { value: { base: "{colors.brand.700}", _dark: "{colors.brand.400}" } },
        solid: { value: { base: "{colors.brand.600}", _dark: "{colors.brand.400}" } },
        bg: { value: { base: "{colors.brand.50}", _dark: "{colors.surface.active}" } },
        border: { value: { base: "{colors.brand.200}", _dark: "{colors.surface.line}" } },
      },
      // Warning is purple, never yellow/orange/amber (project rule R11). The
      // handoff painted "pairing" amber; that state moved to `info` (blue), so
      // purple is left for real warnings — a toast the user must notice.
      warning: {
        fg: { value: { base: "#6d28d9", _dark: "#b58cff" } },
        solid: { value: { base: "#7c3aed", _dark: "#a273f5" } },
        bg: { value: { base: "#f4efff", _dark: "#171327" } },
        border: { value: { base: "#ddd0fa", _dark: "#2e2545" } },
      },
      error: {
        fg: { value: { base: "#c0392b", _dark: "#ff7a6b" } },
        solid: { value: { base: "#e05548", _dark: "#ff7a6b" } },
        bg: { value: { base: "#fdedea", _dark: "#1f1413" } },
        border: { value: { base: "#f5ccc5", _dark: "#3a211e" } },
      },
      // Blue — the handoff's live-work hue: a device pairing, a message being
      // sent, an informational toast.
      info: {
        fg: { value: { base: "#2e6fb8", _dark: "#7ab8ff" } },
        solid: { value: { base: "#3b82f6", _dark: "#7ab8ff" } },
        bg: { value: { base: "#eaf2fd", _dark: "#101725" } },
        border: { value: { base: "#c6dbf7", _dark: "#22314a" } },
      },
      neutral: {
        fg: { value: { base: "#6e7c76", _dark: "#9aa8a2" } },
        bg: { value: { base: "{colors.neutral.50}", _dark: "{colors.neutral.900}" } },
        border: { value: { base: "{colors.neutral.200}", _dark: "{colors.neutral.800}" } },
      },
      // Count/total emphasis (the Devices "registrados" stat). Same family as
      // `info`; they never collide in one view.
      blue: {
        fg: { value: { base: "#2e6fb8", _dark: "#7ab8ff" } },
        bg: { value: { base: "#eaf2fd", _dark: "#101725" } },
        border: { value: { base: "#c6dbf7", _dark: "#22314a" } },
      },
    },
  },
  shadows: {
    // The design separates surfaces with 1px borders, not elevation: dark mode
    // has effectively no shadow, and light mode keeps a whisper of one so a
    // white card still detaches from the off-white canvas.
    shadow: {
      card: {
        value: {
          base: "0px 1px 2px rgba(14, 22, 20, 0.05)",
          _dark: "none",
        },
      },
      cardHover: {
        value: {
          base: "0px 6px 20px -8px rgba(14, 22, 20, 0.14)",
          _dark: "0 0 0 1px rgba(63, 224, 138, 0.10), 0 0 26px rgba(63, 224, 138, 0.05)",
        },
      },
      panel: {
        value: {
          base: "0px 8px 24px -8px rgba(14, 22, 20, 0.14)",
          _dark: "0px 12px 32px -8px rgba(0, 0, 0, 0.60)",
        },
      },
      lg: {
        value: {
          base: "0px 16px 40px -12px rgba(14, 22, 20, 0.18)",
          _dark: "0px 20px 48px -12px rgba(0, 0, 0, 0.66)",
        },
      },
      inner: {
        value: {
          base: "inset 0 2px 4px 0 rgba(14, 22, 20, 0.06)",
          _dark: "inset 0 1px 2px 0 rgba(0, 0, 0, 0.35)",
        },
      },
      // Pill switch (ColorModeToggle).
      switchTrack: {
        value: {
          base: "inset 0 1px 2px rgba(14, 22, 20, 0.06)",
          _dark: "inset 0 1px 2px rgba(0, 0, 0, 0.45)",
        },
      },
      switchThumb: {
        value: {
          base: "0 1px 3px rgba(14, 22, 20, 0.20)",
          _dark: "0 1px 0 rgba(0, 0, 0, 0.45), inset 0 0 0 1px #223a2c",
        },
      },
      // Brand mark (logo tile) and the auth card. The handoff's only continuous
      // light is the online-device glow, so these stay flat and green-tinted.
      brandMark: {
        value: {
          base: "0 12px 28px -12px rgba(12, 127, 73, 0.40)",
          _dark: "0 12px 28px -12px rgba(63, 224, 138, 0.30)",
        },
      },
      brandMarkSm: {
        value: {
          base: "0 8px 18px -10px rgba(12, 127, 73, 0.35)",
          _dark: "0 8px 18px -10px rgba(63, 224, 138, 0.28)",
        },
      },
      authCard: {
        value: {
          base: "0 24px 64px -28px rgba(14, 22, 20, 0.20)",
          _dark: "0 24px 64px -28px rgba(0, 0, 0, 0.70)",
        },
      },
      // The one continuous animation in the system: the online device breathing.
      // Kept here so the keyframes in `globalCss` interpolate between tokens.
      liveLow: {
        value: {
          base: "0 0 0 1px rgba(12, 127, 73, 0.14), 0 0 26px rgba(12, 127, 73, 0.06)",
          _dark: "0 0 0 1px rgba(63, 224, 138, 0.10), 0 0 26px rgba(63, 224, 138, 0.05)",
        },
      },
      liveHigh: {
        value: {
          base: "0 0 0 1px rgba(12, 127, 73, 0.26), 0 0 34px rgba(12, 127, 73, 0.12)",
          _dark: "0 0 0 1px rgba(63, 224, 138, 0.22), 0 0 34px rgba(63, 224, 138, 0.11)",
        },
      },
    },
    // Focus-related shadows use bare keys (no `shadow.` prefix) so existing
    // consumers like `boxShadow="input-focus"` keep working without edits.
    outline: {
      value: {
        base: "0 0 0 3px rgba(18, 164, 94, 0.34)",
        _dark: "0 0 0 3px rgba(63, 224, 138, 0.32)",
      },
    },
    "input-focus": {
      value: {
        base: "0 0 0 3px rgba(18, 164, 94, 0.16)",
        _dark: "0 0 0 3px rgba(63, 224, 138, 0.18)",
      },
    },
    "input-error": {
      value: {
        base: "0 0 0 3px rgba(192, 57, 43, 0.12)",
        _dark: "0 0 0 3px rgba(255, 122, 107, 0.18)",
      },
    },
    "input-error-focus": {
      value: {
        base: "0 0 0 3px rgba(192, 57, 43, 0.20)",
        _dark: "0 0 0 3px rgba(255, 122, 107, 0.28)",
      },
    },
    "brand-glow": {
      value: {
        base: "0 0 0 3px rgba(18, 164, 94, 0.18)",
        _dark: "0 0 0 3px rgba(63, 224, 138, 0.20)",
      },
    },
    "accent-glow": {
      value: {
        base: "0 0 0 3px rgba(18, 164, 94, 0.18)",
        _dark: "0 0 0 3px rgba(63, 224, 138, 0.18)",
      },
    },
  },
});
