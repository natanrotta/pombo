import { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "@shared/error";
import {
  CSRF_TOKEN_COOKIE,
  ACCESS_TOKEN_COOKIE,
} from "../helpers/auth-cookies";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Public endpoints that ISSUE credentials. They never act on an existing
// session, so a leftover session cookie (expired JWT whose CSRF cookie is gone)
// must not lock the user out of signing in again. `/auth/refresh` is NOT here:
// it acts on the session and keeps the full double-submit.
const PUBLIC_CREDENTIAL_PATHS = new Set([
  "/api/auth/sign-up",
  "/api/auth/sign-in",
  "/api/auth/google",
  "/api/auth/password/request-reset",
  "/api/auth/password/reset",
]);

/**
 * Double-submit cookie CSRF protection.
 *
 * Runs BEFORE per-route authMiddleware, so `req.auth` is not yet populated. A
 * request counts as "authenticated" — and must carry a matching CSRF cookie +
 * `X-CSRF-Token` header — when it presents EITHER credential the API accepts:
 * an `Authorization: Bearer` header (API/admin clients) OR the httpOnly
 * `pombo_at` session cookie (the web app after the cookie migration). Failing
 * the double-submit is rejected (fail-closed). Keying on the session cookie too
 * closes the narrow gap where a `pombo_at`-authenticated POST arriving without
 * the CSRF cookie would otherwise slip through the unauthenticated branch.
 *
 * Public unsafe endpoints (sign-in, sign-up, password-reset) legitimately
 * arrive without either credential AND without the CSRF cookie, so they
 * continue to pass through.
 *
 * The credential-issuing ones (PUBLIC_CREDENTIAL_PATHS) also pass when only a
 * stale `pombo_at` is left in the browser; otherwise that cookie would lock the
 * user out of signing in again.
 *
 * If the CSRF cookie IS present on an otherwise unauthenticated request,
 * enforcement still applies — this prevents an attacker who obtained a stale
 * cookie from reusing it.
 */
export function csrfProtection(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  // The internal admin panel (`/api/admin/*`) is Bearer-token authenticated, not
  // cookie-authenticated. A browser never auto-attaches the Authorization header
  // on a forged cross-site request, so those routes are not CSRF-vulnerable —
  // and the double-submit guard (which would otherwise demand a cookie the
  // token-only admin doesn't set, and which the web app's `pombo_csrf` cookie
  // leaks into on localhost) must not apply to them.
  if (req.path.startsWith("/api/admin/")) {
    return next();
  }

  const cookieToken: string | undefined = req.cookies?.[CSRF_TOKEN_COOKIE];
  const headerToken = req.headers["x-csrf-token"] as string | undefined;

  // A credential-issuing endpoint with no CSRF cookie and no Bearer is as
  // public as a first visit, whatever stale `pombo_at` the browser still holds.
  // With a CSRF cookie present, the double-submit below still applies.
  if (
    PUBLIC_CREDENTIAL_PATHS.has(req.path) &&
    !cookieToken &&
    !req.headers.authorization
  ) {
    return next();
  }
  // Either credential the API accepts marks the request as authenticated.
  const isAuthenticated =
    Boolean(req.headers.authorization) ||
    Boolean(req.cookies?.[ACCESS_TOKEN_COOKIE]);

  // Authenticated unsafe request: require both sides of the double-submit.
  if (isAuthenticated) {
    if (!cookieToken || !headerToken || headerToken !== cookieToken) {
      throw new ForbiddenError("Invalid or missing CSRF token");
    }
    return next();
  }

  // Unauthenticated unsafe request: skip only when there is no CSRF cookie
  // at all (genuine public endpoint). Otherwise still enforce double-submit.
  if (!cookieToken) {
    return next();
  }

  if (!headerToken || headerToken !== cookieToken) {
    throw new ForbiddenError("Invalid or missing CSRF token");
  }

  next();
}
