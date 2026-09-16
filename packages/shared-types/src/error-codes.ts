/**
 * Every error code the API can put on the wire (`error.code` in the response
 * envelope). One entry per code the API actually throws or responds with.
 * The API's `error-codes.spec.ts` pins the locale parity, so adding a code
 * means adding its message to `apps/api/src/shared/i18n/locales/{pt-BR,en,es}/
 * errors.json`. The web client branches on these values, never on `message`.
 */
export const ErrorCodes = {
  // Fallback — used when an unknown/uncategorized error bubbles up.
  // Keeps the client response shape stable and gives the error reporter a
  // consistent grouping key.
  GENERIC_ERROR: "GENERIC_ERROR",

  // User
  USER_NOT_FOUND: "USER_NOT_FOUND",
  /** Sign-in / refresh on a user whose status is not ACTIVE. */
  ACCOUNT_BLOCKED: "ACCOUNT_BLOCKED",

  // Auth
  AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  AUTH_TOKEN_EXPIRED: "AUTH_TOKEN_EXPIRED",
  AUTH_TOKEN_INVALID: "AUTH_TOKEN_INVALID",
  AUTH_TOKEN_REVOKED: "AUTH_TOKEN_REVOKED",
  AUTH_NO_TOKEN: "AUTH_NO_TOKEN",
  AUTH_EMAIL_ALREADY_EXISTS: "AUTH_EMAIL_ALREADY_EXISTS",
  AUTH_GOOGLE_ONLY: "AUTH_GOOGLE_ONLY",
  AUTH_GOOGLE_TOKEN_INVALID: "AUTH_GOOGLE_TOKEN_INVALID",
  AUTH_PASSWORD_RESET_TOKEN_INVALID: "AUTH_PASSWORD_RESET_TOKEN_INVALID",
  AUTH_PASSWORD_RESET_TOKEN_EXPIRED: "AUTH_PASSWORD_RESET_TOKEN_EXPIRED",
  AUTH_PASSWORD_RESET_TOKEN_USED: "AUTH_PASSWORD_RESET_TOKEN_USED",
  /** Wrong e-mail-confirmation PIN. Intentionally vague to avoid leaking how
   *  many digits matched. */
  AUTH_EMAIL_VERIFICATION_PIN_INVALID: "AUTH_EMAIL_VERIFICATION_PIN_INVALID",
  /** PIN expired, never issued, or already consumed — the user must request
   *  a new code. */
  AUTH_EMAIL_VERIFICATION_PIN_EXPIRED: "AUTH_EMAIL_VERIFICATION_PIN_EXPIRED",
  /** Too many wrong attempts (lockout) or a resend requested inside the
   *  cooldown window. */
  AUTH_EMAIL_VERIFICATION_RATE_LIMITED: "AUTH_EMAIL_VERIFICATION_RATE_LIMITED",
  /** The e-mail was already confirmed — the FE should move on. */
  AUTH_EMAIL_ALREADY_VERIFIED: "AUTH_EMAIL_ALREADY_VERIFIED",

  // Phone
  /** Phone parts (country_code + national_number) didn't yield a valid E.164.
   *  Surfaced when the user types a number that fails region validation. */
  INVALID_PHONE: "INVALID_PHONE",

  // File
  FILE_REQUIRED: "FILE_REQUIRED",
  FILE_INVALID_TYPE: "FILE_INVALID_TYPE",
  FILE_UPLOAD_FAILED: "FILE_UPLOAD_FAILED",
  FILE_DOWNLOAD_FAILED: "FILE_DOWNLOAD_FAILED",

  // Mail
  MAIL_SEND_FAILED: "MAIL_SEND_FAILED",

  // Rate limiting (one code per shield so the FE can tell them apart)
  AUTH_RATE_LIMIT: "AUTH_RATE_LIMIT",
  /** Anonymous /api/public/* surface — coarse IP-keyed HTTP shield. The
   *  use-case layer still owns the per-resource brute-force guard. */
  PUBLIC_RATE_LIMIT: "PUBLIC_RATE_LIMIT",

  // Infrastructure
  QUEUE_NOT_FOUND: "QUEUE_NOT_FOUND",

  // WhatsApp Gateway — devices
  DEVICE_NOT_FOUND: "DEVICE_NOT_FOUND",
  /** Registration with a name another device of the account already owns. */
  DEVICE_NAME_TAKEN: "DEVICE_NAME_TAKEN",
  /** `POST /devices/:id/connect` on a device whose socket is already live. */
  DEVICE_ALREADY_CONNECTED: "DEVICE_ALREADY_CONNECTED",
  /** A read that needs a live socket (e.g. the group list) on an offline
   *  device. */
  DEVICE_OFFLINE: "DEVICE_OFFLINE",

  // WhatsApp Gateway — messaging
  MESSAGE_NOT_FOUND: "MESSAGE_NOT_FOUND",
  /** Same `Idempotency-Key` + a DIFFERENT payload. (Same key + same payload
   *  replays the original 202 and is NOT an error.) */
  IDEMPOTENCY_KEY_CONFLICT: "IDEMPOTENCY_KEY_CONFLICT",
  /** The target number is not a WhatsApp account. */
  NUMBER_NOT_ON_WHATSAPP: "NUMBER_NOT_ON_WHATSAPP",
  /** `connect` requested while the API runs with `WHATSAPP_ENABLED=false` —
   *  there is no socket to open. */
  WA_GATEWAY_DISABLED: "WA_GATEWAY_DISABLED",

  // WhatsApp Gateway — webhooks
  /** An outbound fetch (webhook delivery) targeted a non-public address —
   *  SEC-C6 guard. */
  OUTBOUND_URL_BLOCKED: "OUTBOUND_URL_BLOCKED",

  // WhatsApp Gateway — public API auth (Authorization: Bearer pmb_…)
  /** No `Authorization: Bearer` API token on a public `/api/v1` route. */
  API_TOKEN_MISSING: "API_TOKEN_MISSING",
  /** The presented API token is unknown OR revoked — the two are intentionally
   *  indistinguishable to the caller. */
  API_TOKEN_INVALID: "API_TOKEN_INVALID",

  // Transport-level (HTTP status defaults). Used by AppError subclasses and by
  // middleware that responds outside of a thrown AppError (rate-limit, 404
  // fallback).
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
  RATE_LIMIT: "RATE_LIMIT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
