import { test, expect } from "../../fixtures/auth.fixture";
import { ApiTokenPage } from "../../pages/account/ApiTokenPage.page";

/**
 * API token lifecycle (`/api`).
 *
 * The account has exactly one active token at a time and there is no delete
 * endpoint — regenerating IS the reset, so every test calls
 * `generateOrRegenerateToken()` / `ensureTokenExists()` first to reach a known
 * state instead of assuming the account starts empty (the seed account may
 * already carry a token from a previous run). No `afterEach` cleanup: leaving
 * a freshly generated token behind is the correct, idempotent-safe baseline
 * for the next run — there's nothing to delete it back to.
 */
test.describe("API Token", () => {
  let apiTokenPage: ApiTokenPage;

  test.beforeEach(async ({ page }) => {
    apiTokenPage = new ApiTokenPage(page);
    await apiTokenPage.goto();
  });

  test("generates a token, reveals it once with a copy action, and the summary shows its prefix", async () => {
    await apiTokenPage.generateOrRegenerateToken();

    const revealedToken = await apiTokenPage.getRevealedToken();
    expect(revealedToken).toMatch(/^pmb_/);
    await expect(apiTokenPage.revealCopyButton).toBeVisible();

    await apiTokenPage.closeReveal();

    await expect(apiTokenPage.visiblePrefix).toBeVisible();
    expect(await apiTokenPage.getVisiblePrefix()).toMatch(/^pmb_/);
  });

  test("regenerating through the confirm dialog issues a token with a different prefix", async () => {
    await apiTokenPage.ensureTokenExists();
    const previousPrefix = await apiTokenPage.getVisiblePrefix();

    await apiTokenPage.regenerateButton.click();
    await expect(apiTokenPage.confirmDialog).toBeVisible();
    // The confirm's own copy is the only place the ~60s revocation window is
    // communicated to the user — worth pinning so a copy change is caught.
    await expect(apiTokenPage.confirmDialog).toContainText(
      /60 segundos|60 seconds/i,
    );
    await apiTokenPage.confirmConfirmButton.click();

    await expect(apiTokenPage.revealModal).toBeVisible();
    const newToken = await apiTokenPage.getRevealedToken();
    expect(newToken).toMatch(/^pmb_/);
    await apiTokenPage.closeReveal();

    expect(await apiTokenPage.getVisiblePrefix()).not.toBe(previousPrefix);
  });

  test("downloads the Postman collection as a JSON file", async ({ page }) => {
    const download = await apiTokenPage.downloadCollection();

    expect(download.suggestedFilename()).toBe(
      "pombo-api.postman_collection.json",
    );
    await expect(
      page
        .getByTestId("toast")
        .filter({ hasText: /collection baixada|collection downloaded/i }),
    ).toBeVisible();
  });

  // ── Negative path ──────────────────────────────────────────────────────
  test("canceling the regenerate confirm keeps the current prefix", async () => {
    await apiTokenPage.ensureTokenExists();
    const prefixBefore = await apiTokenPage.getVisiblePrefix();

    await apiTokenPage.cancelRegenerateConfirm();

    expect(await apiTokenPage.getVisiblePrefix()).toBe(prefixBefore);
  });
});
