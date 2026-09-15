import { defineRecipe } from "@chakra-ui/react";

// Single-slot component recipes, ported from the v2 single-part style configs.
// `createSystem` merges them over Chakra v3's default recipes (default sizes and
// states are preserved; these override the visual variants the app relies on).
//
// The multi-part v2 configs (menu, modal→dialog, popover, select, number-input)
// are deliberately NOT re-declared as slotRecipes: those components render
// exclusively through the v3 snippets in `src/components/ui/*`, which apply the
// same chrome via style props. One definition point, no config-merge surprises.
// The v2 `tabs` config was dropped outright — the app has no Tabs consumer.

export const buttonRecipe = defineRecipe({
  base: {
    borderRadius: "sm",
    fontWeight: "500",
    transitionProperty: "all",
    transitionDuration: "200ms",
    transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
    // Chakra's default button ring binds to `colorPalette.focusRing` (grey).
    // Overriding the outline color here beats it deterministically regardless of
    // a call site's `colorPalette`, so every button focuses emerald.
    _focusVisible: { outlineColor: "border.focus" },
  },
  variants: {
    variant: {
      solid: {
        bg: "bg.brand.solid",
        color: "text.onBrand",
        // Emerald-tinted shadow to match the green brand (mirrors the colored
        // shadow the `danger` variant uses for red).
        boxShadow: "0 1px 2px rgba(4, 120, 87, 0.28)",
        _hover: {
          bg: "bg.brand.solid-hover",
          transform: "translateY(-1px)",
          boxShadow: "0 4px 12px rgba(4, 120, 87, 0.36)",
        },
        _active: {
          bg: "bg.brand.solid-active",
          transform: "translateY(0)",
          boxShadow: "0 1px 2px rgba(4, 120, 87, 0.28)",
        },
      },
      subtle: {
        bg: "bg.brand.subtle",
        color: "text.brand",
        _hover: {
          bg: "bg.brand.subtle",
          filter: "brightness(0.97)",
          transform: "translateY(-1px)",
        },
        _active: { filter: "brightness(0.94)", transform: "translateY(0)" },
      },
      ghost: {
        color: "text.primary",
        bg: "transparent",
        _hover: { bg: "bg.hover" },
        _active: { bg: "bg.active" },
      },
      outline: {
        border: "1px solid",
        borderColor: "border.default",
        color: "text.brand",
        bg: "bg.surface",
        _hover: {
          bg: "bg.brand.subtle",
          borderColor: "border.brand",
          transform: "translateY(-1px)",
        },
        _active: { filter: "brightness(0.95)", transform: "translateY(0)" },
      },
      danger: {
        bg: "red.500",
        // White in both modes — the danger button is always red (not brand), so
        // it must NOT follow `text.onBrand` (near-black in dark, which would
        // fail contrast on red).
        color: "#ffffff",
        boxShadow: "0 1px 2px rgba(239, 68, 68, 0.20)",
        _hover: {
          bg: "red.600",
          transform: "translateY(-1px)",
          boxShadow: "0 4px 12px rgba(239, 68, 68, 0.30)",
        },
        _active: { bg: "red.700", transform: "translateY(0)" },
      },
    },
    // Sizes mirror Chakra v3's defaults verbatim; they are declared locally only
    // so the recipe can set `size: "sm"` as the default — matching the v2
    // theme's `defaultProps: { size: "sm" }`. v3's built-in recipe defaults to
    // "md", which would silently grow every unsized Button in the app.
    size: {
      "2xs": {
        h: "6",
        minW: "6",
        textStyle: "xs",
        px: "2",
        gap: "1",
        _icon: { width: "3.5", height: "3.5" },
      },
      xs: {
        h: "8",
        minW: "8",
        textStyle: "xs",
        px: "2.5",
        gap: "1",
        _icon: { width: "4", height: "4" },
      },
      sm: {
        h: "9",
        minW: "9",
        px: "3.5",
        textStyle: "sm",
        gap: "2",
        _icon: { width: "4", height: "4" },
      },
      md: {
        h: "10",
        minW: "10",
        textStyle: "sm",
        px: "4",
        gap: "2",
        _icon: { width: "5", height: "5" },
      },
      lg: {
        h: "11",
        minW: "11",
        textStyle: "md",
        px: "5",
        gap: "3",
        _icon: { width: "5", height: "5" },
      },
      xl: {
        h: "12",
        minW: "12",
        textStyle: "md",
        px: "5",
        gap: "2.5",
        _icon: { width: "5", height: "5" },
      },
      "2xl": {
        h: "16",
        minW: "16",
        textStyle: "lg",
        px: "7",
        gap: "3",
        _icon: { width: "6", height: "6" },
      },
    },
  },
  defaultVariants: {
    variant: "solid",
    size: "sm",
  },
});

export const badgeRecipe = defineRecipe({
  base: {
    borderRadius: "full",
    fontWeight: "600",
    px: 2.5,
    py: 1,
  },
});

/**
 * Shared "outline" field chrome — the single source of truth for the border
 * language across every form field (Input, Textarea, the native Select field
 * and the NumberInput input). The snippets spread this so a select and a text
 * input sitting in the same form are pixel-identical.
 *
 * `fontSize: { base: "16px", md: "sm" }` is deliberate, not a rounding: iOS
 * Safari zooms the page in when a focused input renders below 16px.
 */
export const fieldBase = {
  borderRadius: "sm",
  bg: "bg.surface",
  borderColor: "border.default",
  borderWidth: "1.5px",
  color: "text.primary",
  fontSize: { base: "16px", md: "sm" },
  transition: "all 0.2s cubic-bezier(0.22, 1, 0.36, 1)",
  _hover: { borderColor: "border.strong" },
  _focusVisible: {
    borderColor: "border.focus",
    boxShadow: "input-focus",
    bg: "bg.surface",
  },
  _invalid: {
    borderColor: "status.error.fg",
    boxShadow: "input-error",
  },
  _placeholder: { color: "text.muted", fontSize: "sm" },
  _disabled: {
    borderColor: "border.subtle",
    bg: "bg.muted",
    opacity: 0.7,
    cursor: "not-allowed",
  },
  _readOnly: {
    borderColor: "border.default",
    bg: "bg.muted",
    cursor: "default",
    _focusVisible: { boxShadow: "none", borderColor: "border.default" },
  },
} as const;

// Chakra v3's DEFAULT input/textarea recipe ships `outline` with
// `focusVisibleRing: "inside"` bound to `colorPalette.focusRing` (grey). A
// recipe that overrides only `base` loses: that grey ring survives the config
// merge and beats `fieldBase`'s emerald `_focusVisible`. Re-asserting fieldBase
// in the variant AND setting `focusVisibleRing: "none"` keeps the emerald ring.
const fieldOutlineVariant = { ...fieldBase, focusVisibleRing: "none" } as const;

export const inputRecipe = defineRecipe({
  base: { ...fieldBase, h: { base: "44px", md: "40px" } },
  variants: { variant: { outline: fieldOutlineVariant } },
  defaultVariants: { variant: "outline" },
});

export const textareaRecipe = defineRecipe({
  base: { ...fieldBase },
  variants: { variant: { outline: fieldOutlineVariant } },
  defaultVariants: { variant: "outline" },
});
