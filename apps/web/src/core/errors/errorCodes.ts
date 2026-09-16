/**
 * Error codes the frontend explicitly branches on.
 *
 * This is NOT a mirror of the backend catalog (`apps/api/src/shared/error/
 * error-codes.ts`). The UI only needs typed constants for the codes it actively
 * switches on: the axios refresh interceptor and the validation toast.
 *
 * Add a code here only when the UI needs to make a decision based on it.
 * `AppError.code` stays typed as `string` so unknown backend codes do not
 * crash the client — they just fall through to the generic error toast.
 */
export const ErrorCodes = {
  // Transport / auth — used by the axios refresh interceptor
  AUTH_TOKEN_EXPIRED: "AUTH_TOKEN_EXPIRED",
  AUTH_TOKEN_INVALID: "AUTH_TOKEN_INVALID",
  AUTH_TOKEN_REVOKED: "AUTH_TOKEN_REVOKED",

  // Form / validation — used by useNotify to surface field-level details
  VALIDATION_ERROR: "VALIDATION_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
