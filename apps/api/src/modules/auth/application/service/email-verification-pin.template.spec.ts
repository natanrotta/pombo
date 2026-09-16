import { renderEmailVerificationPinEmail } from "./email-verification-pin.template";

describe("renderEmailVerificationPinEmail", () => {
  const baseVars = {
    userName: "João",
    pin: "482913",
    ttlMinutes: 10,
    logoUrl: "http://localhost:3000/pombo-icon.svg",
  };

  describe("locale resolution", () => {
    it("defaults to pt-BR when locale is omitted", () => {
      expect(renderEmailVerificationPinEmail(baseVars).subject).toBe(
        "Seu código de confirmação — Pombo",
      );
    });

    it("renders English when locale is 'en'", () => {
      const { subject, html } = renderEmailVerificationPinEmail({
        ...baseVars,
        locale: "en",
      });
      expect(subject).toBe("Your confirmation code — Pombo");
      expect(html).toContain('lang="en"');
    });

    it("renders Spanish when locale is 'es'", () => {
      expect(
        renderEmailVerificationPinEmail({ ...baseVars, locale: "es" }).subject,
      ).toBe("Tu código de confirmación — Pombo");
    });

    it("matches base language for regional tags (es-AR → es)", () => {
      expect(
        renderEmailVerificationPinEmail({ ...baseVars, locale: "es-AR" })
          .subject,
      ).toBe("Tu código de confirmación — Pombo");
    });

    it("falls back to pt-BR for unknown locales", () => {
      expect(
        renderEmailVerificationPinEmail({ ...baseVars, locale: "de" }).subject,
      ).toBe("Seu código de confirmação — Pombo");
    });
  });

  describe("content", () => {
    it("renders the PIN and the recipient name", () => {
      const { html } = renderEmailVerificationPinEmail(baseVars);
      expect(html).toContain("482913");
      expect(html).toContain("João");
    });

    it("surfaces the TTL in the copy", () => {
      const { html } = renderEmailVerificationPinEmail({
        ...baseVars,
        ttlMinutes: 15,
      });
      expect(html).toContain("15 minutos");
    });

    it("returns subject + html + text", () => {
      const result = renderEmailVerificationPinEmail(baseVars);
      expect(result.html).toMatch(/^<!doctype html>/);
      expect(result.text).toContain("482913");
    });

    it("renders the Pombo logo image with the absolute URL", () => {
      const { html } = renderEmailVerificationPinEmail(baseVars);
      expect(html).toContain('src="http://localhost:3000/pombo-icon.svg"');
      expect(html).toContain('alt="Pombo"');
    });
  });

  describe("HTML escaping", () => {
    it("escapes markup injected via userName", () => {
      const { html } = renderEmailVerificationPinEmail({
        ...baseVars,
        userName: '<img src=x onerror="alert(1)">',
      });
      expect(html).not.toContain("<img src=x");
      expect(html).toContain("&lt;img");
    });

    it("plain-text body strips HTML tags", () => {
      const { text } = renderEmailVerificationPinEmail(baseVars);
      expect(text).not.toContain("<strong>");
    });
  });
});
