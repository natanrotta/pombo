import { type Page, type BrowserContext, type Route } from "@playwright/test";
import { test, expect } from "../../fixtures/auth.fixture";
import { RegisterPage } from "../../pages/auth/RegisterPage.page";
import { VerifyEmailPage } from "../../pages/auth/VerifyEmailPage.page";

/**
 * Register → verify-email flow.
 *
 * Every test starts signed out (E-C2) with the locale pinned to pt-BR — a
 * fresh, empty storage state has no `@pombo-web:language` key, so without
 * this the app falls back to the runner's `navigator.language`.
 *
 * The "lands on /verify-email" and "wrong PIN" tests below share ONE real
 * account and page (`test.describe.serial` + a manually-created context)
 * instead of each registering their own: `EmailVerificationPage` auto-sends
 * a PIN on mount, so every fresh `/verify-email` visit after a real sign-up
 * is itself a real call against `/auth/email-verification/send`. Sharing the
 * account halves the real calls this file makes against the
 * auth-rate-limited surface (`auth-rate-limit.middleware.ts`).
 */
function uniqueEmail(prefix: string): string {
  return `e2e+${prefix}-${Date.now()}@example.com`;
}

/** Fulfills a route with a JSON-enveloped body — trims the
 *  `contentType`/`JSON.stringify` boilerplate repeated by every mock below. */
async function fulfillJson(route: Route, status: number, body: unknown) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

/** A `SessionResponseDTO.user` (`packages/shared-types/src/auth.ts`),
 *  redeclared locally rather than imported — POMs/specs never import
 *  concrete or type code from `apps/web/src/**` (E-H6). */
function mockSessionUser() {
  const now = new Date().toISOString();
  return {
    id: "e2e-mock-user-id",
    name: "Mock User",
    email: "mock-verified@example.com",
    emailVerified: true,
    avatarUrl: null,
    language: "pt-BR",
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  };
}

test.describe("Register + Verify Email", () => {
  test.describe.serial("real account walkthrough", () => {
    let context: BrowserContext;
    let page: Page;
    let registerPage: RegisterPage;
    let verifyEmailPage: VerifyEmailPage;
    const email = uniqueEmail("register");

    test.beforeAll(async ({ browser }) => {
      context = await browser.newContext({
        storageState: { cookies: [], origins: [] },
        locale: "pt-BR",
      });
      page = await context.newPage();
      registerPage = new RegisterPage(page);
      verifyEmailPage = new VerifyEmailPage(page);

      await registerPage.goto();
      // Real sign-up — the only account this file creates.
      await registerPage.register({
        name: "E2E Tester",
        email,
        password: "StrongPass123!",
      });
    });

    test.afterAll(async () => {
      await context.close();
    });

    test("lands on /verify-email with the address in the subtitle", async () => {
      await expect(page).toHaveURL(/\/verify-email/, { timeout: 15000 });
      await verifyEmailPage.expectSubtitleContains(email);
    });

    // ── Negative path ──────────────────────────────────────────
    test("a wrong PIN shows an error and clears the inputs", async () => {
      // Real call against `/auth/email-verification/verify` — any 6-digit
      // guess is wrong against a freshly-generated PIN.
      await verifyEmailPage.verifyPin("000000");

      await expect(verifyEmailPage.toast).toContainText(
        /código inválido|invalid code/i,
      );
      await verifyEmailPage.expectPinCleared();
    });
  });

  test.describe("mocked outcomes", () => {
    test.use({ storageState: { cookies: [], origins: [] }, locale: "pt-BR" });

    test("a mocked successful verify navigates into the app", async ({
      page,
    }) => {
      const verifyEmailPage = new VerifyEmailPage(page);
      // Mocked — the PIN is stored hashed server-side (SHA-256), so there is
      // no way to read back a valid code for a UI-only test.
      await page.route("**/api/auth/email-verification/send", (route) =>
        fulfillJson(route, 200, { ok: true, data: null }),
      );
      await page.route("**/api/auth/email-verification/verify", (route) =>
        fulfillJson(route, 200, {
          ok: true,
          data: {
            user: mockSessionUser(),
            token: "e2e-mock-token",
            csrfToken: "e2e-mock-csrf",
          },
        }),
      );

      // The app lands on the device list; with no real session its fetch
      // would 401 and bounce the page back to /sign-in.
      await page.route("**/api/devices", (route) =>
        fulfillJson(route, 200, { ok: true, data: [] }),
      );

      await verifyEmailPage.goto();
      await verifyEmailPage.verifyPin("123456");

      await expect(page).toHaveURL(/\/devices/, { timeout: 15000 });
      await expect(
        page.getByRole("heading", { name: /dispositivos|devices/i }),
      ).toBeVisible();
    });

    test("an already-verified answer on auto-send redirects to /sign-in", async ({
      page,
    }) => {
      const verifyEmailPage = new VerifyEmailPage(page);
      // Mocked — reproducing "already verified mid-flow" for real would mean
      // racing a second browser tab against the same account's verify window.
      await page.route("**/api/auth/email-verification/send", (route) =>
        fulfillJson(route, 400, {
          ok: false,
          error: {
            message: "Este e-mail já foi confirmado. Entre para continuar.",
            code: "AUTH_EMAIL_ALREADY_VERIFIED",
          },
        }),
      );

      await verifyEmailPage.goto();

      await expect(page).toHaveURL(/\/sign-in/, { timeout: 15000 });
      await expect(verifyEmailPage.toast).toContainText(
        /já foi confirmado|already confirmed/i,
      );
    });

    // ── Negative path ──────────────────────────────────────────
    test("rejects a weak password on registration without any request", async ({
      page,
    }) => {
      const registerPage = new RegisterPage(page);
      await registerPage.goto();

      let requested = false;
      await page.route("**/api/auth/sign-up", async (route) => {
        requested = true;
        await route.continue();
      });

      await registerPage.register({
        name: "E2E Tester",
        email: uniqueEmail("weak"),
        password: "weakpass",
      });

      await expect(
        page.getByText(
          /a senha não atende todos os requisitos|the password doesn't meet all requirements/i,
        ),
      ).toBeVisible();
      expect(requested).toBe(false);
    });
  });
});
