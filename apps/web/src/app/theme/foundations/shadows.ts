import { defineTokens } from "@chakra-ui/react";

// Light-tuned static shadows. Values that need to swap between modes live in
// `semantic-tokens.ts` under the `shadow.*` namespace (e.g. `shadow.card`,
// `shadow.input-focus`, `shadow.outline`).
export const shadows = defineTokens.shadows({
  sm: {
    value:
      "0px 1px 3px rgba(13, 26, 22, 0.08), 0px 1px 2px rgba(13, 26, 22, 0.04)",
  },
});
