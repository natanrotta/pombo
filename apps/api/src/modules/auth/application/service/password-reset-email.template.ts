/**
 * Renders the HTML + plain-text bodies for the password-reset e-mail.
 * Locale-aware (pt-BR / en / es) and built on the shared Pombo e-mail layout,
 * matching the e-mail-verification-PIN template.
 *
 * Locale comes from the user's `user.language` (we already loaded the
 * user record by email to issue the token, so the preference is available).
 */

import { escapeHtml } from "@shared/util/html";
import {
  EMAIL_PALETTE,
  type EmailLocale,
  renderEmailButton,
  renderPomboEmailLayout,
  resolveEmailLocale,
  stripHtml,
} from "@shared/util/email/email-layout";

export type PasswordResetEmailLocale = EmailLocale;

export interface PasswordResetEmailVars {
  userName: string;
  resetUrl: string;
  /** Token TTL in minutes — surfaced in the copy so users know the window. */
  ttlMinutes: number;
  /** Absolute URL to the Pombo logo (e.g. `${FRONTEND_URL}/pombo-icon.svg`).
   *  Must be absolute — e-mail clients can't resolve app-relative paths. */
  logoUrl: string;
  /** Defaults to pt-BR when omitted or unknown. */
  locale?: string;
}

export interface PasswordResetEmailBodies {
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
  bodyIntro: (ttlMinutes: number) => string;
  cta: string;
  fallbackHint: string;
  ignore: string;
}

const COPY: Record<PasswordResetEmailLocale, CopyBundle> = {
  "pt-BR": {
    subject: "Redefinição de senha — Pombo",
    preheader: "Crie uma nova senha para acessar sua conta na Pombo.",
    brand: "Pombo",
    brandTagline: "Pombo · Seu gateway de mensagens",
    headline: (name) => `Olá, ${name}`,
    bodyIntro: (ttl) =>
      `Recebemos uma solicitação para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha — o link expira em <strong style="color:${EMAIL_PALETTE.textStrong};">${ttl} minutos</strong> e só pode ser usado uma vez.`,
    cta: "Redefinir senha",
    fallbackHint:
      "Se o botão não funcionar, copie e cole este link no navegador:",
    ignore:
      "Se você não solicitou essa redefinição, pode ignorar este e-mail com segurança.",
  },
  en: {
    subject: "Reset your password — Pombo",
    preheader: "Create a new password to access your Pombo account.",
    brand: "Pombo",
    brandTagline: "Pombo · Your messaging gateway",
    headline: (name) => `Hi ${name},`,
    bodyIntro: (ttl) =>
      `We received a request to reset your account password. Click the button below to set a new one — the link expires in <strong style="color:${EMAIL_PALETTE.textStrong};">${ttl} minutes</strong> and can only be used once.`,
    cta: "Reset password",
    fallbackHint:
      "If the button doesn't work, copy and paste this link into your browser:",
    ignore:
      "If you didn't request this reset, you can safely ignore this email.",
  },
  es: {
    subject: "Restablecer contraseña — Pombo",
    preheader: "Crea una nueva contraseña para acceder a tu cuenta de Pombo.",
    brand: "Pombo",
    brandTagline: "Pombo · Tu gateway de mensajería",
    headline: (name) => `Hola, ${name}`,
    bodyIntro: (ttl) =>
      `Recibimos una solicitud para restablecer la contraseña de tu cuenta. Haz clic en el botón para crear una nueva — el enlace expira en <strong style="color:${EMAIL_PALETTE.textStrong};">${ttl} minutos</strong> y solo se puede usar una vez.`,
    cta: "Restablecer contraseña",
    fallbackHint:
      "Si el botón no funciona, copia y pega este enlace en el navegador:",
    ignore:
      "Si no solicitaste este restablecimiento, puedes ignorar este correo con seguridad.",
  },
};

export function renderPasswordResetEmail(
  vars: PasswordResetEmailVars,
): PasswordResetEmailBodies {
  const locale = resolveEmailLocale(vars.locale);
  const copy = COPY[locale];
  const p = EMAIL_PALETTE;

  const resetUrlSafe = escapeHtml(vars.resetUrl);

  const subject = copy.subject;

  // Card body: headline → intro → emerald CTA button → copy-paste fallback.
  const bodyHtml = `<h1 style="margin:0;font-size:22px;line-height:1.35;font-weight:600;color:${p.textStrong};letter-spacing:-0.015em;">
                  ${escapeHtml(copy.headline(vars.userName))}
                </h1>
                <p style="margin:16px 0 0 0;font-size:15px;line-height:1.6;color:${p.textBody};">
                  <!-- Controlled HTML (the <strong> in copy.bodyIntro); no user input — do not escape -->
                  ${copy.bodyIntro(vars.ttlMinutes)}
                </p>
                <div style="margin:28px 0 0 0;">
                  ${renderEmailButton(vars.resetUrl, copy.cta)}
                </div>
                <p style="margin:20px 0 0 0;font-size:12px;line-height:1.5;color:${p.textMuted};word-break:break-all;">
                  ${escapeHtml(copy.fallbackHint)}<br />
                  <a href="${resetUrlSafe}" style="color:${p.brandLink};text-decoration:none;">${resetUrlSafe}</a>
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
    stripHtml(copy.bodyIntro(vars.ttlMinutes)),
    "",
    `${copy.cta}: ${vars.resetUrl}`,
    "",
    copy.ignore,
    "",
    `— ${copy.brand}`,
  ].join("\n");

  return { subject, html, text };
}
