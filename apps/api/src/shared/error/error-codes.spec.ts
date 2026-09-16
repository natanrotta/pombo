import { readFileSync } from "node:fs";
import path from "node:path";
import { ErrorCodes } from "./error-codes";

const LOCALES = ["pt-BR", "en", "es"] as const;

function loadErrorsLocale(
  locale: (typeof LOCALES)[number],
): Record<string, string> {
  const file = path.resolve(
    __dirname,
    "../i18n/locales",
    locale,
    "errors.json",
  );
  return JSON.parse(readFileSync(file, "utf8")) as Record<string, string>;
}

describe("ErrorCodes", () => {
  it("every value equals its key (the code IS the wire string)", () => {
    for (const [key, value] of Object.entries(ErrorCodes)) {
      expect(typeof value).toBe("string");
      expect(value).toBe(key);
    }
  });

  it("keeps the generic fallback and the transport-level defaults", () => {
    expect(ErrorCodes.GENERIC_ERROR).toBe("GENERIC_ERROR");
    expect(ErrorCodes.BAD_REQUEST).toBe("BAD_REQUEST");
    expect(ErrorCodes.UNAUTHORIZED).toBe("UNAUTHORIZED");
    expect(ErrorCodes.FORBIDDEN).toBe("FORBIDDEN");
    expect(ErrorCodes.NOT_FOUND).toBe("NOT_FOUND");
    expect(ErrorCodes.CONFLICT).toBe("CONFLICT");
    expect(ErrorCodes.VALIDATION_ERROR).toBe("VALIDATION_ERROR");
    expect(ErrorCodes.TOO_MANY_REQUESTS).toBe("TOO_MANY_REQUESTS");
    expect(ErrorCodes.RATE_LIMIT).toBe("RATE_LIMIT");
    expect(ErrorCodes.INTERNAL_ERROR).toBe("INTERNAL_ERROR");
    expect(ErrorCodes.SERVICE_UNAVAILABLE).toBe("SERVICE_UNAVAILABLE");
  });

  it("keeps the auth family", () => {
    expect(ErrorCodes.AUTH_INVALID_CREDENTIALS).toBe(
      "AUTH_INVALID_CREDENTIALS",
    );
    expect(ErrorCodes.AUTH_TOKEN_EXPIRED).toBe("AUTH_TOKEN_EXPIRED");
    expect(ErrorCodes.AUTH_TOKEN_INVALID).toBe("AUTH_TOKEN_INVALID");
    expect(ErrorCodes.AUTH_TOKEN_REVOKED).toBe("AUTH_TOKEN_REVOKED");
    expect(ErrorCodes.AUTH_NO_TOKEN).toBe("AUTH_NO_TOKEN");
    expect(ErrorCodes.AUTH_EMAIL_ALREADY_EXISTS).toBe(
      "AUTH_EMAIL_ALREADY_EXISTS",
    );
    expect(ErrorCodes.AUTH_GOOGLE_ONLY).toBe("AUTH_GOOGLE_ONLY");
    expect(ErrorCodes.AUTH_EMAIL_VERIFICATION_PIN_INVALID).toBe(
      "AUTH_EMAIL_VERIFICATION_PIN_INVALID",
    );
    expect(ErrorCodes.ACCOUNT_BLOCKED).toBe("ACCOUNT_BLOCKED");
  });

  it("keeps one code per rate-limit shield", () => {
    expect(ErrorCodes.AUTH_RATE_LIMIT).toBe("AUTH_RATE_LIMIT");
    expect(ErrorCodes.PUBLIC_RATE_LIMIT).toBe("PUBLIC_RATE_LIMIT");
    expect(ErrorCodes.RATE_LIMIT).toBe("RATE_LIMIT");
  });

  it("keeps the WhatsApp gateway families (devices, messaging, webhooks, public API)", () => {
    expect(ErrorCodes.DEVICE_NOT_FOUND).toBe("DEVICE_NOT_FOUND");
    expect(ErrorCodes.DEVICE_NAME_TAKEN).toBe("DEVICE_NAME_TAKEN");
    expect(ErrorCodes.DEVICE_ALREADY_CONNECTED).toBe(
      "DEVICE_ALREADY_CONNECTED",
    );
    expect(ErrorCodes.DEVICE_OFFLINE).toBe("DEVICE_OFFLINE");
    expect(ErrorCodes.MESSAGE_NOT_FOUND).toBe("MESSAGE_NOT_FOUND");
    expect(ErrorCodes.IDEMPOTENCY_KEY_CONFLICT).toBe(
      "IDEMPOTENCY_KEY_CONFLICT",
    );
    expect(ErrorCodes.NUMBER_NOT_ON_WHATSAPP).toBe("NUMBER_NOT_ON_WHATSAPP");
    expect(ErrorCodes.WA_GATEWAY_DISABLED).toBe("WA_GATEWAY_DISABLED");
    expect(ErrorCodes.OUTBOUND_URL_BLOCKED).toBe("OUTBOUND_URL_BLOCKED");
    expect(ErrorCodes.API_TOKEN_MISSING).toBe("API_TOKEN_MISSING");
    expect(ErrorCodes.API_TOKEN_INVALID).toBe("API_TOKEN_INVALID");
  });

  it("has exactly 48 error codes — bump this when adding one (and its 3 translations)", () => {
    expect(Object.keys(ErrorCodes)).toHaveLength(48);
  });

  describe("locale parity", () => {
    it.each(LOCALES)(
      "%s/errors.json translates every code and carries no orphan key",
      (locale) => {
        const messages = loadErrorsLocale(locale);
        const codes = Object.keys(ErrorCodes);

        const untranslated = codes.filter((code) => !messages[code]);
        const orphans = Object.keys(messages).filter(
          (key) => !(key in ErrorCodes),
        );

        expect(untranslated).toEqual([]);
        expect(orphans).toEqual([]);
      },
    );
  });
});
