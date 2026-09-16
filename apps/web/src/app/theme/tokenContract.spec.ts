import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  badgeRecipe,
  buttonRecipe,
  colors,
  fieldBase,
  inputRecipe,
  semanticTokens,
  shadows,
  textareaRecipe,
} from "@pombo/theme";
import { system } from "@/app/theme";

/**
 * Guards the design system at the seam where a new design gets applied: the
 * foundation values in `@pombo/theme` can change freely, but three things must
 * hold, and nothing else in the toolchain checks them.
 *
 *  1. Every semantic token has a light AND a dark value — a token without
 *     `_dark` renders its light value on the dark canvas.
 *  2. No value falls in the yellow/orange/amber range (hard project rule;
 *     warnings are purple).
 *  3. Every token the app names in a color/shadow/textStyle prop exists.
 *     Chakra types these props as open strings, so a missing token
 *     type-checks, lints and renders — the declaration is just dropped.
 */

type Leaf = { path: string; value: unknown };

function collectLeaves(node: unknown, prefix: string, out: Leaf[]): Leaf[] {
  if (!node || typeof node !== "object") return out;
  for (const [key, child] of Object.entries(node)) {
    if (child && typeof child === "object" && "value" in child) {
      out.push({ path: `${prefix}${key}`, value: (child as { value: unknown }).value });
    } else {
      collectLeaves(child, `${prefix}${key}.`, out);
    }
  }
  return out;
}

const semanticLeaves = collectLeaves(semanticTokens, "", []);

/** Tokens whose light and dark values are identical ON PURPOSE (decorative
 *  light on the canvas). Any other identical pair is treated as a forgotten
 *  dark value. */
const SAME_IN_BOTH_MODES = new Set([
  "colors.bg.glow.primary",
  "colors.bg.glow.secondary",
  "colors.bg.glow.tertiary",
  "shadows.shadow.brandMark",
  "shadows.shadow.brandMarkSm",
  "shadows.shadow.authCard",
]);

function rawStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") return Object.values(value).flatMap(rawStrings);
  return [];
}

// ── color math ───────────────────────────────────────────────────────────────
const HEX = /#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})\b/gi;
const RGB = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)/gi;

function hueAndSaturation(r: number, g: number, b: number): { hue: number; sat: number } {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const light = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { hue: 0, sat: 0 };
  const sat = delta / (1 - Math.abs(2 * light - 1));
  let hue: number;
  if (max === rn) hue = ((gn - bn) / delta) % 6;
  else if (max === gn) hue = (bn - rn) / delta + 2;
  else hue = (rn - gn) / delta + 4;
  return { hue: (hue * 60 + 360) % 360, sat };
}

function literalColors(text: string): { literal: string; r: number; g: number; b: number }[] {
  const found: { literal: string; r: number; g: number; b: number }[] = [];
  for (const [literal, hex] of text.matchAll(HEX)) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex.slice(0, 6);
    found.push({
      literal,
      r: parseInt(full.slice(0, 2), 16),
      g: parseInt(full.slice(2, 4), 16),
      b: parseInt(full.slice(4, 6), 16),
    });
  }
  for (const [literal, r, g, b, alpha] of text.matchAll(RGB)) {
    if (alpha !== undefined && Number(alpha) === 0) continue;
    found.push({ literal, r: Number(r), g: Number(g), b: Number(b) });
  }
  return found;
}

/** Orange → amber → yellow, with enough saturation to read as a warm hue. */
function isWarm(r: number, g: number, b: number): boolean {
  const { hue, sat } = hueAndSaturation(r, g, b);
  return sat >= 0.35 && hue >= 15 && hue <= 70;
}

const WARM_PALETTE_REF = /\{colors\.(yellow|orange|amber)\./;
/** Chakra's defaultConfig ships these palettes, so they are "known" tokens —
 *  the source scan must reject them explicitly. */
const WARM_PALETTE = /^(yellow|orange|amber)(\.|$)/;
const COLOR_PALETTE_PROP = /\bcolorPalette\s*[=:]\s*"([^"]+)"/g;
/** CSS named colors in the forbidden range — a value can dodge the hex/rgb
 *  math by being spelled out. */
