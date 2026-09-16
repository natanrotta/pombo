import {
  type Page,
  type Locator,
  type Download,
  expect,
} from "@playwright/test";

/**
 * Page Object for `/api` (Account module) — the public API token screen
 * (`ApiTokenTab` + `ApiUsageCard`).
 *
 * The account has at most ONE active token at a time: generating replaces it.
 * There is no delete endpoint, so this POM has no `deleteFromList`-style
 * cleanup — a token created by a spec run simply becomes the new baseline for
 * the next run (documented in `tests/account/api-token.spec.ts`).
 */
export class ApiTokenPage {
  readonly page: Page;
  readonly pageTitle: Locator;

  // Empty state (no token yet)
  readonly generateButton: Locator;

  // Summary card (token exists)
  readonly regenerateButton: Locator;
  /** The prefix value is the only `pmb_…` text visible outside the reveal
   *  modal — `InfoRow` renders no role/testid, so this is the smallest
   *  reliable static-text locator (rule 3 of the 5 selector rules). */
  readonly visiblePrefix: Locator;

  // Reveal modal (shown right after generate/regenerate)
  readonly revealModal: Locator;
  readonly revealTokenInput: Locator;
  readonly revealCopyButton: Locator;
  readonly revealCloseButton: Locator;

  // Regenerate confirmation
  readonly confirmDialog: Locator;
  readonly confirmConfirmButton: Locator;
  readonly confirmCancelButton: Locator;

  // Usage card
  readonly downloadCollectionButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageTitle = page.getByRole("heading", { level: 1, name: /^api$/i });

    this.generateButton = page.getByRole("button", {
      name: /^gerar token$|^generate token$/i,
    });
    this.regenerateButton = page.getByRole("button", {
      name: /gerar novo token|generate new token/i,
    });
    this.visiblePrefix = page.getByText(/^pmb_/);

    this.revealModal = page.getByTestId("app-modal");
    this.revealTokenInput = this.revealModal.getByLabel(
      /token de api|api token/i,
    );
    this.revealCopyButton = this.revealModal.getByRole("button", {
      name: /copiar token|copy token/i,
    });
    // `app-modal-primary` is a pre-approved shared testid (see patterns/e2e.md
    // cheat sheet) — needed here because the header's X close trigger shares
    // the exact same accessible name ("Fechar"/"Close") as this footer button.
    this.revealCloseButton = page.getByTestId("app-modal-primary");

    this.confirmDialog = page.getByRole("alertdialog");
    this.confirmConfirmButton = page.getByTestId("confirm-dialog-confirm");
    this.confirmCancelButton = page.getByTestId("confirm-dialog-cancel");

    this.downloadCollectionButton = page.getByRole("button", {
      name: /baixar collection|download collection/i,
    });
  }

  async goto() {
    await this.page.goto("/api");
  }

  /** Clicks whichever CTA is currently on screen — "Gerar token" when the
   *  account has none yet, "Gerar novo token" (via the confirm dialog) when
   *  one already exists. Leaves the reveal modal open. */
  async generateOrRegenerateToken() {
    // The card shows a loading skeleton first — wait for either CTA to
    // settle before branching, or the empty-state check below races the
    // fetch and always (wrongly) picks the "generate" path.
    await expect(this.generateButton.or(this.regenerateButton)).toBeVisible({
      timeout: 10000,
    });
    const hasToken = await this.regenerateButton.isVisible().catch(() => false);
    if (hasToken) {
      await this.regenerateButton.click();
      await expect(this.confirmDialog).toBeVisible();
      await this.confirmConfirmButton.click();
    } else {
      await this.generateButton.click();
    }
    await expect(this.revealModal).toBeVisible();
  }

  /** Convenience for tests that only need a token to exist (edit/other flows
   *  don't care about its clear value). */
  async ensureTokenExists() {
    await this.generateOrRegenerateToken();
    await this.closeReveal();
  }

  async getRevealedToken(): Promise<string> {
    return this.revealTokenInput.inputValue();
  }

  async closeReveal() {
    await this.revealCloseButton.click();
    await expect(this.revealModal).not.toBeVisible();
  }

  async getVisiblePrefix(): Promise<string> {
    return (await this.visiblePrefix.textContent()) ?? "";
  }

  async cancelRegenerateConfirm() {
    await this.regenerateButton.click();
    await expect(this.confirmDialog).toBeVisible();
    await this.confirmCancelButton.click();
    await expect(this.confirmDialog).not.toBeVisible();
  }

  async downloadCollection(): Promise<Download> {
    const [download] = await Promise.all([
      this.page.waitForEvent("download"),
      this.downloadCollectionButton.click(),
    ]);
    return download;
  }
}
