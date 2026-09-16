/**
 * Renders the HTML + plain-text bodies for the e-mail-confirmation PIN
 * e-mail. Locale-aware (pt-BR / en / es) and built on the shared Pombo e-mail
 * layout, mirroring the password-reset template. The 6-digit PIN is shown
 * prominently — there is no link to click; the user types the code back into
 * the app.
 *
 * Locale comes from `user.language` (the row is already loaded to issue the
 * PIN, so the preference is available).
 */

import { escapeHtml } from "@shared/util/html";
import {
  EMAIL_PALETTE,
  type EmailLocale,
  renderPomboEmailLayout,
  resolveEmailLocale,
  stripHtml,
} from "@shared/util/email/email-layout";

export type EmailVerificationPinLocale = EmailLocale;

export interface EmailVerificationPinVars {
  userName: string;
  /** The plaintext 6-digit code. Never logged — only rendered into the mail. */
  pin: string;
  /** PIN TTL in minutes — surfaced in the copy so users know the window. */
  ttlMinutes: number;
  /** Absolute URL to the Pombo logo (e.g. `${FRONTEND_URL}/pombo-icon.svg`).
   *  Must be absolute — e-mail clients can't resolve app-relative paths. */
  logoUrl: string;
  /** Defaults to pt-BR when omitted or unknown. */
  locale?: string;
}

export interface EmailVerificationPinBodies {
  subject: string;
  html: string;
  text: string;
}

interface CopyBundle {
  subject: string;
  preheader: string;
  brand: string;
  brandTagline: string;
  headline: (name: string) => string;
  bodyIntro: string;
  codeLabel: string;
  expiryHint: (ttlMinutes: number) => string;
  ignore: string;
}

const COPY: Record<EmailVerificationPinLocale, CopyBundle> = {
  "pt-BR": {
    subject: "Seu código de confirmação — Pombo",
    preheader: "Confirme seu e-mail para continuar na Pombo.",
    brand: "Pombo",
    brandTagline: "Pombo · Seu gateway de mensagens",
    headline: (name) => `Olá, ${name}`,
    bodyIntro:
      "Use o código abaixo para confirmar seu e-mail e continuar criando sua conta.",
    codeLabel: "Seu código de confirmação",
    expiryHint: (ttl) =>
      `O código expira em <strong style="color:${EMAIL_PALETTE.textStrong};">${ttl} minutos</strong>.`,
    ignore:
      "Se você não criou uma conta na Pombo, pode ignorar este e-mail com segurança.",
  },
  en: {
    subject: "Your confirmation code — Pombo",
    preheader: "Confirm your email to continue on Pombo.",
    brand: "Pombo",
    brandTagline: "Pombo · Your messaging gateway",
    headline: (name) => `Hi ${name},`,
    bodyIntro:
      "Use the code below to confirm your email and finish creating your account.",
    codeLabel: "Your confirmation code",
    expiryHint: (ttl) =>
      `The code expires in <strong style="color:${EMAIL_PALETTE.textStrong};">${ttl} minutes</strong>.`,
    ignore:
      "If you didn't create a Pombo account, you can safely ignore this email.",
  },
  es: {
    subject: "Tu código de confirmación — Pombo",
    preheader: "Confirma tu correo para continuar en Pombo.",
    brand: "Pombo",
    brandTagline: "Pombo · Tu gateway de mensajería",
    headline: (name) => `Hola, ${name}`,
    bodyIntro:
      "Usa el código de abajo para confirmar tu correo y terminar de crear tu cuenta.",
    codeLabel: "Tu código de confirmación",
    expiryHint: (ttl) =>
      `El código expira en <strong style="color:${EMAIL_PALETTE.textStrong};">${ttl} minutos</strong>.`,
    ignore:
      "Si no creaste una cuenta en Pombo, puedes ignorar este correo con seguridad.",
  },
};

export function renderEmailVerificationPinEmail(
  vars: EmailVerificationPinVars,
): EmailVerificationPinBodies {
  const locale = resolveEmailLocale(vars.locale);
  const copy = COPY[locale];
  const p = EMAIL_PALETTE;

  // Escape defensively even though the PIN is digits-only.
  const pinSafe = escapeHtml(vars.pin);

  const subject = copy.subject;

  // Card body: headline → intro → emerald-tinted code box → expiry hint.
  const bodyHtml = `<h1 style="margin:0;font-size:22px;line-height:1.35;font-weight:600;color:${p.textStrong};letter-spacing:-0.015em;">
                  ${escapeHtml(copy.headline(vars.userName))}
                </h1>
                <p style="margin:16px 0 0 0;font-size:15px;line-height:1.6;color:${p.textBody};">
                  ${escapeHtml(copy.bodyIntro)}
                </p>
                <p style="margin:28px 0 8px 0;font-size:12px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${p.textFaint};">
                  ${escapeHtml(copy.codeLabel)}
                </p>
                <div style="display:inline-block;padding:16px 28px;border-radius:12px;background-color:${p.codeBg};border:1px solid ${p.codeBorder};font-size:34px;font-weight:700;letter-spacing:0.35em;color:${p.codeText};font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;">
                  ${pinSafe}
                </div>
                <p style="margin:16px 0 0 0;font-size:13px;line-height:1.5;color:${p.textSecondary};">
                  <!-- Controlled HTML (the <strong> in copy.expiryHint); no user input — do not escape -->
                  ${copy.expiryHint(vars.ttlMinutes)}
                </p>`;

  const footerHtml = `<p style="margin:0;font-size:12px;line-height:1.5;color:${p.textMuted};">
                  ${escapeHtml(copy.ignore)}
                </p>`;

  const html = renderPomboEmailLayout({
    locale,
    subject,
    previewText: copy.preheader,
    brand: copy.brand,
    brandTagline: copy.brandTagline,
    logoUrl: vars.logoUrl,
    bodyHtml,
    footerHtml,
  });

  const text = [
    stripHtml(copy.headline(vars.userName)),
    "",
    copy.bodyIntro,
    "",
    `${copy.codeLabel}: ${vars.pin}`,
    stripHtml(copy.expiryHint(vars.ttlMinutes)),
    "",
    copy.ignore,
    "",
    `— ${copy.brand}`,
  ].join("\n");

  return { subject, html, text };
}