const WARM_NAMED_COLOR =
  /\b(yellow|gold|goldenrod|darkgoldenrod|palegoldenrod|lightgoldenrodyellow|khaki|darkkhaki|orange|darkorange|orangered|coral|tomato|sandybrown|peru|chocolate|wheat|moccasin|bisque|navajowhite|peachpuff|papayawhip|blanchedalmond|burlywood|tan|lemonchiffon|lightyellow|cornsilk)\b/i;

// ── source scan ──────────────────────────────────────────────────────────────
const SRC_ROOT = path.resolve(__dirname, "../..");
/** The theme package names tokens too: recipes (`bg: "bg.brand.solid"`) and
 *  semantic tokens that reference others (`{colors.bg.muted}`). */
const THEME_ROOT = path.resolve(SRC_ROOT, "../../../packages/theme/src");

function collectSourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectSourceFiles(full, acc);
    else if (/\.tsx?$/.test(entry.name) && !/\.(spec|d)\.tsx?$/.test(entry.name)) acc.push(full);
  }
  return acc;
}

const COLOR_PROPS =
  "color|bg|bgColor|background|backgroundColor|borderColor|borderTopColor|borderBottomColor|borderLeftColor|borderRightColor|borderInlineStartColor|borderInlineEndColor|outlineColor|fill|stroke|gradientFrom|gradientTo|gradientVia|caretColor|accentColor";
const TOKEN_PROP = new RegExp(
  `\\b(${COLOR_PROPS}|boxShadow|shadow|textStyle)\\s*[=:]\\s*"([^"]+)"`,
  "g",
);
const TOKEN_REF = /\{(colors|shadows)\.([\w.-]+)\}/g;
/** Any quoted string shaped like a semantic token path — catches the names kept
 *  in config maps (`STATUS_CONFIG`, `toneStyles`) that a prop regex never sees. */
