import { type Page, type Locator, expect } from "@playwright/test";

const PIN_LENGTH = 6;

/**
 * Page Object for `/verify-email` (mirrors
 * `apps/web/src/modules/auth/presentation/pages/EmailVerificationPage.tsx`).
 *
 * The route literal is hardcoded (not imported from `@/app/router/RoutePaths`)
 * — POMs never import concrete code from `apps/web/src/**` (E-H6).
 */
export class VerifyEmailPage {
  readonly page: Page;
  readonly resendButton: Locator;
  readonly toast: Locator;

  constructor(page: Page) {
    this.page = page;
    this.resendButton = page.getByRole("button", { name: /reenviar|resend/i });
    this.toast = page.getByTestId("toast");
  }

  async goto() {
    await this.page.goto("/verify-email");
  }

  /**
   * Each PIN box is a Zag.js `pin-input` digit — the library stamps a fixed,
   * non-i18n `aria-label` ("pin code N of 6") regardless of the app's active
   * locale (verified in `@zag-js/pin-input`'s `connect.mjs`). It is still a
   * real accessible name, so `getByRole("textbox")` stays semantic (rule #1)
   * instead of reaching for the `data-part="input"` CSS attribute selector
   * the component's own Vitest suite uses.
   */
  pinDigit(index: number): Locator {
    return this.page.getByRole("textbox", {
      name: new RegExp(`pin code ${index + 1} of ${PIN_LENGTH}`, "i"),
    });
  }

  /**
   * Types the code digit by digit. The page submits on its own once the last
   * digit lands (`onValueComplete`) and clears the boxes on an error, so there
   * is no separate click on "Confirmar" — it would hit a disabled button.
   */
  async verifyPin(code: string) {
    for (let i = 0; i < code.length; i++) {
      await this.pinDigit(i).fill(code[i]!);
    }
  }

  async expectSubtitleContains(email: string) {
    await expect(this.page.getByText(email)).toBeVisible();
  }

  async expectPinCleared() {
    for (let i = 0; i < PIN_LENGTH; i++) {
      await expect(this.pinDigit(i)).toHaveValue("");
    }
  }
}
