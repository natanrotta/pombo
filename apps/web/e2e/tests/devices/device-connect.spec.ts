import { test, expect } from "../../fixtures/auth.fixture";
import { DeviceDetailPage } from "../../pages/devices/DeviceDetail.page";
import { deviceApi } from "../../fixtures/api-client";
import { createUniqueDevice } from "../../fixtures/test-data";

test.describe("Device Connect", () => {
  let detailPage: DeviceDetailPage;
  let deviceId: string;

  test.beforeEach(async ({ page }) => {
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

  test("shows the gateway-disabled state with no retry button", async () => {
    // The e2e API always runs with WHATSAPP_ENABLED=false (see
    // `patterns/e2e.md` § Setup prerequisites), so `connect` fails clean
    // with WA_GATEWAY_DISABLED against the real backend — no mock needed.
    await detailPage.clickConnect();

    await expect(detailPage.qrGatewayDisabledTitle).toBeVisible({ timeout: 10000 });
    await expect(detailPage.qrRetryButton).not.toBeVisible();
  });

  // ── Negative path ──────────────────────────────────────────────────────
  test("shows a retry panel on a generic connect failure and re-issues the request on retry", async ({
    page,
  }) => {
    let connectCalls = 0;
    await page.route("**/api/devices/*/connect", async (route) => {
      connectCalls += 1;
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: { message: "boom", code: "INTERNAL_ERROR" } }),
      });
    });

    await detailPage.clickConnect();

    await expect(detailPage.qrErrorText).toBeVisible({ timeout: 10000 });
    await expect(detailPage.qrRetryButton).toBeVisible();

    await detailPage.qrRetryButton.click();

    await expect(detailPage.qrRetryButton).toBeVisible({ timeout: 10000 });
    expect(connectCalls).toBeGreaterThanOrEqual(2);
  });
});
