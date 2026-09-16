import { test, expect } from "../../fixtures/auth.fixture";
import { AppShellPage } from "../../pages/shell/AppShell.page";
import { ProfilePage } from "../../pages/settings/ProfilePage.page";

test.describe("Shell Navigation", () => {
  let shell: AppShellPage;

  test.beforeEach(async ({ page }) => {
    shell = new AppShellPage(page);
    await page.goto("/devices");
  });

  test("navigates through every sidebar item and marks the active one", async ({ page }) => {
    const targets = [
      { name: /^sandbox$/i, url: /\/sandbox$/, heading: /^sandbox$/i },
      { name: /^perfil$|^profile$/i, url: /\/perfil$/, heading: /^perfil$|^profile$/i },
      { name: /^api$/i, url: /\/api$/, heading: /^api$/i },
      { name: /dispositivos|devices/i, url: /\/devices$/, heading: /dispositivos|devices/i },
    ];

    for (const target of targets) {
      await shell.clickNav(target.name);
      await expect(page).toHaveURL(target.url);
      await expect(page.getByRole("heading", { level: 1, name: target.heading })).toBeVisible();
      await expect(shell.navLink(target.name)).toHaveAttribute("aria-current", "page");
    }
  });

  test("collapses the sidebar and keeps the choice after reload", async ({ page }) => {
    expect(await shell.isSidebarCollapsed()).toBe(false);

    await shell.toggleSidebarCollapse();
    expect(await shell.isSidebarCollapsed()).toBe(true);
    await expect(shell.collapseToggle).toHaveAccessibleName(/expandir menu|expand menu/i);

    await page.reload();
    expect(await shell.isSidebarCollapsed()).toBe(true);
    await expect(shell.collapseToggle).toHaveAccessibleName(/expandir menu|expand menu/i);
  });

  test("toggles color mode from the user menu", async () => {
    const before = await shell.getColorMode();

    await shell.toggleColorMode();

    const after = await shell.getColorMode();
    expect(after).not.toBe(before);
    expect(["light", "dark"]).toContain(after);
  });

  test("signs out and returns to the sign-in page", async ({ page }) => {
    // The signed-in session is shared across the whole suite (single seed
    // account, workers: 1) — a real sign-out bumps the seed user's
    // tokenVersion server-side and kills every later spec's storageState.
    // Fulfilling the request locally lets the SPA run its full client-side
    // sign-out path (clear user, clear query cache, redirect) without ever
    // reaching the real endpoint. Mirrors the real 204 the controller sends
    // (`AuthController.signOut`).
    await page.route("**/api/auth/sign-out", (route) => route.fulfill({ status: 204 }));

    await shell.signOut();

    await expect(page).toHaveURL(/\/sign-in/, { timeout: 10000 });
    await expect(shell.userMenuTrigger).not.toBeVisible();
  });

  test.describe("Profile language switch", () => {
    let profilePage: ProfilePage;

    test.beforeEach(async ({ page }) => {
      profilePage = new ProfilePage(page);
      await profilePage.goto();
    });

    test.afterEach(async ({ page }) => {
      try {
        // The seed account's language is server-side state shared by the
        // whole suite — restore it even if the assertions above failed.
        const cleanup = new ProfilePage(page);
        await cleanup.goto();
        await cleanup.selectLanguage("pt-BR");
      } catch {
        // Best-effort cleanup — never fail the test on cleanup.
      }
    });

    test("switches the nav labels and restores pt-BR", async () => {
      await profilePage.selectLanguage("en");
      await expect(shell.navLink(/^devices$/i)).toBeVisible({ timeout: 10000 });

      await profilePage.selectLanguage("pt-BR");
      await expect(shell.navLink(/dispositivos/i)).toBeVisible({ timeout: 10000 });
    });
  });

  // ── Negative path ──────────────────────────────────────────────────────
  test("shows the 404 page for an unknown route with a back-home action", async ({ page }) => {
    await page.goto("/this-route-does-not-exist");

    await expect(shell.notFoundHeading).toBeVisible();

    await shell.notFoundBackHomeButton.click();
    await expect(page).toHaveURL(/\/devices$/, { timeout: 10000 });
  });

  test.describe("Mobile bottom nav", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("navigates via the bottom nav", async ({ page }) => {
      await shell.clickNav(/^sandbox$/i);

      await expect(page).toHaveURL(/\/sandbox$/);
      await expect(page.getByRole("heading", { level: 1, name: /^sandbox$/i })).toBeVisible();
    });
  });
});
