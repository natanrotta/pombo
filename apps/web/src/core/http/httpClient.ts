import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { ErrorCodes, type ApiErrorResponse } from "@pombo/shared-types";
import i18n from "@/shared/i18n";
import { AppError } from "@/core/errors/AppError";
import { STORAGE_KEYS } from "@/shared/constants/storageKeys";
import { clearSessionScopedStorage } from "@/shared/utils/sessionStorageCleanup";

// Per-request opt-out from the global session-expired redirect. The silent
// `/auth/me` session probe (AuthContext boot + refreshUser) sets this flag: a
// 401 there only means "not signed in", so getCurrentUser maps it to a null
// user and the route guards own any redirect. Without it, an unauthenticated
// visitor on a PUBLIC page (/register, /forgot-password) gets bounced
// to /sign-in by clearAuthAndRedirect.
declare module "axios" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  interface AxiosRequestConfig<D = any> {
    skipSessionExpiredRedirect?: boolean;
  }
}

const CSRF_COOKIE = "pombo_csrf";

/** Double-submit CSRF cookie reader (`pombo_csrf` → `X-CSRF-Token`). */
function getCsrfToken(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
  withCredentials: true,
});

httpClient.interceptors.request.use((config) => {
  // The session JWT rides the httpOnly `pombo_at` cookie (sent automatically
  // because `withCredentials` is true) — it is never read from JS. The only
  // Bearer we still attach is the scoped `email:verify` token during signup,
  // and ONLY on its own routes, so it can't shadow the session cookie elsewhere
  // (the API reads the Bearer header before the cookie).
  if (config.url?.includes("/auth/email-verification/")) {
    const emailVerifyToken = sessionStorage.getItem(STORAGE_KEYS.emailVerifyToken);
    if (emailVerifyToken) {
      config.headers.Authorization = `Bearer ${emailVerifyToken}`;
    }
  }

  // Attach CSRF token for state-changing requests
  const csrf = getCsrfToken();
  if (csrf) {
    config.headers["X-CSRF-Token"] = csrf;
  }

  const language = localStorage.getItem(STORAGE_KEYS.language) || navigator.language || "pt-BR";
  config.headers["Accept-Language"] = language;

  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  return config;
});

let isRefreshing = false;
let failedQueue: { resolve: () => void; reject: (err: unknown) => void }[] = [];

// With cookie-based auth there is no token to hand back to queued requests —
// the refreshed `pombo_at` cookie is already on the browser, so each queued
// request just retries. Resolve on success, reject (the original error) on a
// failed refresh.
function processQueue(error: unknown) {
  for (const prom of failedQueue) {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  }
  failedQueue = [];
}

/**
 * Error codes that mean the APP's access token itself is expired/invalid — the
 * only 401s that should trigger a silent refresh (and logout on failure). A 401
 * carrying any OTHER code is a domain failure on a valid session (e.g. a wrong
 * password on a sensitive action → `INVALID_CREDENTIALS`); refreshing/logging
 * out on those is a bug — the user must stay logged in and see the error inline.
 */
const SESSION_REFRESH_CODES = new Set<string>([
  ErrorCodes.AUTH_TOKEN_EXPIRED,
  ErrorCodes.AUTH_TOKEN_INVALID,
  ErrorCodes.AUTH_TOKEN_REVOKED,
  ErrorCodes.AUTH_NO_TOKEN,
]);

let onAuthExpired: (() => void) | null = null;

export function setAuthExpiredHandler(handler: () => void) {
  onAuthExpired = handler;
}

function clearAuthAndRedirect() {
  // The session lives in the httpOnly access cookie, which the server clears on
  // sign-out / refresh failure — JS can't touch it. Here we only drop the
  // session-scoped browser data (scoped verify token, sandbox recents, ...).
  clearSessionScopedStorage();

  if (onAuthExpired) {
    onAuthExpired();
  } else {
    const isAuthRoute = window.location.pathname.includes("/sign-in");
    if (!isAuthRoute) {
      window.location.href = "/sign-in";
    }
  }
}

