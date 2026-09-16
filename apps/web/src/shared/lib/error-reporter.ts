import Bugsnag, { type Event } from "@bugsnag/js";
import BugsnagPerformance from "@bugsnag/browser-performance";

/**
 * Vendor-neutral alias for the reporter event passed to `notify` callbacks.
 * Components annotate against this — not `@bugsnag/js` — so a future backend
 * swap stays contained to this file.
 */
export type ErrorReportEvent = Event;

let started = false;

/**
 * Initializes Bugsnag in the browser. No-ops when VITE_BUGSNAG_API_KEY is
 * unset so local dev and tests run without an error-tracking backend.
 */
export function initErrorReporter(): void {
  // Idempotent: a second call after a successful start is a no-op.
  if (started) return;

  const apiKey = import.meta.env.VITE_BUGSNAG_API_KEY;

  if (!apiKey) {
    // Dev-only notice. In production an absent key must be silent — never emit
    // console noise into the shipped browser bundle.
    if (import.meta.env.DEV) {
      console.info("VITE_BUGSNAG_API_KEY not configured - error tracking disabled");
    }
    return;
  }

  Bugsnag.start({
    apiKey,
    releaseStage: import.meta.env.MODE,
    // Sensitive-data hardening: anything leaving the browser toward Bugsnag
    // must be explicitly scrubbed — never rely on the default PII capture.
    collectUserIp: false,
    // redactedKeys applies across event metadata AND breadcrumbs. Redact
    // credentials and identifying fields; opaque structural ids are kept for
    // triage (same posture as retaining the opaque user id).
    redactedKeys: [
      /^authorization$/i,
      /^cookie$/i,
      "password",
      "token",
      "secret",
      "apiKey",
      "email",
      "phone",
    ],
    onError: (event: Event) => {
      // Defense-in-depth on top of redactedKeys: physically drop auth headers.
      if (event.request.headers) {
        delete event.request.headers["Authorization"];
        delete event.request.headers["Cookie"];
      }

      // Keep only the opaque user id. Dropping email/name prevents
      // identifying user data from reaching Bugsnag.
      const user = event.getUser();
      if (user?.id) {
        event.setUser(user.id);
      }

      // Query strings can carry sensitive data via search boxes or filter
      // params (e.g. `?search=<user-input>`). Strip them while keeping the
      // pathname so issues remain groupable by route.
      if (typeof event.request.url === "string") {
        event.request.url = stripQueryString(event.request.url);
      }

      // Network breadcrumbs record each outbound call with its full URL,
      // which may include query params — same risk, same treatment. This
      // onError pass is defense-in-depth; onBreadcrumb below is the primary
      // line and strips at capture time.
      for (const breadcrumb of event.breadcrumbs) {
        const url = breadcrumb.metadata["url"];
        if (typeof url === "string") {
          breadcrumb.metadata["url"] = stripQueryString(url);
        }
      }

      return true;
    },
    onBreadcrumb: (breadcrumb) => {
      // Strip sensitive query strings when the breadcrumb is recorded, not
      // only when an event is sent — so a `?search=<user-input>` URL never
      // lingers unscrubbed in Bugsnag's in-memory breadcrumb buffer.
      const url = breadcrumb.metadata["url"];
      if (typeof url === "string") {
        breadcrumb.metadata["url"] = stripQueryString(url);
      }
      return true;
    },
  });

  // Performance monitoring (Core Web Vitals, full page loads, route changes,
  // resource/network spans). Same project apiKey as error reporting. Network
  // spans capture request URLs, so strip query strings the same way the error
  // path does — a `?search=<user-input>` must never be recorded.
  BugsnagPerformance.start({
    apiKey,
    releaseStage: import.meta.env.MODE,
    networkRequestCallback: (requestInfo) => {
      if (typeof requestInfo.url === "string") {
        requestInfo.url = stripQueryString(requestInfo.url);
      }
      return requestInfo;
    },
  });

  started = true;
}

/**
 * Vendor-neutral facade over the error reporter. Components depend on
 * `errorReporter.notify`, not on Bugsnag directly, so a future backend swap
 * only touches this file. No-ops until `initErrorReporter` has run.
 */
export const errorReporter = {
  notify(error: Error, onError?: (event: ErrorReportEvent) => void): void {
    if (!started) return;
    Bugsnag.notify(error, (event) => {
      onError?.(event);
      return true;
    });
  },
};

/**
 * Reports a React render crash caught by an error boundary. A tree crash is
 * unambiguously an error; Bugsnag defaults handled notifications to "warning",
 * so the severity is set explicitly for correct triage.
 */
export function reportRenderError(error: Error, componentStack?: string | null): void {
  errorReporter.notify(error, (event) => {
    event.severity = "error";
    event.addMetadata("react", { componentStack });
  });
}

function stripQueryString(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    return url.origin + url.pathname;
  } catch {
    // Relative URL or other non-parseable input — strip the query manually.
    const queryIndex = rawUrl.indexOf("?");
    return queryIndex === -1 ? rawUrl : rawUrl.slice(0, queryIndex);
  }
}
