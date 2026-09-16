import { defineTokens } from "@chakra-ui/react";

// The handoff works in a tight 6–10px range: 6 for badges and small controls,
// 8 for inputs and secondary buttons, 9–10 for the primary button and cards.
export const radii = defineTokens.radii({
  none: { value: "0" },
  xs: { value: "4px" },
  sm: { value: "6px" },
  md: { value: "8px" },
  lg: { value: "10px" },
  xl: { value: "14px" },
  "2xl": { value: "18px" },
  "3xl": { value: "24px" },
  full: { value: "9999px" },
});
