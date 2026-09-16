/**
 * Minimal authenticated REST client for E2E tests.
 *
 * Pombo scope: single-user auth only. This client signs in the seeded
 * demo user against the surviving API (`/auth/sign-in`, `/auth/me`) and caches
 * the session so `global.setup.ts` can seed the browser context with both
 * halves of the CSRF double-submit guard.
 *
 * Extend this file as you add modules: drop a typed helper below the
 * `apiClient` export (one HTTP call per function) and reuse `request()` for the
 * CSRF/auth plumbing.
 *
 * Auth strategy:
 *   1. Try loading a cached session from `e2e/.auth/api-session.json`. If the
 *      JWT's `exp` claim is in the future AND the token is still live, reuse it.
 *      (Avoids hammering the auth-rate-limited /sign-in endpoint.)
 *   2. Otherwise POST /auth/sign-in → session JWT + csrfToken (the server also
 *      sets the httpOnly access cookie). Single-user: no account selection step.
 *   3. Persist `{ token, csrfToken }` to disk so subsequent runs reuse it.
 *   4. Every unsafe call sends both halves of the CSRF double-submit cookie
 *      guard (Cookie: pombo_csrf=<x> + X-CSRF-Token: <x>).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { CSRF_TOKEN_COOKIE, DEMO_USER } from "./constants";

// Defaults to the isolated E2E API from `yarn e2e` (root) on :3334.
// Override with `E2E_API_URL=...` to point at staging or any other API.
const API_BASE_URL = process.env.E2E_API_URL ?? "http://localhost:3334/api";

type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string; code?: string } };

type SignInData = { user: ApiUser; token: string; csrfToken: string };

export type ApiUser = {
  id: string;
  name: string;
  email: string;
  emailVerified?: boolean;
  avatarUrl?: string;
  language?: string;
};

interface SessionState {
  token: string;
  csrfToken: string;
}

const SESSION_CACHE_PATH = process.env.E2E_API_SESSION_PATH ?? "e2e/.auth/api-session.json";

let cachedSession: SessionState | null = null;

function decodeJwtExp(token: string): number | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof decoded.exp === "number" ? decoded.exp : null;
  } catch {
    return null;
  }
}

function loadSessionFromDisk(): SessionState | null {
  if (!existsSync(SESSION_CACHE_PATH)) return null;
  try {
    const raw = JSON.parse(readFileSync(SESSION_CACHE_PATH, "utf8")) as SessionState;
    const exp = decodeJwtExp(raw.token);
    // 5-minute safety margin so we don't reuse a token that expires mid-test
    if (exp && exp > Math.floor(Date.now() / 1000) + 300) {
      return raw;
    }
  } catch {
    // Corrupt file — fall through to fresh sign-in
  }
  return null;
}

/**
 * Probes `/auth/me` to confirm the cached token is still valid against the
 * *current* database. JWTs survive a `prisma migrate reset` (the signature
 * stays valid) but the `userId` claim now points at a row that no longer
 * exists, so /auth/me returns 401 and the browser redirects to /sign-in —
 * leaving the entire setup looking like it worked but the suite breaks
 * downstream. This call is the canary that catches it before storage state
 * is saved.
 */
async function isTokenLive(token: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

function saveSessionToDisk(session: SessionState): void {
  mkdirSync(dirname(SESSION_CACHE_PATH), { recursive: true });
  writeFileSync(SESSION_CACHE_PATH, JSON.stringify(session, null, 2));
}

async function signIn(): Promise<SessionState> {
  if (cachedSession) return cachedSession;

  // Try disk cache first — survives `rm -rf node_modules`, persists across
  // Playwright runs, keeps us under the auth rate-limit budget. Invalidated
  // when the token expires (handled in load) or references a userId that no
  // longer exists (detected via /auth/me → 401).
  const fromDisk = loadSessionFromDisk();
  if (fromDisk && (await isTokenLive(fromDisk.token))) {
    cachedSession = fromDisk;
    return cachedSession;
  }

  const signInRes = await fetch(`${API_BASE_URL}/auth/sign-in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(DEMO_USER),
  });
  if (!signInRes.ok) {
    throw new Error(
      `[e2e/api-client] sign-in failed (${signInRes.status}). ` +
        `Is the API up on ${API_BASE_URL}? Is the seed account ${DEMO_USER.email} present? ` +
        `Run: cd apps/api && yarn seed`
    );
  }
  const envelope = (await signInRes.json()) as ApiEnvelope<SignInData>;
  if (!envelope.ok) {
    throw new Error(`[e2e/api-client] sign-in error: ${envelope.error.message}`);
  }

  cachedSession = { token: envelope.data.token, csrfToken: envelope.data.csrfToken };
  saveSessionToDisk(cachedSession);
  return cachedSession;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const session = await signIn();
  const isUnsafe = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.token}`,
  };
  if (isUnsafe) {
    headers["X-CSRF-Token"] = session.csrfToken;
    headers["Cookie"] = `${CSRF_TOKEN_COOKIE}=${session.csrfToken}`;
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const envelope = (await res.json()) as ApiEnvelope<T>;
  if (!envelope.ok) {
    throw new Error(`[e2e/api-client] ${method} ${path} failed: ${envelope.error.message}`);
  }
  return envelope.data;
}

export const apiClient = {
  signIn: async () => (await signIn()).token,
  /** Returns the full authenticated session (token + csrfToken). Used by
   *  `global.setup.ts` to seed the browser context with both halves of the
   *  CSRF double-submit guard so UI-driven unsafe requests pass middleware. */
  getSession: () => signIn(),
  /** The authenticated demo user (`GET /auth/me`). */
  getMe: () => request<ApiUser>("GET", "/auth/me"),
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T = void>(path: string, body?: unknown) => request<T>("DELETE", path, body),
};

// ── Domain helpers ─────────────────────────────────────────────────────────
//
// Add a typed helper here when a module ships its first spec that needs
// API-driven setup. Keep helpers thin — one HTTP call per function.

/** Mirrors `DeviceResponseDTO` (`packages/shared-types/src/devices.ts`) —
 *  redeclared locally rather than imported so this fixture file stays
 *  decoupled from the app source (same spirit as `ApiUser` above). */
export interface DeviceApiResource {
  id: string;
  name: string;
  identifier: string | null;
  status: "DISCONNECTED" | "CONNECTING" | "QR_PENDING" | "CONNECTED" | "LOGGED_OUT";
}

/** `POST /devices` 201 — the only response that ever carries the one-time
 *  `webhookSecret`. */
export interface CreatedDeviceApiResource {
  id: string;
  webhookSecret: string;
}

/** Devices module — mirrors `POST/GET/DELETE /devices` (see
 *  `apps/api/src/modules/devices/infrastructure/route/device.routes.ts`).
 *  Used for non-assertion setup/cleanup only — specs that exercise the
 *  create/delete UI flow itself drive it through the page object instead. */
export const deviceApi = {
  create: (name: string) =>
    apiClient.post<CreatedDeviceApiResource>("/devices", { name }),
  list: () => apiClient.get<DeviceApiResource[]>("/devices"),
  delete: (id: string) => apiClient.delete<void>(`/devices/${id}`),
};
