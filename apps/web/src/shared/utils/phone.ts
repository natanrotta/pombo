import {
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/min";

import type { Phone } from "@/shared/types/phone";

/**
 * Single home for phone helpers. Two families live here on purpose:
 * - `formatPhone(Phone)` — display formatter for the structured Phone value
 *   the API returns (libphonenumber, international layout).
 * - `maskPhoneBr(string)` / `unformatPhone` / `formatPhoneDisplay` — the
 *   Brazilian input mask for phone inputs while the user types.
 */

/**
 * Pretty-format an embedded Phone value for display (table rows, detail
 * pages, badges, etc.). Falls back to the raw `e164` if libphonenumber
 * cannot parse — never throws.
 *
 * Example:
 *   formatPhone({ countryCode: "BR", nationalNumber: "11999998888", e164: "+5511999998888" })
 *   → "+55 11 99999-8888"
 */
export function formatPhone(phone: Phone | null | undefined): string {
  if (!phone) return "";
  const parsed = parsePhoneNumberFromString(
    phone.e164,
    phone.countryCode as CountryCode,
  );
  return parsed?.formatInternational() ?? phone.e164;
}

/** Unicode flag emoji from an ISO 3166-1 alpha-2 code. "BR" → 🇧🇷 */
export function countryFlag(countryCode: string): string {
  const base = 127397;
  return countryCode
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(base + c.charCodeAt(0)))
    .join("");
}

export function unformatPhone(value: string): string {
  return value.replace(/\D/g, "");
}

/** Progressive Brazilian phone mask applied while the user types. */
export function maskPhoneBr(raw: string): string {
  const digits = raw.replace(/\D/g, "");

  // Com código de país (+55)
  if (digits.length >= 12 && digits.startsWith("55")) {
    const local = digits.slice(2);
    return "+55 " + formatBrazilianLocal(local);
  }

  return formatBrazilianLocal(digits);
}

function formatBrazilianLocal(digits: string): string {
  // Mais que celular — retorna sem máscara
  if (digits.length > 11) {
    return digits;
  }

  // Celular: (XX) XXXXX-XXXX
  if (digits.length === 11) {
    return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
  }

  // Fixo: (XX) XXXX-XXXX
  if (digits.length === 10) {
    return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, "($1) $2-$3");
  }

  // Parcial — aplica máscara progressiva
  if (digits.length > 6) {
    return digits
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4,5})(\d{1,4})$/, "$1-$2");
  }

  if (digits.length > 2) {
    return digits.replace(/^(\d{2})(\d)/, "($1) $2");
  }

  return digits;
}

export function formatPhoneDisplay(raw: string): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");

  if (digits.length >= 10 && digits.length <= 13) {
    return maskPhoneBr(digits);
  }

  return raw;
}