httpClient.interceptors.response.use(
  (response) => {
    const body = response.data;
    if (body && typeof body === "object" && "ok" in body && body.ok && "data" in body) {
      return body.data;
    }
    return body;
  },
  async (error: AxiosError) => {
    if (!axios.isAxiosError(error) || !error.response) {
      return Promise.reject(
        new AppError(i18n.t("errors.networkError", { ns: "common" }), "NETWORK_ERROR", 0)
      );
    }

    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const { status } = error.response;
    // Every API error body is the shared envelope; a proxy/CDN error page may
    // not be, hence the optional chaining on `apiError` below.
    const apiError = (error.response.data as Partial<ApiErrorResponse> | undefined)?.error;

    // Only an APP-token 401 (expired/invalid JWT) should attempt refresh/logout.
    // A domain 401 (e.g. wrong password on a sensitive action) must
    // NOT log the user out — it falls through to the generic AppError reject so
    // the caller can show the error inline.
    const isAppTokenExpiry = !apiError?.code || SESSION_REFRESH_CODES.has(apiError.code);

    if (status === 401 && !originalRequest._retry && isAppTokenExpiry) {
      // A flagged silent session probe (the `/auth/me` call in getCurrentUser)
      // must never trigger the session-expired machinery — no refresh attempt,
      // no clearAuthAndRedirect. A 401 here just means "not signed in"; the
      // caller maps the rejection to a null user and the route guards
      // (ProtectedRoute) own any redirect. This keeps unauthenticated visitors
      // on public pages (/register, /forgot-password) from being
      // bounced to /sign-in by the boot probe.
      if (originalRequest.skipSessionExpiredRedirect) {
        return Promise.reject(
          new AppError(
            apiError?.message || i18n.t("errors.sessionExpired", { ns: "common" }),
            apiError?.code || ErrorCodes.AUTH_TOKEN_EXPIRED,
            401
          )
        );
      }

      // The e-mail-verification endpoints are authenticated by a short-lived
      // scoped token (not a refresh-backed session). Their 401 codes ARE in
      // SESSION_REFRESH_CODES, so without this early return they'd hit the
      // `/auth/` branch below and wipe auth + redirect to /sign-in. Instead,
      // let the /verify-email page surface the error (and offer "back to sign
      // up") — don't clear auth, don't attempt a refresh.
      const isEmailVerification = originalRequest.url?.includes("/auth/email-verification/");
      if (isEmailVerification) {
        return Promise.reject(
          new AppError(
            apiError?.message || i18n.t("errors.sessionExpired", { ns: "common" }),
            apiError?.code || ErrorCodes.AUTH_TOKEN_EXPIRED,
            401
          )
        );
      }

      // Auth routes should not attempt refresh
      if (originalRequest.url?.includes("/auth/")) {
        clearAuthAndRedirect();
        return Promise.reject(
          new AppError(
            apiError?.message || i18n.t("errors.sessionExpired", { ns: "common" }),
            apiError?.code || ErrorCodes.AUTH_TOKEN_EXPIRED,
            401
          )
        );
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            // The refreshed cookie is already on the browser — just retry.
            resolve: () => resolve(httpClient(originalRequest)),
            reject: (err: unknown) => {
              reject(err);
            },
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Refresh token rides the httpOnly cookie; the backend sets a fresh
        // `pombo_at` cookie on success. We don't touch the token in JS —
        // replay the queued + original requests with the new cookie attached.
        await axios.post(
          `${httpClient.defaults.baseURL}/auth/refresh`,
          {},
          {
            headers: { "Content-Type": "application/json" },
            withCredentials: true,
          }
        );

        processQueue(null);

        return httpClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        clearAuthAndRedirect();
        return Promise.reject(
          new AppError(
            i18n.t("errors.sessionExpiredLogin", { ns: "common" }),
            ErrorCodes.AUTH_TOKEN_EXPIRED,
            401
          )
        );
      } finally {
        isRefreshing = false;
      }
    }

    if (status === 429) {
      const retryAfter = error.response.headers["retry-after"];
      const message = apiError?.message || i18n.t("errors.rateLimited", { ns: "common" });
      const code = apiError?.code || ErrorCodes.RATE_LIMIT;
      return Promise.reject(
        new AppError(message, code, 429, {
          retryAfter: retryAfter ? Number(retryAfter) : undefined,
        })
      );
    }

    const message = apiError?.message || i18n.t("errors.unexpectedError", { ns: "common" });
    const code = apiError?.code || "UNKNOWN_ERROR";
    const details = apiError?.details;

    return Promise.reject(new AppError(message, code, status, details));
  }
);
