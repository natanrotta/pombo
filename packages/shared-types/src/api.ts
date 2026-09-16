// ------------------------------------------------------------------
// Response envelope — every JSON body the API writes (except 204s and the
// `/api/health` probe) is one of these two shapes. The web client unwraps
// `data` in its response interceptor and turns `error` into an `AppError`.
// ------------------------------------------------------------------

import type { ErrorCode } from "./error-codes.js";

/** `{ ok: true, data }` — the success envelope. */
export interface ApiSuccessResponse<T> {
  ok: true;
  data: T;
}

/** `error.details` of a `VALIDATION_ERROR` (422): Zod's `.flatten()` output. */
export interface ValidationErrorDetails {
  formErrors: string[];
  fieldErrors: Record<string, string[] | undefined>;
}

export interface ApiErrorBody {
  /** Already translated for the request's `Accept-Language`. Display only —
   *  branch on `code`. */
  message: string;
  /** The stable contract. Typed as `string` too so a code newer than the
   *  client never breaks the parse. */
  code: ErrorCode | (string & {});
  details?: unknown;
  /** Non-production only. */
  debug?: { stack?: string };
}

/** `{ ok: false, error }` — the error envelope. */
export interface ApiErrorResponse {
  ok: false;
  error: ApiErrorBody;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
