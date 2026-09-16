import { defineConfig } from "@chakra-ui/react";

import { colors } from "./foundations/colors";
import { fonts } from "./foundations/typography";
import { radii } from "./foundations/radii";
import { shadows } from "./foundations/shadows";
import { semanticTokens } from "./foundations/semantic-tokens";
import { textStyles } from "./foundations/text-styles";
import { badgeRecipe, buttonRecipe, inputRecipe, textareaRecipe } from "./foundations/recipes";

/**
 * The Pombo design system, as a Chakra v3 config fragment.
 *
 * This package owns WHAT the brand looks like — palettes, semantic aliases,
 * type scale, radii, shadows and the component recipes. It owns nothing about a
 * specific surface: no `globalCss`, no color-mode plumbing, no app-only
 * overrides. A consumer composes its own system on top:
 *
 * ```ts
 * export const system = createSystem(defaultConfig, pomboThemeConfig, appConfig);
 * ```
 *
 * `createSystem` deep-merges left to right, so the app config layers over these
 * foundations without forking them. Applying a new design is a change to the
 * foundation values here; the app's token contract spec guards the result
 * (every semantic token has a dark value, no yellow/orange/amber, no token the
 * app references goes missing).
 */
export const pomboThemeConfig = defineConfig({
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
});

export { colors } from "./foundations/colors";
export { fonts } from "./foundations/typography";
export { radii } from "./foundations/radii";
export { shadows } from "./foundations/shadows";
export { semanticTokens } from "./foundations/semantic-tokens";
export { textStyles } from "./foundations/text-styles";
export {
  badgeRecipe,
  buttonRecipe,
  fieldBase,
  inputRecipe,
  textareaRecipe,
} from "./foundations/recipes";
