import { defineTextStyles } from "@chakra-ui/react";

// The handoff's five voices. Mono carries structure (page titles, card titles,
// labels, numbers); Sans carries prose.
export const textStyles = defineTextStyles({
  // Marketing-sized statement (auth screens).
  display: {
    value: {
      fontFamily: "heading",
      fontWeight: "400",
      fontSize: { base: "28px", md: "34px" },
      lineHeight: "1.15",
      letterSpacing: "-1.2px",
    },
  },
  // Page title: lowercase mono, tight tracking — the screens pair it with a
  // green full stop (`PageHeader` renders it).
  pageTitle: {
    value: {
      fontFamily: "heading",
      fontWeight: "400",
      fontSize: { base: "22px", md: "27px" },
      lineHeight: "1.2",
      letterSpacing: "-0.8px",
      textTransform: "lowercase",
    },
  },
  // Card / section title.
  sectionTitle: {
    value: {
      fontFamily: "heading",
      fontWeight: "500",
      fontSize: "14.5px",
      lineHeight: "1.3",
      letterSpacing: "-0.2px",
    },
  },
  // Field label and column header: tiny mono, uppercase, wide tracking.
  eyebrow: {
    value: {
      fontFamily: "heading",
      fontWeight: "400",
      fontSize: "10px",
      lineHeight: "1.2",
      letterSpacing: "1.2px",
      textTransform: "uppercase",
    },
  },
  body: {
    value: {
      fontFamily: "body",
      fontWeight: "400",
      fontSize: "13.5px",
      lineHeight: "1.6",
    },
  },
  bodyStrong: {
    value: {
      fontFamily: "body",
      fontWeight: "500",
      fontSize: "13.5px",
      lineHeight: "1.5",
    },
  },
  caption: {
    value: {
      fontFamily: "body",
      fontWeight: "400",
      fontSize: "12.5px",
      lineHeight: "1.45",
    },
  },
  // Numbers, phones, tokens, timestamps.
  mono: {
    value: {
      fontFamily: "mono",
      fontWeight: "400",
      fontSize: "12.5px",
      lineHeight: "1.4",
    },
  },
  // The big number on a stat tile.
  metric: {
    value: {
      fontFamily: "mono",
      fontWeight: "500",
      fontSize: "26px",
      lineHeight: "1",
    },
  },
});
