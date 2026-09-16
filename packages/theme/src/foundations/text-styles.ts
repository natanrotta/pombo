import { defineTextStyles } from "@chakra-ui/react";

export const textStyles = defineTextStyles({
  display: {
    value: {
      fontFamily: "heading",
      fontWeight: "800",
      fontSize: { base: "2xl", md: "3xl" },
      lineHeight: "1.2",
      // JetBrains Mono runs wide at heavy weights — pull tracking in a touch
      // more than the previous sans display so large headings stay compact.
      letterSpacing: "-0.03em",
    },
  },
  pageTitle: {
    value: {
      fontFamily: "heading",
      fontWeight: "700",
      fontSize: { base: "lg", md: "xl" },
      lineHeight: "1.25",
      letterSpacing: "tight",
    },
  },
  sectionTitle: {
    value: {
      fontFamily: "heading",
      fontWeight: "700",
      fontSize: "md",
      lineHeight: "1.3",
    },
  },
  eyebrow: {
    value: {
      fontFamily: "heading",
      fontWeight: "700",
      fontSize: "xs",
      lineHeight: "1.2",
      letterSpacing: "wider",
      textTransform: "uppercase",
    },
  },
  body: {
    value: {
      fontFamily: "body",
      fontWeight: "400",
      fontSize: "sm",
      lineHeight: "1.6",
    },
  },
  bodyStrong: {
    value: {
      fontFamily: "body",
      fontWeight: "600",
      fontSize: "sm",
      lineHeight: "1.5",
    },
  },
  caption: {
    value: {
      fontFamily: "body",
      fontWeight: "500",
      fontSize: "xs",
      lineHeight: "1.4",
    },
  },
  mono: {
    value: {
      fontFamily: "mono",
      fontWeight: "500",
      fontSize: "xs",
      lineHeight: "1.4",
    },
  },
});
