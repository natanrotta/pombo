import {
  EMAIL_PALETTE,
  renderEmailButton,
  renderPomboEmailLayout,
  resolveEmailLocale,
  stripHtml,
} from "./email-layout";

describe("resolveEmailLocale", () => {
  it("defaults to pt-BR when locale is omitted", () => {
    expect(resolveEmailLocale()).toBe("pt-BR");
  });

  it("returns the exact supported locale", () => {
    expect(resolveEmailLocale("en")).toBe("en");
    expect(resolveEmailLocale("es")).toBe("es");
    expect(resolveEmailLocale("pt-BR")).toBe("pt-BR");
  });

  it("matches the base language for regional tags", () => {
    expect(resolveEmailLocale("es-AR")).toBe("es");
    expect(resolveEmailLocale("en-US")).toBe("en");
  });

  it("falls back to pt-BR for unknown locales", () => {
    expect(resolveEmailLocale("de")).toBe("pt-BR");
    expect(resolveEmailLocale("xx-YY")).toBe("pt-BR");
  });
});

describe("stripHtml", () => {
  it("removes tags but keeps text", () => {
    expect(stripHtml("a <strong>b</strong> c")).toBe("a b c");
  });
});

describe("renderPomboEmailLayout", () => {
  const baseVars = {
    locale: "pt-BR" as const,
    subject: "Assunto",
    previewText: "Prévia",
    brand: "Pombo",
    brandTagline: "Pombo · Seu gateway de mensagens",
    logoUrl: "https://app.pombo.com/pombo-icon.svg",
    bodyHtml: "<p>corpo</p>",
    footerHtml: "<p>rodapé</p>",
  };

  it("returns a full HTML document with the resolved lang", () => {
    const html = renderPomboEmailLayout({ ...baseVars, locale: "en" });
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain('lang="en"');
  });

  it("renders the Pombo logo with the absolute URL and brand alt", () => {
    const html = renderPomboEmailLayout(baseVars);
    expect(html).toContain('src="https://app.pombo.com/pombo-icon.svg"');
    expect(html).toContain('alt="Pombo"');
  });

  it("injects the caller's body and footer HTML", () => {
    const html = renderPomboEmailLayout(baseVars);
    expect(html).toContain("<p>corpo</p>");
    expect(html).toContain("<p>rodapé</p>");
  });

  it("applies the Pombo emerald palette, not a slate/blue canvas", () => {
    const html = renderPomboEmailLayout(baseVars);
    expect(html).toContain(EMAIL_PALETTE.canvas);
    expect(html).not.toContain("#3b82f6");
    expect(html).not.toContain("#f5f7fb");
  });

  it("escapes the values it owns (subject, preview, logo URL)", () => {
    const html = renderPomboEmailLayout({
      ...baseVars,
      subject: "<b>x</b>",
      logoUrl: "https://app/logo.svg?a=1&b=2",
    });
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(html).toContain("https://app/logo.svg?a=1&amp;b=2");
  });
});

describe("renderEmailButton", () => {
  it("renders an emerald button with the escaped href and label", () => {
    const html = renderEmailButton("https://app/reset?a=1&b=2", "Redefinir");
    expect(html).toContain(`background-color:${EMAIL_PALETTE.brandButton}`);
    expect(html).toContain("https://app/reset?a=1&amp;b=2");
    expect(html).toContain(">Redefinir</a>");
  });

  it("escapes markup injected via the label", () => {
    const html = renderEmailButton("https://app", "<script>x</script>");
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
