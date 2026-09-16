import { Request, Response, NextFunction } from "express";
import type { ApiErrorResponse } from "@pombo/shared-types";
import { AppError, ErrorCodes } from "@shared/error";
import { i18n } from "@shared/i18n";
import { env } from "../../config";
import {
  errorReporter,
  type ErrorReportEvent,
} from "../../service/error-reporter";
import { logger } from "../logger";

// 4xx codes that are operationally interesting enough to report (as warnings)
// even though they are client errors — auth failures and rate-limit hits.
const OPERATIONAL_REPORTED_STATUS_CODES = new Set([401, 403, 429]);

function translateError(
  code: string,
  locale: string,
  fallback: string,
): string {
  const key = `errors:${code}`;
  const translated = i18n.t(key, { lng: locale });
  return translated !== key ? translated : fallback;
}

// Query strings can carry PHI (e.g. `?search=<patient-name>`). Keep only the
// path when attaching the URL to a report so no patient-identifying data
// reaches the error reporter.
function pathOnly(url: string): string {
  return url.split("?")[0] ?? url;
}

export function errorHandlerMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const isProduction = env.NODE_ENV === "production";
  const locale = req.locale || "pt-BR";
  const log = req.log || logger;

  if (err instanceof AppError) {
    const errorContext = {
      errorCode: err.code,
      statusCode: err.statusCode,
      // SEC-C7: strip the query string — it can carry PHI (`?search=<name>`)
      // and must not land in the pino log, same as the reporter below.
      url: pathOnly(req.originalUrl),
      method: req.method,
    };

    const reportMetadata = (
      event: ErrorReportEvent,
      severity: "error" | "warning",
    ) => {
      event.severity = severity;
      event.addMetadata("error", {
        errorCode: err.code,
        statusCode: String(err.statusCode),
      });
      event.addMetadata("request", {
        url: pathOnly(req.originalUrl),
        method: req.method,
      });
    };

    if (err.statusCode >= 500) {
      log.error(errorContext, err.message);
      errorReporter.notify(err, (event) => reportMetadata(event, "error"));
    } else {
      log.warn(errorContext, err.message);
      if (OPERATIONAL_REPORTED_STATUS_CODES.has(err.statusCode)) {
        errorReporter.notify(err, (event) => reportMetadata(event, "warning"));
      }
    }

    const translatedMessage = translateError(err.code, locale, err.message);

    res.status(err.statusCode).json({
      ok: false,
      error: {
        ...err.toJSON(),
        message: translatedMessage,
      },
    } satisfies ApiErrorResponse);
    return;
  }

  const errorMessage = err instanceof Error ? err.message : "Unknown error";
  // SEC-C7: query string stripped from the logged URL (PHI safety).
  log.error(
    { url: pathOnly(req.originalUrl), method: req.method, error: errorMessage },
    "Unhandled error",
  );

  if (err instanceof Error) {
    errorReporter.notify(err, (event) => {
      event.severity = "error";
      event.addMetadata("error", { errorCode: ErrorCodes.GENERIC_ERROR });
      event.addMetadata("request", {
        url: pathOnly(req.originalUrl),
        method: req.method,
      });
    });
  }

  res.status(500).json({
    ok: false,
    error: {
      message: translateError(
        ErrorCodes.GENERIC_ERROR,
        locale,
        "Internal server error",
      ),
      code: ErrorCodes.GENERIC_ERROR,
      ...(!isProduction &&
        err instanceof Error && { debug: { stack: err.stack } }),
    },
  } satisfies ApiErrorResponse);
}
