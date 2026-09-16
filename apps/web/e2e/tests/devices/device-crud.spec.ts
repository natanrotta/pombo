import { test, expect } from "../../fixtures/auth.fixture";
import { DevicesListPage } from "../../pages/devices/DevicesList.page";
import { DeviceDetailPage } from "../../pages/devices/DeviceDetail.page";
import { deviceApi } from "../../fixtures/api-client";
import { createUniqueDevice } from "../../fixtures/test-data";

// This file intentionally covers create + webhook edit + delete + search in
// one spec (rather than the usual one-flow-per-file split — see `E-H4`) per
// the orchestrator's explicit file plan for this task, which keeps three
// parallel agents from touching overlapping spec files. Each sub-flow still
// gets its own `test.describe`, its own setup and its own best-effort
// cleanup, so the flows stay independently runnable.

test.describe("Device Create", () => {
  let listPage: DevicesListPage;
  let createdId: string | null = null;

  test.beforeEach(async ({ page }) => {
    listPage = new DevicesListPage(page);
    await listPage.goto();
  });

  test.afterEach(async () => {
    if (!createdId) return;
    try {
      await deviceApi.delete(createdId);
    } catch {
      // Best-effort cleanup — never fail the test on cleanup.
    }
    createdId = null;
  });

  test("creates a device, reveals the one-time secret, and opens its detail page", async ({
    page,
  }) => {
    const { name } = createUniqueDevice();

    await listPage.clickAdd();
    await listPage.fillCreateName(name);
    await listPage.submitCreateForm();

    await expect(page.getByText(/dispositivo criado|device created/i)).toBeVisible();
    await expect(listPage.secretValueField).toBeVisible();
    await expect(listPage.secretValueField).not.toHaveValue("");

    await listPage.goToDeviceFromSecret();

    await expect(page).toHaveURL(/\/devices\/[^/]+$/);
    createdId = page.url().split("/").pop() ?? null;
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  });

  // ── Negative path ──────────────────────────────────────────────────────
  test("rejects an empty device name and keeps the modal open", async () => {
    await listPage.clickAdd();
    await listPage.submitCreateForm();

    await expect(listPage.createNameError).toBeVisible();
    await expect(listPage.modal).toBeVisible();
  });
});

test.describe("Device Webhook Edit", () => {
  let detailPage: DeviceDetailPage;
  let deviceId: string;

  test.beforeEach(async ({ page }) => {
    // Creation isn't under test here — seed through the API (see
    // `patterns/e2e.md` § API client) so the edit flow starts from a clean
    // device with no webhooks configured yet.
    const created = await deviceApi.create(createUniqueDevice().name);
    deviceId = created.id;
    detailPage = new DeviceDetailPage(page);
    await detailPage.goto(deviceId);
  });

  test.afterEach(async () => {
    try {
      await deviceApi.delete(deviceId);
    } catch {
      // Best-effort cleanup — never fail the test on cleanup.
    }
  });

  test("autosaves a webhook URL and keeps it after reload", async ({ page }) => {
    await detailPage.fillWebhookUrl("onConnect", "https://example.com/hooks/connect");

    // Autosave debounce is 1500ms; wait on the visible toast instead of a
    // hard sleep — it only appears once the background PATCH resolves.
    await expect(detailPage.webhooksSavedToast).toBeVisible({ timeout: 10000 });

    await page.reload();
    await expect(detailPage.webhookInput("onConnect")).toHaveValue(
      "https://example.com/hooks/connect",
    );
  });

  // ── Negative path ──────────────────────────────────────────────────────
  test("shows a field error for an invalid URL and does not save it", async () => {
    await detailPage.fillWebhookUrl("onSend", "not-a-url");

    await expect(detailPage.webhookInvalidUrlError).toBeVisible();
    await expect(detailPage.webhooksSavedToast).not.toBeVisible({ timeout: 2000 });
  });
});

test.describe("Device Delete", () => {
  let deviceId: string;
  let deviceName: string;

  test.beforeEach(async () => {
    const unique = createUniqueDevice();
    deviceName = unique.name;
    const created = await deviceApi.create(deviceName);
    deviceId = created.id;
  });

  test.afterEach(async () => {
    try {
      await deviceApi.delete(deviceId);
    } catch {
      // Already deleted by the happy-path test — best-effort cleanup only.
    }
  });

  test("deletes from the detail page and returns to the list without it", async ({ page }) => {
    const detailPage = new DeviceDetailPage(page);
    await detailPage.goto(deviceId);

    await detailPage.clickDelete();
    await detailPage.confirmDelete();

    await expect(page).toHaveURL(/\/devices$/, { timeout: 10000 });
    const listPage = new DevicesListPage(page);
    await listPage.expectDeviceNotVisible(deviceName);
  });

  // ── Negative path ──────────────────────────────────────────────────────
  test("cancelling the delete confirm keeps the device in the list", async ({ page }) => {
    const listPage = new DevicesListPage(page);
    await listPage.goto();
    await listPage.search(deviceName);

    await listPage.deleteFromList(deviceName);
    await listPage.cancelDelete();

    await listPage.expectDeviceVisible(deviceName);
  });
});

test.describe("Device Search", () => {
  let listPage: DevicesListPage;
  let targetId: string;
  let noiseId: string;
  let targetName: string;

  test.beforeEach(async ({ page }) => {
    const target = createUniqueDevice();
    const noise = createUniqueDevice();
    targetName = target.name;
    [targetId, noiseId] = await Promise.all([
      deviceApi.create(target.name).then((d) => d.id),
      deviceApi.create(noise.name).then((d) => d.id),
    ]);

    listPage = new DevicesListPage(page);
    await listPage.goto();
  });

  test.afterEach(async () => {
    for (const id of [targetId, noiseId]) {
      try {
        await deviceApi.delete(id);
      } catch {
        // Best-effort cleanup — never fail the test on cleanup.
      }
    }
  });

  test("filters the list to the matching device and clears back to all", async () => {
    await listPage.search(targetName);

    await listPage.expectDeviceVisible(targetName);

    await listPage.clearSearch();
    await listPage.expectDeviceVisible(targetName);
  });

  // ── Negative path ──────────────────────────────────────────────────────
  test("shows the no-results state for a query matching nothing", async () => {
    await listPage.search(`${targetName} zzz-no-match`);

    await expect(listPage.noResultsState).toBeVisible();
  });
});
