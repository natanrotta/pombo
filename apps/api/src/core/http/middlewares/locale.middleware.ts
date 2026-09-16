import { Request, Response, NextFunction } from "express";
import { DEFAULT_LOCALE } from "@shared/constant/defaults";

const SUPPORTED_LOCALES = ["en", "pt-BR", "es"];

function parseAcceptLanguage(header: string): string {
  const languages = header
    .split(",")
    .map((part) => {
      const segments = part.trim().split(";");
      const lang = segments[0]?.trim() ?? "";
      const qPart = segments[1];
      const q = qPart ? parseFloat(qPart.split("=")[1] ?? "1") : 1;
      return { lang, q };
    })
    .sort((a, b) => b.q - a.q);

  for (const { lang } of languages) {
    if (SUPPORTED_LOCALES.includes(lang)) {
      return lang;
    }
    const prefix = lang.split("-")[0];
    const match = SUPPORTED_LOCALES.find(
      (supported) => supported === prefix || supported.startsWith(`${prefix}-`),
    );
    if (match) {
      return match;
    }
  }

  return DEFAULT_LOCALE;
}

export function localeMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const acceptLanguage = req.headers["accept-language"];

  if (acceptLanguage) {
    req.locale = parseAcceptLanguage(acceptLanguage);
  } else {
    req.locale = DEFAULT_LOCALE;
  }

  next();
}
