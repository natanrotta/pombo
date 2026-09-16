import { test, expect } from "../../fixtures/auth.fixture";
import { SignInPage } from "../../pages/auth/SignInPage.page";
import { DEMO_USER } from "../../fixtures/constants";

/**
 * Negative paths for `/sign-in`. The happy-path UI sign-in is already
 * covered by `e2e/tests/auth.spec.ts` — this file only exercises rejection
 * states: wrong credentials, a rate-limited response, and client-side
 * validation.
 *
 * Every test starts signed out — `global.setup.ts`'s storage state is never
 * reused here (E-C2). Locale is pinned to pt-BR: a fresh, empty storage
 * state has no `@pombo-web:language` key, so without this the app falls
 * back to the runner's `navigator.language`, which would make the exact
 * mocked-message assertion below non-deterministic across machines/CI.
 */
test.describe("Sign In — negative paths", () => {
  test.use({ storageState: { cookies: [], origins: [] }, locale: "pt-BR" });

  let signInPage: SignInPage;

  test.beforeEach(async ({ page }) => {
    signInPage = new SignInPage(page);
    await signInPage.goto();
  });

  test("shows the generic error toast and stays on /sign-in for a wrong password", async () => {
    // The one real call this file makes against `/auth/sign-in` — the auth
    // surface shares one IP rate limit across every endpoint
    // (`auth-rate-limit.middleware.ts`), so real attempts stay minimal.
    await signInPage.signIn(DEMO_USER.email, "WrongPassword123!");

    // SignInPage.tsx passes `undefined` (not the real error) to `showError`
    // for any non-rate-limit failure, so wrong credentials always render the
    // generic copy — never a hint about which field was wrong.
    await expect(signInPage.toast).toContainText(
      /não foi possível autenticar|could not authenticate/i,
    );
    await expect(signInPage.page).toHaveURL(/\/sign-in/);
  });

  test("shows the API message plus the localized wait on a 429", async () => {
    // Simulated — a real 429 would mean exhausting the shared auth rate
    // limit, which every other auth spec in this suite also draws from.
    // `page.route` intercepts before the request leaves the browser, so this
    // costs nothing against the real budget.
    await signInPage.page.route("**/api/auth/sign-in", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 429,
        headers: { "Retry-After": "900" },
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: {
            message:
              "Muitas tentativas de autenticação. Tente novamente mais tarde",
            code: "AUTH_RATE_LIMIT",
          },
        }),
      });
    });

    await signInPage.signIn(DEMO_USER.email, "AnyPassword123!");

    await expect(signInPage.toast).toContainText(
      /muitas tentativas de autenticação|too many authentication attempts/i,
    );
    // `useNotify.showError` appends `notify.retryIn` when `details.retryAfter`
    // is present — 900s / 60 = 15 min (`formatRetryAfter` in `useNotify.ts`).
    await expect(signInPage.toast).toContainText(
      /aguarde 15 min\.|wait 15 min\./i,
    );
  });

  // ── Negative path ──────────────────────────────────────────
  test("rejects an empty or malformed e-mail without any request", async () => {
    let requested = false;
    await signInPage.page.route("**/api/auth/sign-in", async (route) => {
      requested = true;
      await route.continue();
    });
    // Same Zod message for both cases — buildSignInSchema reuses
    // `signIn.emailRequired` for both `.min(1)` and `.email()`.
    const emailRequiredError = signInPage.page.getByText(
      /informe seu e-?mail|please enter your email/i,
    );

    // Empty e-mail.
    await signInPage.passwordInput.fill("SomePassword123!");
    await signInPage.submit();
    await expect(emailRequiredError).toBeVisible();

    // Malformed e-mail.
    await signInPage.emailInput.fill("not-an-email");
    await signInPage.submit();
    await expect(emailRequiredError).toBeVisible();

    expect(requested).toBe(false);
  });
});
