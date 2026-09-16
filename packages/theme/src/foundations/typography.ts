import { defineTokens } from "@chakra-ui/react";

export const fonts = defineTokens.fonts({
  // Pombo tech/programmer identity: JetBrains Mono for headings & brand,
  // Inter for body copy, JetBrains Mono for code/mono contexts.
  heading: { value: "'JetBrains Mono', monospace" },
  body: { value: "'Inter', sans-serif" },
  mono: { value: "'JetBrains Mono', 'Fira Code', monospace" },
});
