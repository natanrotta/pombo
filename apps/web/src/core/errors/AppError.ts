import type { ErrorCode } from "@pombo/shared-types";

/**
 * Domain-shaped error class for the frontend. Wraps any backend or network
 * failure with a typed `code` field that pages/hooks can branch on.
 *
 * `code` is typed as `ErrorCode | string`: the catalog is the shared wire
 * contract, and the extra `string` keeps a code newer than this bundle (or a
 * client-side one like `NETWORK_ERROR`) from breaking anything.
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
