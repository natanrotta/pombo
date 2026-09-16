import { type Page, type Locator } from "@playwright/test";

/**
 * Page Object for `/reset-password` (mirrors
 * `apps/web/src/modules/auth/presentation/pages/ResetPasswordPage.tsx`).
 *
 * The route literal is hardcoded (not imported from `@/app/router/RoutePaths`)
 * — POMs never import concrete code from `apps/web/src/**` (E-H6).
 */
export class ResetPasswordPage {
  readonly page: Page;
  readonly passwordInput: Locator;
  readonly confirmInput: Locator;
  readonly submitButton: Locator;
  readonly missingTokenText: Locator;
  /** `<Button asChild><RouterLink></Button>` renders an `<a>` — role "link". */
  readonly requestNewLinkLink: Locator;
  readonly backToSignInLink: Locator;
  readonly toast: Locator;

  constructor(page: Page) {
    this.page = page;
    this.passwordInput = page.getByLabel(/^(nova senha|new password)$/i);
    this.confirmInput = page.getByLabel(
      /^(confirmar senha|confirm password)$/i,
    );
    this.submitButton = page.getByRole("button", {
      name: /^redefinir senha$|^reset password$/i,
    });
    this.missingTokenText = page.getByText(
      /link inválido ou ausente|invalid or missing link/i,
    );
    this.requestNewLinkLink = page.getByRole("link", {
      name: /solicitar novo link|request a new link/i,
    });
    this.backToSignInLink = page.getByRole("link", {
      name: /voltar para o login|back to sign in/i,
    });
    this.toast = page.getByTestId("toast");
  }

  /** The e-mailed link is `/reset-password?token=…`; omit `token` to land on
   *  the missing-token state. */
  async goto(token?: string) {
    const url = token
      ? `/reset-password?token=${encodeURIComponent(token)}`
      : "/reset-password";
    await this.page.goto(url);
  }

  async fillForm(password: string, confirm: string) {
    await this.passwordInput.fill(password);
    await this.confirmInput.fill(confirm);
  }

  async submit() {
    await this.submitButton.click();
  }

  async resetPassword(password: string, confirm: string) {
    await this.fillForm(password, confirm);
    await this.submit();
  }
}
