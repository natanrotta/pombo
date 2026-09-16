import { type Page, type Locator, expect } from "@playwright/test";

/**
 * Page Object for `/forgot-password` (mirrors
 * `apps/web/src/modules/auth/presentation/pages/ForgotPasswordPage.tsx`).
 *
 * The route literal is hardcoded (not imported from `@/app/router/RoutePaths`)
 * — POMs never import concrete code from `apps/web/src/**` (E-H6).
 */
export class ForgotPasswordPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly submitButton: Locator;
  readonly backToSignInLink: Locator;
  readonly sentHint: Locator;
  readonly toast: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByRole("textbox", { name: /e-?mail/i });
    this.submitButton = page.getByRole("button", {
      name: /enviar link|send link/i,
    });
    this.backToSignInLink = page.getByRole("link", {
      name: /voltar para o login|back to sign in/i,
    });
    // Fixed copy shown once the request succeeds — unlike the "sent to
    // <email>" banner, this hint text never varies per test.
    this.sentHint = page.getByText(
      /verifique sua caixa de entrada|check your inbox/i,
    );
    this.toast = page.getByTestId("toast");
  }

  async goto() {
    await this.page.goto("/forgot-password");
  }

  async requestReset(email: string) {
    await this.emailInput.fill(email);
    await this.submitButton.click();
  }

  async expectSentBannerFor(email: string) {
    await expect(this.page.getByText(email)).toBeVisible();
    await expect(this.sentHint).toBeVisible();
  }
}
