import { defineTokens } from "@chakra-ui/react";

// Static shadows. Everything that has to swap between light and dark lives in
// `semantic-tokens.ts` under `shadow.*` (the design leans on 1px borders, so
// there is very little elevation to begin with).
export const shadows = defineTokens.shadows({
  sm: { value: "0px 1px 2px rgba(14, 22, 20, 0.05)" },
});
