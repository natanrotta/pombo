import { defineTokens } from "@chakra-ui/react";

export const fonts = defineTokens.fonts({
  // The handoff's terminal identity: IBM Plex Mono for every heading, field
  // label, number, phone and token; IBM Plex Sans for body copy. Both are
  // bundled with the app (`@fontsource/*`), so nothing is fetched at runtime.
  heading: { value: "'IBM Plex Mono', ui-monospace, monospace" },
  body: { value: "'IBM Plex Sans', system-ui, sans-serif" },
  mono: { value: "'IBM Plex Mono', ui-monospace, monospace" },
});
