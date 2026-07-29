/**
 * The single Pombo transactional-e-mail standard. Every outgoing e-mail is
 * built from this one layout so the brand (logo, palette, card chrome, footer
 * tagline) never drifts between templates.
 *
 * Design language mirrors the web app's brand foundations
 * (`apps/web/src/app/theme/foundations/colors.ts`): a single emerald identity
 * (`#10b981` accent, `#059669` button, `#047857` "green text") over faintly
 * green-slate neutrals — NOT a generic slate/blue palette.
 *
 * The chrome (doctype, `<head>`, canvas, card, header with the Pombo logo, and
 * the footer band + tagline) is owned here. Each template only produces its
 * unique inner `bodyHtml` (and the small `footerHtml` note) and hands it over.
 *
 * Escaping contract: this layout escapes the values it owns (subject, preview
 * text, brand, logo URL). `bodyHtml` / `footerHtml` are treated as CONTROLLED
 * HTML — the caller is responsible for escaping any user input (name, code,
 * URL) before interpolating it into those strings, exactly as the templates do.
 */

import { escapeHtml } from "@shared/util/html";

/** The three locales every Pombo e-mail supports; defaults to pt-BR. */
export type EmailLocale = "pt-BR" | "en" | "es";

const SUPPORTED_LOCALES: readonly EmailLocale[] = ["pt-BR", "en", "es"];

/**
 * Resolves an arbitrary locale string (e.g. `es-AR`) to one of the supported
 * e-mail locales, falling back to pt-BR for anything unknown.
 */
export function resolveEmailLocale(locale?: string): EmailLocale {
  if (!locale) return "pt-BR";
  if ((SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
    return locale as EmailLocale;
  }
  const base = locale.split("-")[0];
  if (base === "en") return "en";
  if (base === "es") return "es";
  return "pt-BR";
}

/** Strips HTML tags for the plain-text alternative body. */
export function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, "");
}

/**
 * The Pombo e-mail palette — the emerald brand identity plus the green-slate
 * neutral ramp, kept in one place so both the layout and every template pull
 * the same colors. Values track the web theme's `brand`/`neutral` ramps.
 */
export const EMAIL_PALETTE = {
  canvas: "#f5f7f6", // page background (surface.subtle)
  card: "#ffffff", // card background (surface.DEFAULT)
  footerBg: "#f5f7f6", // footer band
  textStrong: "#171d1a", // headlines, brand, emphasis (neutral.900)
  textBody: "#39433d", // body copy (neutral.700)
  textSecondary: "#4a564f", // secondary copy (neutral.600)
  textMuted: "#647069", // fine print / footer (neutral.500)
  textFaint: "#8f9c96", // faint labels (neutral.400)
  border: "#d6deda", // dividers, card border (neutral.200)
  brand: "#10b981", // accent identity (brand.500)
  brandButton: "#059669", // primary button fill (brand.600)
  brandLink: "#047857", // readable "green text" for links (brand.700)
  codeBg: "#ecfdf5", // emerald tint for the code box (brand.50)
  codeBorder: "#a7f3d0", // emerald border (brand.200)
  codeText: "#065f46", // strong emerald digits (brand.800)
} as const;

export interface PomboEmailLayoutVars {
  locale: EmailLocale;
  /** Used for the document `<title>`. */
  subject: string;
  /** Hidden preheader shown by inbox clients before the body. */
  previewText: string;
  /** Brand name (e.g. "Pombo"), rendered in the header and logo alt. */
  brand: string;
  /** One-line brand tagline under the card. */
  brandTagline: string;
  /** Absolute URL to the Pombo logo (relative paths don't resolve in e-mail). */
  logoUrl: string;
  /** Controlled HTML for the card body (caller escapes user input). */
  bodyHtml: string;
  /** Controlled HTML for the footer note (caller escapes user input). */
  footerHtml: string;
}

/**
 * Wraps the caller's `bodyHtml` / `footerHtml` in the shared Pombo chrome and
 * returns the full HTML document.
 */
export function renderPomboEmailLayout(vars: PomboEmailLayoutVars): string {
  const p = EMAIL_PALETTE;
  const logoUrlSafe = escapeHtml(vars.logoUrl);
  const brandSafe = escapeHtml(vars.brand);

  return `<!doctype html>
<html lang="${vars.locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${escapeHtml(vars.subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${p.canvas};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:${p.textStrong};">
    <div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">
      ${escapeHtml(vars.previewText)}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${p.canvas};padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background-color:${p.card};border-radius:16px;box-shadow:0 1px 3px rgba(23,29,26,0.06);border:1px solid ${p.border};overflow:hidden;">
            <tr>
              <td style="padding:36px 40px 8px 40px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <img src="${logoUrlSafe}" width="40" height="40" alt="${brandSafe}" style="display:block;width:40px;height:40px;border-radius:11px;border:0;outline:none;text-decoration:none;" />
                    </td>
                    <td style="vertical-align:middle;padding-left:12px;">
                      <div style="font-size:16px;font-weight:600;color:${p.textStrong};letter-spacing:-0.01em;">${brandSafe}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 40px 36px 40px;">
                ${vars.bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:24px 40px;border-top:1px solid ${p.border};background-color:${p.footerBg};">
                ${vars.footerHtml}
              </td>
            </tr>
          </table>
          <p style="margin:24px 0 0 0;font-size:12px;color:${p.textFaint};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
            ${escapeHtml(vars.brandTagline)}
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * A bulletproof (table-based) emerald CTA button in the Pombo brand color.
 * `href` and `label` are escaped here.
 */
export function renderEmailButton(href: string, label: string): string {
  const p = EMAIL_PALETTE;
  const hrefSafe = escapeHtml(href);
  const labelSafe = escapeHtml(label);

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="border-radius:10px;background-color:${p.brandButton};">
      <a href="${hrefSafe}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:-0.005em;">${labelSafe}</a>
    </td>
  </tr>
</table>`;
}
