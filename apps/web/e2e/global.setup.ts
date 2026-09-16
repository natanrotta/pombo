import { test as setup, expect } from "@playwright/test";
import { runPreflight } from "./fixtures/preflight";
import { apiClient } from "./fixtures/api-client";
import { CSRF_TOKEN_COOKIE, ACCESS_TOKEN_COOKIE } from "./fixtures/constants";

const AUTH_FILE = "e2e/.auth/user.json";
// Defaults to the isolated E2E web from `yarn e2e` on :3001.
const WEB_BASE_URL = process.env.E2E_WEB_URL ?? "http://localhost:3001";

const STORAGE_KEY_LANGUAGE = "@pombo-web:language";

/**
 * Authentication setup — runs once before every Playwright run and writes the
 * signed-in storage state to `e2e/.auth/user.json`, which the `chromium`
 * project reuses so every spec starts authenticated.
 *
 * Drives auth through the **API** (not the UI form) because:
 *   1. The UI sign-in races the cookie write against navigation —
 *      `storageState()` captured right after redirect occasionally landed
 *      without the session, sending every subsequent spec to /sign-in.
 *   2. The API path is atomic and lets us seed both halves of the CSRF
 *      double-submit guard (cookie + token) before tests start.
 *
 * The browser context needs three things to look authenticated:
 *   - `pombo_at` httpOnly cookie   → session JWT
 *   - `pombo_csrf` cookie          → CSRF double-submit (JS-readable)
 *   - a protected route (/devices) reachable → guards aren't blocking
 *
 * The user object is intentionally NOT seeded — the SPA's `getCurrentUser()`
 * lazily fetches /auth/me on first mount (cookie-authenticated) and rehydrates
 * the user object itself.
 */
setup("authenticate", async ({ page }) => {
  await runPreflight();

  const { token, csrfToken } = await apiClient.getSession();

  // Seed the cookies BEFORE first navigation. The session JWT rides the
  // httpOnly `pombo_at` cookie. The CSRF cookie must be JS-readable
  // (httpOnly=false) — the SPA reads it via document.cookie and echoes it in
  // `X-CSRF-Token`.
  await page.context().addCookies([
    {
      name: ACCESS_TOKEN_COOKIE,
      value: token,
      url: WEB_BASE_URL,
      httpOnly: true,
      sameSite: "Lax",
    },
    {
      name: CSRF_TOKEN_COOKIE,
      value: csrfToken,
      url: WEB_BASE_URL,
      httpOnly: false,
      sameSite: "Lax",
    },
  ]);

  await page.goto(WEB_BASE_URL);
  await page.evaluate(
    ({ languageKey }) => {
      // Pin to pt-BR so bilingual regex assertions match the documented
      // `pt|en` alternation order.
      if (!localStorage.getItem(languageKey)) {
        localStorage.setItem(languageKey, "pt-BR");
      }
    },
    { languageKey: STORAGE_KEY_LANGUAGE }
  );

  // Sanity check — hit a protected route. Catches stale seed / token-version
  // drift before it manifests as cryptic failures downstream.
  // `/devices` is a real route: a broken session redirects to /sign-in and the
  // URL assertion fails (an unknown path would render the 404 and still pass).
  await page.goto("/devices");
  await expect(page).toHaveURL(/\/devices$/, { timeout: 10000 });

  await page.context().storageState({ path: AUTH_FILE });
});
