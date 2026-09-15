import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";
import { colors } from "@/app/theme/foundations/colors";
import { fonts } from "@/app/theme/foundations/typography";
import { radii } from "@/app/theme/foundations/radii";
import {
  badgeRecipe,
  buttonRecipe,
  inputRecipe,
  textareaRecipe,
} from "@/app/theme/foundations/recipes";
import { shadows } from "@/app/theme/foundations/shadows";
import { semanticTokens } from "@/app/theme/foundations/semantic-tokens";
import { textStyles } from "@/app/theme/foundations/text-styles";

/**
 * Preserved from the pre-v3 theme so a returning user keeps the color mode they
 * chose. Consumed by the `next-themes` provider (`storageKey`) in
 * `components/ui/provider`, which also keeps `defaultTheme="system"` — the OS
 * preference wins on the very first visit, the explicit choice sticks after.
 */
export const COLOR_MODE_STORAGE_KEY = "pombo-color-mode";

const config = defineConfig({
  theme: {
    tokens: { colors, fonts, radii, shadows },
    semanticTokens,
    textStyles,
    recipes: {
      badge: badgeRecipe,
      button: buttonRecipe,
      input: inputRecipe,
      textarea: textareaRecipe,
    },
  },
  globalCss: {
    body: {
      bg: "bg.canvas",
      color: "text.primary",
      fontSize: "sm",
      minH: "100vh",
      // A faint forest wash top-left + a soft emerald radial top-right give the
      // light canvas some life. Dark mode drops the forest wash (it would just
      // muddy the dark canvas) and keeps only a subtle emerald glow so the green
      // identity carries through on both themes.
      backgroundImage:
        "radial-gradient(ellipse 60% 40% at 10% -10%, rgba(6, 78, 59, 0.05) 0%, transparent 60%), radial-gradient(ellipse 50% 35% at 90% 5%, rgba(16, 185, 129, 0.07) 0%, transparent 55%)",
      _dark: {
        backgroundImage:
          "radial-gradient(ellipse 70% 50% at 12% -10%, rgba(16, 185, 129, 0.06) 0%, transparent 65%)",
      },
    },
    "*::placeholder": {
      color: "text.muted",
    },
    ".rich-text-editor .ProseMirror": {
      outline: "none",
      minH: "120px",
      px: 4,
      py: 3,
      fontSize: "sm",
      lineHeight: 1.6,
      color: "text.primary",
    },
    ".rich-text-editor .ProseMirror p.is-editor-empty:first-of-type::before": {
      content: "attr(data-placeholder)",
      float: "left",
      color: "text.muted",
      pointerEvents: "none",
      height: 0,
    },
    ".rich-text-editor .ProseMirror h2": {
      fontSize: "1.15em",
      fontWeight: 700,
      margin: "0.8em 0 0.4em",
    },
    ".rich-text-editor .ProseMirror h3": {
      fontSize: "1.05em",
      fontWeight: 600,
      margin: "0.6em 0 0.3em",
    },
    // `listStyle` is re-declared (not inherited from the UA sheet) because
    // Chakra's preflight resets `ol, ul { list-style: none }` app-wide — without
    // this the list nodes indent but render no bullet/number at all.
    ".rich-text-editor .ProseMirror ul, .rich-text-editor .ProseMirror ol": {
      paddingLeft: "1.4em",
      margin: "0.4em 0",
    },
    ".rich-text-editor .ProseMirror ul": { listStyle: "disc outside" },
    ".rich-text-editor .ProseMirror ol": { listStyle: "decimal outside" },
    ".rich-text-editor .ProseMirror li": {
      margin: "0.15em 0",
    },
    // Same story for italics: preflight's `* { font: inherit }` shorthand resets
    // `font-style`, so `<em>` renders upright. Chakra restores the bold
    // counterpart (`b, strong { font-weight: bolder }`) but has none for italic.
    ".rich-text-editor .ProseMirror em, .rich-text-editor .ProseMirror i": {
      fontStyle: "italic",
    },
    ".rich-text-editor .ProseMirror blockquote": {
      borderLeft: "3px solid",
      borderColor: "border.default",
      paddingLeft: 3,
      margin: "0.5em 0",
      color: "text.secondary",
    },
    ".rich-text-editor .ProseMirror code": {
      bg: "bg.muted",
      px: 1,
      borderRadius: "3px",
      fontSize: "0.9em",
    },
    ".rich-text-editor .ProseMirror p": {
      margin: "0.25em 0",
    },
    ".rich-text-viewer": {
      fontSize: "sm",
      lineHeight: 1.6,
      color: "text.secondary",
    },
    ".rich-text-viewer h2": {
      fontSize: "1.15em",
      fontWeight: 700,
      margin: "0.8em 0 0.4em",
      color: "text.primary",
    },
    ".rich-text-viewer h3": {
      fontSize: "1.05em",
      fontWeight: 600,
      margin: "0.6em 0 0.3em",
      color: "text.primary",
    },
    ".rich-text-viewer ul, .rich-text-viewer ol": {
      paddingLeft: "1.4em",
      margin: "0.4em 0",
    },
    ".rich-text-viewer ul": { listStyle: "disc outside" },
    ".rich-text-viewer ol": { listStyle: "decimal outside" },
    ".rich-text-viewer li": {
      margin: "0.15em 0",
    },
    ".rich-text-viewer em, .rich-text-viewer i": { fontStyle: "italic" },
    ".rich-text-viewer blockquote": {
      borderLeft: "3px solid",
      borderColor: "border.default",
      paddingLeft: 3,
      margin: "0.5em 0",
      color: "text.muted",
    },
    ".rich-text-viewer code": {
      bg: "bg.muted",
      px: 1,
      borderRadius: "3px",
      fontSize: "0.9em",
    },
    ".rich-text-viewer p": {
      margin: "0.25em 0",
    },
  },
});

export const system = createSystem(defaultConfig, config);
