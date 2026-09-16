import { type Page, type Locator } from "@playwright/test";

export interface RegisterFormData {
  name: string;
  email: string;
  password: string;
}

/**
 * Page Object for `/register` (mirrors
 * `apps/web/src/modules/auth/presentation/pages/RegisterPage.tsx`).
 *
 * The route literal is hardcoded (not imported from `@/app/router/RoutePaths`)
 * — POMs never import concrete code from `apps/web/src/**` (E-H6).
 */
export class RegisterPage {
  readonly page: Page;
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly signInLink: Locator;
  readonly toast: Locator;

  constructor(page: Page) {
    this.page = page;
    this.nameInput = page.getByRole("textbox", { name: /seu nome|your name/i });
    this.emailInput = page.getByRole("textbox", { name: /e-?mail/i });
    // Anchored exactly — the bare substring also matches the "Mostrar senha" /
    // "Show password" visibility-toggle icon button.
    this.passwordInput = page.getByLabel(/^(senha|password)$/i);
    this.submitButton = page.getByRole("button", {
      name: /^criar conta$|^create account$/i,
    });
    this.signInLink = page.getByRole("link", { name: /faça login|sign in/i });
    this.toast = page.getByTestId("toast");
  }

  async goto() {
    await this.page.goto("/register");
  }

  async fillForm(data: RegisterFormData) {
    await this.nameInput.fill(data.name);
    await this.emailInput.fill(data.email);
    await this.passwordInput.fill(data.password);
  }

  async submit() {
    await this.submitButton.click();
  }

  async register(data: RegisterFormData) {
    await this.fillForm(data);
    await this.submit();
  }
}
