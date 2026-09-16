import { defineSemanticTokens } from "@chakra-ui/react";

// Semantic aliases (Chakra v3). `base` = light value, `_dark` overrides in dark
// mode. Palette references use the `{colors.<palette>.<step>}` syntax; raw
// hex/rgba values are literal.
export const semanticTokens = defineSemanticTokens({
  colors: {
    bg: {
      canvas: { value: { base: "#fafbfb", _dark: "#0b0f0e" } },
      surface: { value: { base: "#ffffff", _dark: "#121917" } },
      elevated: { value: { base: "#ffffff", _dark: "#17201c" } },
      sunken: { value: { base: "#eef1f0", _dark: "#080b0a" } },
      muted: {
        value: {
          base: "{colors.neutral.50}",
          _dark: "rgba(255, 255, 255, 0.04)",
        },
      },
      hover: {
        value: {
          base: "{colors.neutral.100}",
          _dark: "rgba(255, 255, 255, 0.07)",
        },
      },
      active: {
        value: {
          base: "{colors.neutral.200}",
          _dark: "rgba(255, 255, 255, 0.11)",
        },
      },
      glass: {
        value: {
          base: "rgba(255, 255, 255, 0.80)",
          _dark: "rgba(18, 25, 23, 0.78)",
        },
      },
      topbar: {
        value: {
          base: "rgba(255, 255, 255, 0.92)",
          _dark: "rgba(18, 25, 23, 0.88)",
        },
      },
      brand: {
        // Faint emerald wash on the dark canvas.
        subtle: {
          value: {
            base: "{colors.brand.50}",
            _dark: "rgba(16, 185, 129, 0.14)",
          },
        },
        emphasis: {
          value: { base: "{colors.brand.800}", _dark: "{colors.brand.200}" },
        },
        // Primary action ("solid" button) — the emerald. Light mode uses the
        // button-safe deep emerald (600) with WHITE text; dark mode flips to a
        // bright emerald (500) with near-black emerald-ink text, so the CTA pops
        // on the dark canvas while staying legible in both modes. Hover/active
        // deepen (light) or brighten (dark) for press feedback.
        solid: {
          value: { base: "{colors.brand.600}", _dark: "{colors.brand.500}" },
        },
        "solid-hover": {
          value: { base: "{colors.brand.700}", _dark: "{colors.brand.400}" },
        },
        "solid-active": {
          value: { base: "{colors.brand.800}", _dark: "{colors.brand.600}" },
        },
      },
      accent: {
        subtle: {
          value: {
            base: "{colors.accent.50}",
            _dark: "rgba(16, 185, 129, 0.14)",
          },
        },
      },
      overlay: {
        value: {
          base: "{colors.blackAlpha.400}",
          _dark: "rgba(0, 0, 0, 0.72)",
        },
      },
    },
    text: {
      primary: { value: { base: "#0f1a17", _dark: "#ecf5f1" } },
      secondary: { value: { base: "#47554f", _dark: "#a5b2ac" } },
      // ≈ 4.5:1 contrast on bg.surface (#121917) in dark — meets WCAG AA for body text
      muted: { value: { base: "{colors.neutral.400}", _dark: "#7e8b85" } },
      disabled: { value: { base: "{colors.neutral.300}", _dark: "#495049" } },
      inverse: { value: { base: "#ffffff", _dark: "#0b0f0e" } },
      // Links / brand text use the readable "deep emerald" (700 ≈ 5.5:1 on white);
      // dark mode lifts to a bright emerald (300) on the dark canvas.
      link: {
        value: { base: "{colors.brand.700}", _dark: "{colors.brand.300}" },
      },
      brand: {
        value: { base: "{colors.brand.700}", _dark: "{colors.brand.300}" },
      },
      accent: {
        value: { base: "{colors.accent.700}", _dark: "{colors.accent.300}" },
      },
      // Text/icon color that sits ON the primary emerald button — white in light
      // mode (on deep emerald), near-black emerald-ink in dark mode (on bright
      // emerald). Both directions clear WCAG AA.
      onBrand: { value: { base: "#ffffff", _dark: "#052e21" } },
    },
    border: {
      subtle: {
        value: {
          base: "rgba(15, 26, 23, 0.07)",
          _dark: "rgba(255, 255, 255, 0.06)",
        },
      },
      default: {
        value: {
          base: "rgba(15, 26, 23, 0.12)",
          _dark: "rgba(255, 255, 255, 0.11)",
        },
      },
      strong: {
        value: {
          base: "rgba(15, 26, 23, 0.20)",
          _dark: "rgba(255, 255, 255, 0.20)",
        },
      },
      brand: {
        value: { base: "{colors.brand.400}", _dark: "{colors.brand.500}" },
      },
      // Emerald callout border. Pairs with `bg.accent.subtle`: the dark value is
      // a translucent emerald (16,185,129 + 0.32 alpha) so it reads as a soft
      // outline over the dark surface instead of a solid slab.
      accent: {
        value: {
          base: "{colors.accent.300}",
          _dark: "rgba(16, 185, 129, 0.32)",
        },
      },
      // Focus ring color — emerald, so every focused control carries the brand
      // (paired with the `outline`/`input-focus` shadows below).
      focus: {
        value: { base: "{colors.brand.500}", _dark: "{colors.brand.400}" },
      },
    },
    status: {
      success: {
        fg: {
          value: { base: "{colors.green.600}", _dark: "{colors.green.300}" },
        },
        bg: {
          value: {
            base: "{colors.green.50}",
            _dark: "rgba(34, 197, 94, 0.12)",
          },
        },
        border: {
          value: {
            base: "{colors.green.200}",
            _dark: "rgba(34, 197, 94, 0.30)",
          },
        },
      },
      // Warning deliberately maps to a purple/caution palette (not yellow/orange) —
      // project rule: never use yellow/orange tones in the UI.
      warning: {
        fg: {
          value: { base: "{colors.purple.600}", _dark: "{colors.purple.300}" },
        },
        bg: {
          value: {
            base: "{colors.purple.50}",
            _dark: "rgba(168, 85, 247, 0.12)",
          },
        },
        border: {
          value: {
            base: "{colors.purple.200}",
            _dark: "rgba(168, 85, 247, 0.30)",
          },
        },
      },
      error: {
        fg: { value: { base: "{colors.red.600}", _dark: "{colors.red.300}" } },
        bg: {
          value: { base: "{colors.red.50}", _dark: "rgba(239, 68, 68, 0.12)" },
        },
        border: {
          value: { base: "{colors.red.200}", _dark: "rgba(239, 68, 68, 0.30)" },
        },
      },
      // Info maps to BLUE (not the brand) — the brand is green, so an emerald
      // "info" would be indistinguishable from the green "success". Blue is the
      // conventional information hue and keeps the two semantics apart.
      info: {
        fg: {
          value: { base: "{colors.blue.600}", _dark: "{colors.blue.300}" },
        },
        bg: {
          value: {
            base: "{colors.blue.50}",
            _dark: "rgba(59, 130, 246, 0.12)",
          },
        },
        border: {
          value: {
            base: "{colors.blue.200}",
            _dark: "rgba(59, 130, 246, 0.30)",
          },
        },
      },
      neutral: {
        fg: { value: { base: "{colors.neutral.600}", _dark: "#a5b2ac" } },
        bg: {
          value: {
            base: "{colors.neutral.100}",
            _dark: "rgba(255, 255, 255, 0.06)",
          },
        },
        border: {
          value: {
            base: "{colors.neutral.200}",
            _dark: "rgba(255, 255, 255, 0.12)",
          },
        },
      },
      // Blue — count/total emphasis (e.g. the Devices "Total" stat card). Shares
      // the blue family with `status.info`; they never collide in the same view.
      blue: {
        fg: {
          value: { base: "{colors.blue.600}", _dark: "{colors.blue.300}" },
        },
        bg: {
          value: {
            base: "{colors.blue.50}",
            _dark: "rgba(59, 130, 246, 0.12)",
          },
        },
        border: {
          value: {
            base: "{colors.blue.200}",
            _dark: "rgba(59, 130, 246, 0.30)",
          },
        },
      },
    },
  },
  shadows: {
    // Surface separation is carried by borders + a soft green-ink shadow
    // (rgba 13,26,22 ≈ the #0f1a17 emerald-ink text color). Cards rely on a 1px
    // border + tiny shadow; only panels and overlays get a real, soft shadow.
    shadow: {
      card: {
        value: {
          base: "0px 1px 2px rgba(13, 26, 22, 0.06), 0px 4px 12px -2px rgba(13, 26, 22, 0.08)",
          _dark: "0px 1px 0 rgba(0, 0, 0, 0.20)",
        },
      },
      cardHover: {
        value: {
          base: "0px 4px 8px rgba(13, 26, 22, 0.06), 0px 12px 28px -4px rgba(13, 26, 22, 0.12)",
          _dark:
            "0px 0 0 1px rgba(255, 255, 255, 0.04), 0px 8px 24px -8px rgba(0, 0, 0, 0.55)",
        },
      },
      panel: {
        value: {
          base: "0px 8px 24px -4px rgba(13, 26, 22, 0.14), 0px 2px 6px rgba(13, 26, 22, 0.06)",
          _dark:
            "0px 12px 32px -8px rgba(0, 0, 0, 0.55), 0px 2px 6px rgba(0, 0, 0, 0.35)",
        },
      },
      lg: {
        value: {
          base: "0px 16px 40px -8px rgba(13, 26, 22, 0.16), 0px 4px 12px rgba(13, 26, 22, 0.06)",
          _dark:
            "0px 20px 48px -12px rgba(0, 0, 0, 0.60), 0px 4px 12px rgba(0, 0, 0, 0.35)",
        },
      },
      inner: {
        value: {
          base: "inset 0 2px 4px 0 rgba(13, 26, 22, 0.06)",
          _dark: "inset 0 1px 2px 0 rgba(0, 0, 0, 0.30)",
        },
      },
    },
    // Focus-related shadows use bare keys (no `shadow.` prefix) so existing
    // consumers like `boxShadow="input-focus"` keep working without edits. All
    // focus rings carry the emerald (16,185,129); dark lifts alpha so it still reads.
    outline: {
      value: {
        base: "0 0 0 3px rgba(16, 185, 129, 0.40)",
        _dark: "0 0 0 3px rgba(16, 185, 129, 0.45)",
      },
    },
    "input-focus": {
      value: {
        base: "0 0 0 3px rgba(16, 185, 129, 0.20)",
        _dark: "0 0 0 3px rgba(16, 185, 129, 0.28)",
      },
    },
    "input-error": {
      value: {
        base: "0 0 0 3px rgba(245, 101, 101, 0.12)",
        _dark: "0 0 0 3px rgba(252, 165, 165, 0.22)",
      },
    },
    "input-error-focus": {
      value: {
        base: "0 0 0 3px rgba(245, 101, 101, 0.20)",
        _dark: "0 0 0 3px rgba(252, 165, 165, 0.32)",
      },
    },
    "brand-glow": {
      // Emerald glow to match the primary action.
      value: {
        base: "0px 0px 0px 3px rgba(16, 185, 129, 0.20), 0px 4px 12px rgba(16, 185, 129, 0.15)",
        _dark:
          "0px 0px 0px 3px rgba(16, 185, 129, 0.18), 0px 4px 12px rgba(16, 185, 129, 0.20)",
      },
    },
    "accent-glow": {
      value: {
        base: "0px 0px 0px 3px rgba(16, 185, 129, 0.20), 0px 4px 12px rgba(16, 185, 129, 0.15)",
        _dark:
          "0px 0px 0px 3px rgba(16, 185, 129, 0.16), 0px 4px 12px rgba(16, 185, 129, 0.18)",
      },
    },
  },
});
