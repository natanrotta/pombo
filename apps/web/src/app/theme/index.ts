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
  },
});

export const system = createSystem(defaultConfig, config);
