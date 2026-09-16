import pino from "pino";
import pinoHttp from "pino-http";
import crypto from "node:crypto";
import { env } from "../config";

// PHI/secret redaction. Pino redacts each path to "[REDACTED]" before
// serializing the log record. Two log shapes carry request data and BOTH must
// be covered, because pino's fast-redact matches exact path strings:
//   - the pino-http built-in serializer keys: `req.*` / `res.*`
//   - the `customProps` block below, which mirrors the request under `request.*`
//     on a 4xx/5xx. Without the `request.*` mirror, every failed request logged
//     the Authorization header, cookies, the CSRF token, and clinical PHI in
//     plaintext (the original SEC-C7 leak this list closes).
//
// Single source of truth: the sensitive field names live here once and the
// concrete redact paths are generated for every prefix, so a field can never be
// covered under `req.*` but missed under `request.*`.

// Headers carrying credentials/session material. Node lower-cases header keys.
const SENSITIVE_HEADERS = [
  "authorization",
  "cookie",
  "x-api-key",
  "x-csrf-token",
];

// Body fields carrying secrets (auth/OAuth), identity (e-mail), or free-form
// user content (message text). Adding a new field of any of those kinds to a
// payload requires adding it here (SEC-M2). Defense in depth — the rule is
// still "never put PII in a log line" (R5), the redact list is the net.
const SENSITIVE_BODY_FIELDS = [
  "password",
  "email",
  "token",
  "refreshToken",
  "credential",
  "access_token",
  "accessToken",
  "otp",
  "message",
  "text",
  "notes",
  "transcript",
  "transcriptChunk",
  "transcription",
  "summary",
  "fieldValues",
  "contextData",
];

// A header key with non-word chars (e.g. x-csrf-token) needs bracket notation;
// a simple key (authorization) can use dot notation.
function headerPath(prefix: string, key: string): string {
  return /^[a-z0-9_]+$/i.test(key) ? `${prefix}.${key}` : `${prefix}["${key}"]`;
}

function buildHeaderPaths(prefix: string): string[] {
  return SENSITIVE_HEADERS.map((h) => headerPath(prefix, h));
}

function buildBodyPaths(prefix: string): string[] {
  return SENSITIVE_BODY_FIELDS.map((f) => `${prefix}.${f}`);
}

export const redactPaths = [
  // pino-http built-in req/res shape
  ...buildHeaderPaths("req.headers"),
  ...buildBodyPaths("req.body"),
  "res.headers.authorization",
  'res.headers["set-cookie"]',
  // customProps `request.*` mirror (emitted on 4xx/5xx below)
  ...buildHeaderPaths("request.headers"),
  ...buildBodyPaths("request.body"),
];

export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV !== "production" ? { target: "pino-pretty" } : undefined,
});

// Drop the query string from a logged URL — query params can carry PHI/PII
// (e.g. ?search=<patient name>) or a token (?access_token=). Mirrors the
// error-handler's pathOnly() so logs and Bugsnag agree.
export function pathOnly(url: string | undefined): string | undefined {
  return url?.split("?")[0];
}

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) =>
    (req.headers["x-request-id"] as string) || crypto.randomUUID(),
  redact: { paths: redactPaths, censor: "[REDACTED]" },
  customLogLevel: (_req, res, err) => {
    if (err) return "error";
    if (res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  customProps(req, res) {
    if (res.statusCode >= 400) {
      const expressReq = req as unknown as Record<string, unknown>;
      return {
        request: {
          method: req.method,
          // Query string stripped (PHI/token); structured `query` intentionally
          // NOT echoed — it carries the same PHI the URL would.
          url: pathOnly(req.url),
          params: expressReq["params"],
          // headers/body are redacted via the `request.*` paths above.
          headers: req.headers,
          body: expressReq["body"],
          remoteAddress: req.socket?.remoteAddress,
        },
      };
    }
    return {};
  },
  serializers: {
    req(req) {
      return {
        method: req.method,
        url: pathOnly(req.url),
      };
    },
    res(res) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
  customSuccessMessage(req, res) {
    const method = req.method?.padEnd(7) ?? "???";
    return `${method} ${pathOnly(req.url)} → ${res.statusCode}`;
  },
  customErrorMessage(req, res) {
    const method = req.method?.padEnd(7) ?? "???";
    return `${method} ${pathOnly(req.url)} → ${res.statusCode}`;
  },
});
