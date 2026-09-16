import type { ErrorCode } from "./errorCodes";

/**
 * Domain-shaped error class for the frontend. Wraps any backend or network
 * failure with a typed `code` field that pages/hooks can branch on.
 *
 * `code` is typed as `ErrorCode | string` because the backend emits many more
 * codes than the frontend catalogs — the frontend only tracks the ones it
 * branches on. Unknown codes still flow through; they just don't
 * auto-complete in `===` checks.
 */
export class AppError extends Error {
  public readonly code: ErrorCode | string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    message: string,
    code: ErrorCode | string = "UNKNOWN_ERROR",
    statusCode = 500,
    details?: unknown
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}
