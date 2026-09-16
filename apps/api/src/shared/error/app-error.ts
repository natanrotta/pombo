import type { ApiErrorBody } from "@pombo/shared-types";
import { ErrorCodes, type ErrorCode } from "./error-codes";

export abstract class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number,
    code: ErrorCode,
    isOperational = true,
    details?: unknown,
  ) {
    super(message);

    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  /** The `error` body of the wire envelope (the handler swaps in the
   *  translated message). */
  public toJSON(): ApiErrorBody {
    return {
      message: this.message,
      code: this.code,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

export class BadRequestError extends AppError {
  constructor(
    message = "Bad request",
    details?: unknown,
    code: ErrorCode = ErrorCodes.BAD_REQUEST,
  ) {
    super(message, 400, code, true, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(
    message = "Unauthorized",
    details?: unknown,
    code: ErrorCode = ErrorCodes.UNAUTHORIZED,
  ) {
    super(message, 401, code, true, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(
    message = "Forbidden",
    details?: unknown,
    code: ErrorCode = ErrorCodes.FORBIDDEN,
  ) {
    super(message, 403, code, true, details);
  }
}

export class PaymentRequiredError extends AppError {
  constructor(
    message = "Payment required",
    details?: unknown,
    code: ErrorCode = ErrorCodes.ACCOUNT_BLOCKED,
  ) {
    super(message, 402, code, true, details);
  }
}

export class NotFoundError extends AppError {
  constructor(
    message = "Resource not found",
    details?: unknown,
    code: ErrorCode = ErrorCodes.NOT_FOUND,
  ) {
    super(message, 404, code, true, details);
  }
}

export class ConflictError extends AppError {
  constructor(
    message = "Resource already exists",
    details?: unknown,
    code: ErrorCode = ErrorCodes.CONFLICT,
  ) {
    super(message, 409, code, true, details);
  }
}

/**
 * HTTP 410 Gone. Used by the public share endpoints (patient-document
 * shares, workplace schedule shares) when the link existed but is no
 * longer valid — expired or explicitly revoked. Distinct from 404 so the
 * frontend can render an empathic "este link expirou em X" message.
 */
export class GoneError extends AppError {
  constructor(
    message = "Resource is no longer available",
    details?: unknown,
    code: ErrorCode = ErrorCodes.NOT_FOUND,
  ) {
    super(message, 410, code, true, details);
  }
}

export class ValidationError extends AppError {
  constructor(
    message = "Validation failed",
    details?: unknown,
    code: ErrorCode = ErrorCodes.VALIDATION_ERROR,
  ) {
    super(message, 422, code, true, details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(
    message = "Too many requests",
    details?: unknown,
    code: ErrorCode = ErrorCodes.TOO_MANY_REQUESTS,
  ) {
    super(message, 429, code, true, details);
  }
}

export class InternalError extends AppError {
  constructor(
    message = "Internal server error",
    details?: unknown,
    code: ErrorCode = ErrorCodes.INTERNAL_ERROR,
  ) {
    super(message, 500, code, false, details);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(
    message = "Service unavailable",
    details?: unknown,
    code: ErrorCode = ErrorCodes.SERVICE_UNAVAILABLE,
  ) {
    super(message, 503, code, true, details);
  }
}
