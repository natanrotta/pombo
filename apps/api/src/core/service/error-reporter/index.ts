import Bugsnag, { type Event } from "@bugsnag/js";
import BugsnagPluginExpress from "@bugsnag/plugin-express";
import type { RequestHandler } from "express";
import { env } from "../../config";
import { logger } from "@core/http/logger";

/**
 * Vendor-neutral alias for the reporter event passed to `notify` callbacks.
 * Call sites annotate against this — not `@bugsnag/js` — so a future backend
 * swap stays contained to this folder.
 */
export type ErrorReportEvent = Event;

let started = false;

/**
 * Initializes Bugsnag error reporting for the API. Fail-open: no-ops when
 * BUGSNAG_API_KEY is unset so the service never crashes for lack of the
 * backend. The missing key is logged at WARN in a deployed stage
 * (production / staging) — the silent gap that left POMBO API PROD empty —
 * and at INFO in local / test / development, where no key is expected.
 */
export function initErrorReporter(): void {
  // Idempotent: a second call after a successful start is a no-op, so the
  // single-init contract holds by code, not just by the main.ts call order.
  if (started) return;

  const apiKey = env.BUGSNAG_API_KEY;

  if (!apiKey) {
    // Fail-open: a missing key disables reporting rather than crashing the app.
    // But in a DEPLOYED stage that silence is the bug that left POMBO API PROD
    // empty — the prod VPS wasn't injecting BUGSNAG_API_KEY. Surface it at WARN
    // (visible in pino / the admin status panel) for production/staging, while
    // local/dev/test stay quiet (no key there is expected).
    const deployedStage =
      env.NODE_ENV === "production" || env.NODE_ENV === "staging";
    const context = { service: "bugsnag", releaseStage: env.NODE_ENV };
    const message = "BUGSNAG_API_KEY not configured - error tracking disabled";
    if (deployedStage) {
      logger.warn(context, message);
    } else {
      logger.info(context, message);
    }
    return;
  }

  Bugsnag.start({
    apiKey,
    releaseStage: env.NODE_ENV,
    // Groups errors by build in the Bugsnag dashboard. Falls back to undefined
    // (Bugsnag omits the version) when APP_VERSION is unset — same env the
    // admin system-status panel reads, set to the git SHA by the deploy.
    appVersion: env.APP_VERSION,
    // The express plugin provides per-request context isolation via
    // AsyncLocalStorage. Only its requestHandler is mounted (see
    // expressRequestHandler + app.ts) — never its errorHandler, which would
    // double-report on top of errorHandlerMiddleware.
    plugins: [BugsnagPluginExpress],
    // Process-level capture is OFF on purpose: the SDK's own uncaughtException /
    // unhandledRejection listeners report and then `process.exit(1)` as soon as
    // the delivery lands — racing the staged teardown in core/service/lifecycle
    // (HTTP drain, WhatsApp sockets closed without logout, advisory lock
    // released). The lifecycle owns those two events: it calls
    // `errorReporter.notify` (awaited, bounded) and only then exits. Errors
    // inside HTTP requests still reach Bugsnag through errorHandlerMiddleware.
    enabledErrorTypes: {
      unhandledExceptions: false,
      unhandledRejections: false,
    },
    // PHI hardening: this API moves patient data. Bugsnag must never collect
    // the caller IP, and any header/metadata key that could carry a bearer
    // token, session cookie, or free-text patient data is redacted before the
    // payload leaves the process. Never rely on the default capture.
    collectUserIp: false,
    redactedKeys: [
      /^authorization$/i,
      /^cookie$/i,
      "password",
      // Free-text / identifying PHI keys. redactedKeys applies across event
      // metadata AND breadcrumbs, so this also covers the logger context that
      // PinoLoggerProvider spreads into breadcrumbs. Opaque structural ids
      // (patientId, accountId) are intentionally KEPT for triage/grouping —
      // the same posture as retaining the opaque user id above. Logging
      // free-text PHI into logger context remains a call-site discipline.
      "email",
      "patientName",
      "cpf",
      "phone",
      "notes",
      "transcript",
      "content",
    ],
    onError: (event: Event) => {
      // Defense-in-depth on top of redactedKeys: physically drop the auth
      // headers and the request body rather than only masking them.
      if (event.request.headers) {
        delete event.request.headers["authorization"];
        delete event.request.headers["cookie"];
      }
      delete event.request["body"];

      // Keep only the opaque user id. Dropping email prevents patient names
      // (a legitimate display name) from reaching Bugsnag.
      const user = event.getUser();
      if (user?.id) {
        event.setUser(user.id);
      }

      return true;
    },
    onBreadcrumb: (breadcrumb) => {
      // Drop liveness-probe noise so /healthz traffic doesn't bury real
      // signals (mirrors the previous beforeBreadcrumb filter).
      const url = breadcrumb.metadata["url"];
      if (typeof url === "string" && url.includes("/healthz")) {
        return false;
      }
      return true;
    },
  });

  // Flip the flag before the success log so a throwing logger can never leave
  // the reporter permanently disabled after a successful start.
  started = true;
  logger.info({ service: "bugsnag" }, "Bugsnag initialized");
}

/**
 * Vendor-neutral facade over the error reporter. Call sites depend on this
 * shape (`notify` / `leaveBreadcrumb`), not on Bugsnag directly, so swapping
 * the backend again only touches this folder. Every method no-ops until
 * `initErrorReporter` has run with a configured key.
 */
/**
 * Express middleware that scopes Bugsnag's breadcrumb/metadata context to the
 * current request (via AsyncLocalStorage), so an error report's breadcrumb
 * trail reflects only that request — not interleaved concurrent traffic. Mount
 * it as the FIRST middleware (see app.ts). Only the requestHandler is used; the
 * plugin's errorHandler is intentionally never mounted, since
 * errorHandlerMiddleware is the single reporting funnel. Returns a pass-through
 * no-op until `initErrorReporter` has run with a configured key.
 */
export function expressRequestHandler(): RequestHandler {
  const plugin = started ? Bugsnag.getPlugin("express") : undefined;
  return plugin?.requestHandler ?? ((_req, _res, next) => next());
}

export const errorReporter = {
  /**
   * Resolves once the report was delivered (or refused) — never rejects, so a
   * caller can await it on a crash path without a second failure. Resolves
   * immediately while the reporter is disabled.
   */
  notify(
    error: Error,
    onError?: (event: ErrorReportEvent) => void,
  ): Promise<void> {
    if (!started) return Promise.resolve();
    return new Promise((resolve) => {
      Bugsnag.notify(
        error,
        (event) => {
          onError?.(event);
          return true;
        },
        () => resolve(),
      );
    });
  },

  leaveBreadcrumb(message: string, metadata: Record<string, unknown>): void {
    if (!started) return;
    Bugsnag.leaveBreadcrumb(message, metadata, "log");
  },
};
