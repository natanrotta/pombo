import { type Page, type Locator } from "@playwright/test";

/**
 * Page Object for `/sign-in` (mirrors
 * `apps/web/src/modules/auth/presentation/pages/SignInPage.tsx`).
 *
 * The route literal is hardcoded (not imported from
 * `@/app/router/RoutePaths`) — POMs never import concrete code from
 * `apps/web/src/**` (E-H6). Keep in sync with `ROUTE_PATHS.signIn` if it
 * ever changes.
 */
export class SignInPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly forgotPasswordLink: Locator;
  readonly createAccountLink: Locator;
  /** Chakra toasts have inconsistent ARIA roles (see `patterns/e2e.md` §
   *  Chakra cheat sheet) — `data-cy="toast"` is the shared primitive. */
  readonly toast: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByRole("textbox", { name: /e-?mail/i });
    // Anchored exactly: the bare `/senha|password/i` substring also matches
    // the "Mostrar senha" / "Show password" visibility-toggle icon button.
    this.passwordInput = page.getByLabel(/^(senha|password)$/i);
    this.submitButton = page.getByRole("button", { name: /^entrar$|^sign in$/i });
    this.forgotPasswordLink = page.getByRole("link", {
      name: /esqueci minha senha|forgot password/i,
    });
    this.createAccountLink = page.getByRole("link", {
      name: /crie uma conta|create an account/i,
    });
    this.toast = page.getByTestId("toast");
  }

  async goto() {
    await this.page.goto("/sign-in");
  }

  async fillCredentials(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
  }

  async submit() {
    await this.submitButton.click();
  }

  async signIn(email: string, password: string) {
    await this.fillCredentials(email, password);
    await this.submit();
  }
}
