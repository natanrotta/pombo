import { renderPasswordResetEmail } from "./password-reset-email.template";

describe("renderPasswordResetEmail", () => {
  const baseVars = {
    userName: "Dra. Marina",
    resetUrl: "https://app.pombo.com/reset/TOKEN123",
    ttlMinutes: 30,
    logoUrl: "https://app.pombo.com/pombo-icon.svg",
  };

  describe("locale resolution", () => {
    it("defaults to pt-BR when locale is omitted", () => {
      const { subject } = renderPasswordResetEmail(baseVars);
      expect(subject).toBe("Redefinição de senha — Pombo");
    });

    it("renders English when locale is 'en'", () => {
      const { subject, html } = renderPasswordResetEmail({
        ...baseVars,
        locale: "en",
      });
      expect(subject).toBe("Reset your password — Pombo");
      expect(html).toContain('lang="en"');
      expect(html).toContain("Reset password");
    });

    it("renders Spanish when locale is 'es'", () => {
      const { subject, html } = renderPasswordResetEmail({
        ...baseVars,
        locale: "es",
      });
      expect(subject).toBe("Restablecer contraseña — Pombo");
      expect(html).toContain('lang="es"');
    });

    it("matches the base language for regional tags (en-US → en)", () => {
      const { subject } = renderPasswordResetEmail({
        ...baseVars,
        locale: "en-US",
      });
      expect(subject).toBe("Reset your password — Pombo");
    });

    it("falls back to pt-BR for unknown locales", () => {
      const { subject } = renderPasswordResetEmail({
        ...baseVars,
        locale: "xx-YY",
      });
      expect(subject).toBe("Redefinição de senha — Pombo");
    });
  });

  describe("content", () => {
    it("includes the user name, reset URL and TTL", () => {
      const { html } = renderPasswordResetEmail(baseVars);
      expect(html).toContain("Dra. Marina");
      expect(html).toContain("https://app.pombo.com/reset/TOKEN123");
      expect(html).toContain("30 minutos");
    });

    it("returns subject + html + text starting with a doctype", () => {
      const result = renderPasswordResetEmail(baseVars);
      expect(result).toHaveProperty("subject");
      expect(result.html).toMatch(/^<!doctype html>/);
      expect(result.text).toContain("Dra. Marina");
    });

    it("renders the Pombo logo image with the absolute URL", () => {
      const { html } = renderPasswordResetEmail(baseVars);
      expect(html).toContain('src="https://app.pombo.com/pombo-icon.svg"');
      expect(html).toContain('alt="Pombo"');
    });
  });

  describe("HTML escaping", () => {
    it("escapes special characters in the reset URL", () => {
      const { html } = renderPasswordResetEmail({
        ...baseVars,
        resetUrl: "https://app/reset?a=1&b=<2>",
      });
      expect(html).toContain("https://app/reset?a=1&amp;b=&lt;2&gt;");
    });

    it("escapes markup injected via userName", () => {
      const { html } = renderPasswordResetEmail({
        ...baseVars,
        userName: "<script>alert(1)</script>",
      });
      expect(html).not.toContain("<script>alert(1)</script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("plain-text body strips HTML tags", () => {
      const { text } = renderPasswordResetEmail(baseVars);
      expect(text).not.toContain("<strong>");
      expect(text).not.toContain("</strong>");
    });
  });
});
