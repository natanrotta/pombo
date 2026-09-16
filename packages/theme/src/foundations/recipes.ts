import { defineRecipe } from "@chakra-ui/react";

// Single-slot component recipes. `createSystem` merges them over Chakra v3's
// default recipes (default sizes and states are preserved; these override the
// visual variants the app relies on).
//
// The multi-part v3 components (menu, dialog, popover, select, number-input)
// are deliberately NOT re-declared as slotRecipes: those render exclusively
// through the snippets in `src/components/ui/*`, which apply the same chrome
// via style props. One definition point, no config-merge surprises.
//
// The design moves in color, not in space: 150ms on color/background/border,
// no lift on hover, no colored drop shadows. Continuous animation is reserved
// for a live state (the online device's glow, the pairing pulse).
const TRANSITION = {
  transitionProperty: "background-color, border-color, color, box-shadow",
  transitionDuration: "150ms",
  transitionTimingFunction: "ease",
} as const;

export const buttonRecipe = defineRecipe({
  base: {
    borderRadius: "md",
    fontWeight: "500",
    ...TRANSITION,
    // Chakra's default button ring binds to `colorPalette.focusRing` (grey).
    // Overriding the outline color here beats it deterministically regardless
    // of a call site's `colorPalette`, so every button focuses on the accent.
    _focusVisible: { outlineColor: "border.focus" },
  },
  variants: {
    variant: {
      // Primary action: a flat accent fill with near-black ink (dark) or the
      // deep emerald with white ink (light). Radius 9–10px per the handoff.
      solid: {
        bg: "bg.brand.solid",
        color: "text.onBrand",
        borderRadius: "lg",
        fontWeight: "600",
        _hover: { bg: "bg.brand.solid-hover" },
        _active: { bg: "bg.brand.solid-active" },
      },
      // Secondary action ("+ novo device"): the green wash with a green edge
      // and mono type — the handoff's most common button.
      subtle: {
        bg: "bg.brand.subtle",
        color: "text.brand",
        border: "1px solid",
        borderColor: "border.accent",
        fontFamily: "mono",
        _hover: { bg: "bg.brand.subtle-hover", borderColor: "border.brand" },
        _active: { bg: "bg.brand.subtle-hover" },
      },
      ghost: {
        color: "text.secondary",
        bg: "transparent",
        _hover: { bg: "bg.hover", color: "text.primary" },
        _active: { bg: "bg.active" },
      },
      // Quiet action ("limpar"): canvas fill, neutral edge, mono type.
      outline: {
        border: "1px solid",
        borderColor: "border.default",
        color: "text.secondary",
        bg: "bg.canvas",
        fontFamily: "mono",
        _hover: { color: "text.primary", borderColor: "border.strong" },
        _active: { bg: "bg.hover" },
      },
      // Destructive secondary action (e.g. "Delete" next to a primary CTA):
      // the `outline` shape in the error palette. `colorPalette="red"` on
      // `outline` does nothing — that variant paints the brand explicitly.
      dangerOutline: {
        border: "1px solid",
        borderColor: "status.error.border",
        color: "status.error.fg",
        bg: "bg.canvas",
        fontFamily: "mono",
        _hover: { bg: "status.error.bg" },
        _active: { bg: "status.error.bg" },
      },
      danger: {
        bg: "status.error.solid",
        // White in both modes — the danger button is always red (not brand), so
        // it must NOT follow `text.onBrand` (near-black in dark, which would
        // fail contrast on red).
        color: "white",
        borderRadius: "lg",
        fontWeight: "600",
        _hover: { filter: "brightness(0.94)" },
        _active: { filter: "brightness(0.88)" },
      },
    },
    // Sizes mirror Chakra v3's defaults verbatim; they are declared locally only
    // so the recipe can set `size: "sm"` as the default. v3's built-in recipe
    // defaults to "md", which would silently grow every unsized Button.
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
        h: "38px",
        minW: "38px",
        textStyle: "sm",
        px: "4",
        gap: "2.5",
        _icon: { width: "4", height: "4" },
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

// Status pill: a mono label with a 6px radius, not a rounded capsule.
export const badgeRecipe = defineRecipe({
  base: {
    borderRadius: "sm",
    fontFamily: "mono",
    fontWeight: "400",
    fontSize: "11.5px",
    lineHeight: "1.2",
    px: 2.5,
    py: 1.5,
  },
});

/**
 * Shared "outline" field chrome — the single source of truth for the border
 * language across every form field (Input, Textarea, the native Select field
 * and the NumberInput input). The snippets spread this so a select and a text
 * input sitting in the same form are pixel-identical.
 *
 * `fontSize: { base: "16px", md: "13.5px" }` is deliberate, not a rounding: iOS
 * Safari zooms the page in when a focused input renders below 16px.
 */
export const fieldBase = {
  borderRadius: "md",
  bg: "bg.field",
  borderColor: "border.default",
  borderWidth: "1px",
  color: "text.primary",
  fontFamily: "mono",
  fontSize: { base: "16px", md: "13.5px" },
  ...TRANSITION,
  _hover: { borderColor: "border.strong" },
  _focusVisible: {
    borderColor: "border.focus",
    boxShadow: "input-focus",
    bg: "bg.field",
  },
  _invalid: {
    borderColor: "status.error.fg",
    boxShadow: "input-error",
  },
  _placeholder: { color: "text.muted", fontSize: "13.5px" },
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
// merge and beats `fieldBase`'s accent `_focusVisible`. Re-asserting fieldBase
// in the variant AND setting `focusVisibleRing: "none"` keeps the accent ring.
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
