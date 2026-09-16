import { test, expect } from "../../fixtures/auth.fixture";
import { apiClient } from "../../fixtures/api-client";
import { uniqueName } from "../../fixtures/test-data";
import { ProfilePage } from "../../pages/settings/ProfilePage.page";

/**
 * Profile edit flows (`/perfil`): the autosaved full-name field, the
 * unsaved-changes guard, client-side avatar validation, and the
 * "change password" action. Grouped in this single file per this run's
 * per-agent file-ownership split (see the final report for the E-H4
 * trade-off this implies).
 *
 * The seed user is shared across the whole suite, so every test restores the
 * original `name`/`email` via `apiClient` in `afterAll` rather than deleting
 * anything (there's no delete for a profile).
 */

test.describe("Profile", () => {
  let profilePage: ProfilePage;
  let originalProfile: { name: string; email: string };

  test.beforeAll(async () => {
    const me = await apiClient.getMe();
    originalProfile = { name: me.name, email: me.email };
  });

  test.afterAll(async () => {
    try {
      await apiClient.put("/auth/profile", originalProfile);
    } catch {
      // Best-effort restore — never fail the suite on cleanup.
    }
  });

  test.beforeEach(async ({ page }) => {
    profilePage = new ProfilePage(page);
    await profilePage.goto();
  });

  test("persists a full-name edit through autosave and after reload", async ({
    page,
  }) => {
    const newName = uniqueName("E2E Profile");

    await profilePage.fillFullName(newName);
    await expect(
      profilePage.toast(/salvo automaticamente|saved automatically/i),
    ).toBeVisible({
      timeout: 4000,
    });

    await page.reload();
    await expect(profilePage.fullNameInput).toHaveValue(newName);
  });

  test("change password sends the reset request and confirms by e-mail", async ({
    page,
  }) => {
    await page.route("**/api/auth/password/request-reset", async (route) => {
      await route.fulfill({ json: { ok: true, data: null } });
    });

    await profilePage.requestPasswordReset();

    await expect(
      profilePage.toast(new RegExp(originalProfile.email)),
    ).toBeVisible({
      timeout: 5000,
    });
  });

  // ── Negative path ──────────────────────────────────────────────────────

  test("does not save an empty full name", async ({ page }) => {
    const validName = uniqueName("E2E Profile");
    await profilePage.fillFullName(validName);
    await expect(
      profilePage.toast(/salvo automaticamente|saved automatically/i),
    ).toBeVisible({
      timeout: 4000,
    });

    await profilePage.fillFullName("");
    await profilePage.save();

    // The client-side validator blocks both the debounce and the manual save
    // synchronously (no network round trip either way), so a reload right
    // after is deterministic — no debounce window to wait out.
    await page.reload();
    await expect(profilePage.fullNameInput).toHaveValue(validName);
  });

  test("blocks an in-flight browser-back navigation while there are unsaved changes", async ({
    page,
  }) => {
    // Build real browser history: /devices -> /perfil (on top of the
    // beforeEach's own /perfil visit), so `goBack()` has somewhere to land.
    await page.goto("/devices");
    await page.goto("/perfil");

    // Explicit + deterministic: dismiss (Cancel) the guard's window.confirm.
    page.once("dialog", (dialog) => dialog.dismiss());

    await profilePage.fillFullName(uniqueName("E2E Profile"));
    await page.goBack();

    // useUnsavedChangesGuard re-pushes the current entry on a canceled
    // confirm, so the back navigation never actually leaves /perfil.
    await expect(page).toHaveURL(/\/perfil/, { timeout: 5000 });

    // Flush the pending edit so the suite doesn't leave a dirty/unsaved page
    // behind for the next test.
    await profilePage.save();
    await expect(
      profilePage.toast(/salvo automaticamente|saved automatically/i),
    ).toBeVisible({
      timeout: 4000,
    });
  });

  test("rejects an avatar file with a disallowed type client-side", async ({
    page,
  }) => {
    let uploadCalls = 0;
    await page.route("**/api/auth/profile/avatar", async (route) => {
      uploadCalls++;
      await route.fulfill({
        status: 500,
        json: {
          ok: false,
          error: { message: "unexpected", code: "GENERIC_ERROR" },
        },
      });
    });

    await profilePage.selectAvatarFile({
      name: "avatar.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"),
    });

    await expect(
      profilePage.toast(/formato não suportado|unsupported format/i),
    ).toBeVisible({
      timeout: 4000,
    });
    expect(uploadCalls).toBe(0);
  });

  test("rejects an avatar file over the 5 MB limit client-side", async ({
    page,
  }) => {
    let uploadCalls = 0;
    await page.route("**/api/auth/profile/avatar", async (route) => {
      uploadCalls++;
      await route.fulfill({
        status: 500,
        json: {
          ok: false,
          error: { message: "unexpected", code: "GENERIC_ERROR" },
        },
      });
    });

    await profilePage.selectAvatarFile({
      name: "big-avatar.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(6 * 1024 * 1024),
    });

    await expect(
      profilePage.toast(/passa do limite de 5 mb|over the 5 mb limit/i),
    ).toBeVisible({
      timeout: 4000,
    });
    expect(uploadCalls).toBe(0);
  });
});