const SEMANTIC_PATH = /["']((?:bg|text|border|status|shadow)\.[\w.-]+)["']/g;
const CSS_KEYWORDS = new Set([
  "transparent",
  "currentColor",
  "currentcolor",
  "inherit",
  "initial",
  "unset",
  "none",
  "white",
  "black",
]);

/** i18n keys (no namespace prefix, as `t()` receives them): a semantic-shaped
 *  string that is an i18n key is not a token reference. */
function i18nKeys(): Set<string> {
  const keys = new Set<string>();
  const localeDir = path.join(SRC_ROOT, "shared/i18n/locales/pt-BR");
  const walk = (node: unknown, prefix: string) => {
    if (!node || typeof node !== "object") return;
    for (const [key, child] of Object.entries(node)) {
      const full = `${prefix}${key}`;
      keys.add(full);
      walk(child, `${full}.`);
    }
  };
  for (const file of readdirSync(localeDir).filter((name) => name.endsWith(".json"))) {
    walk(JSON.parse(readFileSync(path.join(localeDir, file), "utf8")), "");
  }
  return keys;
}

function categoryOf(prop: string): "colors" | "shadows" | "textStyles" {
  if (prop === "boxShadow" || prop === "shadow") return "shadows";
  if (prop === "textStyle") return "textStyles";
  return "colors";
}

function knownTokens(category: "colors" | "shadows" | "textStyles"): Set<string> {
  if (category === "textStyles") {
    const config = (system as unknown as { _config: { theme?: { textStyles?: object } } })._config;
    return new Set(Object.keys(config.theme?.textStyles ?? {}));
  }
  return new Set(system.tokens.categoryMap.get(category)?.keys() ?? []);
}

describe("design token contract", () => {
  it("gives every semantic token a light and a dark value", () => {
    expect(semanticLeaves.length).toBeGreaterThan(0);
    const missingDark = semanticLeaves
      .filter(({ value }) => {
        if (!value || typeof value !== "object") return true;
        const pair = value as Record<string, unknown>;
        return typeof pair.base !== "string" || typeof pair._dark !== "string";
      })
      .map(({ path: tokenPath }) => tokenPath);

    expect(missingDark).toEqual([]);
  });

  it("only lets the allow-listed tokens share one value across modes", () => {
    const identical = semanticLeaves
      .filter(({ value }) => {
        const pair = value as { base?: unknown; _dark?: unknown };
        return pair.base === pair._dark;
      })
      .map(({ path: tokenPath }) => tokenPath);

    expect(identical.sort()).toEqual([...SAME_IN_BOTH_MODES].sort());
  });

  it("keeps every theme value out of the yellow/orange/amber range", () => {
    const offenders: string[] = [];
    const values = [
      ...collectLeaves(colors, "colors.", []),
      ...collectLeaves(shadows, "shadows.", []),
      ...semanticLeaves,
    ];
    for (const { path: tokenPath, value } of values) {
      for (const text of rawStrings(value)) {
        if (WARM_PALETTE_REF.test(text) || WARM_NAMED_COLOR.test(text)) {
          offenders.push(`${tokenPath}: ${text}`);
        }
        for (const { literal, r, g, b } of literalColors(text)) {
          if (isWarm(r, g, b)) offenders.push(`${tokenPath}: ${literal}`);
        }
      }
    }
    // Recipes hand-write CSS (shadows, palette names) outside the token tree.
    const recipes = { badgeRecipe, buttonRecipe, fieldBase, inputRecipe, textareaRecipe };
    for (const [name, recipe] of Object.entries(recipes)) {
      for (const text of rawStrings(recipe)) {
        if (WARM_PALETTE.test(text) || WARM_NAMED_COLOR.test(text)) {
          offenders.push(`recipes.${name}: ${text}`);
        }
        for (const { literal, r, g, b } of literalColors(text)) {
          if (isWarm(r, g, b)) offenders.push(`recipes.${name}: ${literal}`);
        }
      }
    }
    for (const palette of Object.keys(colors)) {
      if (/yellow|orange|amber/i.test(palette)) offenders.push(`colors.${palette}`);
    }

    expect(offenders).toEqual([]);
  });

  it("only references tokens the system defines (and never a warm palette)", () => {
    const known = {
      colors: knownTokens("colors"),
      shadows: knownTokens("shadows"),
      textStyles: knownTokens("textStyles"),
    };
    // A theme without these scales would make the check vacuous.
    expect(known.colors.size).toBeGreaterThan(0);
    expect(known.shadows.size).toBeGreaterThan(0);
    expect(known.textStyles.size).toBeGreaterThan(0);

    const translationKeys = i18nKeys();
    const offenders: string[] = [];
    const files = [...collectSourceFiles(SRC_ROOT), ...collectSourceFiles(THEME_ROOT)];
    // The theme package must be in scope, or the check silently shrinks to the app.
    expect(files.some((file) => file.startsWith(THEME_ROOT))).toBe(true);

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const where = path.relative(path.resolve(SRC_ROOT, "../../.."), file);

      for (const [, value] of source.matchAll(SEMANTIC_PATH)) {
        if (known.colors.has(value) || known.shadows.has(value)) continue;
        if (translationKeys.has(value)) continue;
        offenders.push(`${where}: "${value}"`);
      }

      for (const [, prop, value] of source.matchAll(TOKEN_PROP)) {
        // Raw CSS (gradients, multi-value shadows) is checked through its
        // `{colors.*}` references below; hex/rgba literals are the lint hook's job.
        if (/[\s(#]/.test(value) || CSS_KEYWORDS.has(value)) continue;
        if (value.startsWith("colorPalette.")) continue;
        const category = categoryOf(prop);
        if (!known[category].has(value) || WARM_PALETTE.test(value)) {
          offenders.push(`${where}: ${prop}="${value}"`);
        }
      }

      for (const [reference, category, token] of source.matchAll(TOKEN_REF)) {
        if (!known[category as "colors" | "shadows"].has(token) || WARM_PALETTE.test(token)) {
          offenders.push(`${where}: ${reference}`);
        }
      }

      for (const [, palette] of source.matchAll(COLOR_PALETTE_PROP)) {
        if (WARM_PALETTE.test(palette)) offenders.push(`${where}: colorPalette="${palette}"`);
      }
    }

    expect(offenders).toEqual([]);
  });
});
