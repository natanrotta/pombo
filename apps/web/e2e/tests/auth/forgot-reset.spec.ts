import { test, expect } from "../../fixtures/auth.fixture";
import { ForgotPasswordPage } from "../../pages/auth/ForgotPasswordPage.page";
import { ResetPasswordPage } from "../../pages/auth/ResetPasswordPage.page";

/**
 * `/forgot-password` → `/reset-password` flow.
 *
 * Every test starts signed out (E-C2) with the locale pinned to pt-BR — a
 * fresh, empty storage state has no `@pombo-web:language` key, so without
 * this the app falls back to the runner's `navigator.language`.
 *
 * `RequestPasswordResetUseCase` (apps/api) always answers success, even for
 * an unknown e-mail — that's the account-enumeration guard, not a mock. It
 * also skips the mail provider entirely for an unknown address (the use case
 * returns before calling `IMailProvider`), so the "valid-looking e-mail"
 * test below is safe to run against the real API without an SMTP/Resend
 * dependency — it deliberately uses an address that does not exist.
 */
function uniqueEmail(prefix: string): string {
  return `e2e+${prefix}-${Date.now()}@example.com`;
}

test.describe("Forgot / Reset Password", () => {
  test.use({ storageState: { cookies: [], origins: [] }, locale: "pt-BR" });

  test("shows the sent banner for a valid-looking e-mail", async ({
    page,
  }) => {
    const forgotPasswordPage = new ForgotPasswordPage(page);
    await forgotPasswordPage.goto();

    const email = uniqueEmail("ghost");
    // Real call — safe: this address doesn't exist, so the use case never
    // reaches the mail provider (see file header).
    await forgotPasswordPage.requestReset(email);

    await forgotPasswordPage.expectSentBannerFor(email);
  });

  test("rejects a malformed e-mail without any request", async ({ page }) => {
    const forgotPasswordPage = new ForgotPasswordPage(page);
    await forgotPasswordPage.goto();

    let requested = false;
    await page.route("**/api/auth/password/request-reset", async (route) => {
      requested = true;
      await route.continue();
    });

    await forgotPasswordPage.requestReset("not-an-email");

    await expect(
      page.getByText(/informe seu e-?mail|please enter your email/i),
    ).toBeVisible();
    expect(requested).toBe(false);
  });

  test("shows the request-new-link state without a token and links to /forgot-password", async ({
    page,
  }) => {
    const resetPasswordPage = new ResetPasswordPage(page);
    await resetPasswordPage.goto();

    await expect(resetPasswordPage.missingTokenText).toBeVisible();
    await resetPasswordPage.requestNewLinkLink.click();

    await expect(page).toHaveURL(/\/forgot-password/);
  });

  test("rejects a weak password and a mismatched confirmation", async ({
    page,
  }) => {
    const resetPasswordPage = new ResetPasswordPage(page);
    // Any non-empty token satisfies the client-only branch — client
    // validation never reaches the network.
    await resetPasswordPage.goto("client-validation-token");

    let requested = false;
    await page.route("**/api/auth/password/reset", async (route) => {
      requested = true;
      await route.continue();
    });

    // Weak — same value in both fields so only the strength error fires
    // (never a mismatch, which would confuse which rule tripped).
    await resetPasswordPage.resetPassword("weakpass", "weakpass");
    await expect(
      page.getByText(
        /a senha não atende todos os requisitos|the password doesn't meet all requirements/i,
      ),
    ).toBeVisible();

    // Strong but mismatched.
    await resetPasswordPage.resetPassword("StrongPass123!", "Different123!");
    await expect(
      page.getByText(/as senhas não coincidem|passwords don't match/i),
    ).toBeVisible();

    expect(requested).toBe(false);
  });

  test("a mocked successful reset navigates to /sign-in with the success toast", async ({
    page,
  }) => {
    const resetPasswordPage = new ResetPasswordPage(page);
    // Mocked — a real success would need a genuine token minted via a live
    // e-mail, which the e2e stack cannot read back.
    await page.route("**/api/auth/password/reset", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, data: null }),
      });
    });

    await resetPasswordPage.goto("mock-token-does-not-matter");
    await resetPasswordPage.resetPassword("StrongPass123!", "StrongPass123!");

    await expect(resetPasswordPage.toast).toContainText(
      /senha redefinida com sucesso|password reset successfully/i,
    );
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 15000 });
  });

  // ── Negative path ──────────────────────────────────────────
  test("shows the API error toast for an invalid token", async ({ page }) => {
    const resetPasswordPage = new ResetPasswordPage(page);
    // Real call — a token that was never issued always fails, so this is
    // safe against the live API without burning a real reset flow.
    await resetPasswordPage.goto("definitely-invalid-token-xyz");
    await resetPasswordPage.resetPassword("StrongPass123!", "StrongPass123!");

    await expect(resetPasswordPage.toast).toContainText(
      /link inválido|invalid password reset link/i,
    );
    await expect(page).toHaveURL(/\/reset-password/);
  });
});
