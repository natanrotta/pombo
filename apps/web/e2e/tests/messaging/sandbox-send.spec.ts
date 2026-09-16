import { type Page, type Route } from "@playwright/test";
import { test, expect } from "../../fixtures/auth.fixture";
import { SandboxPage } from "../../pages/messaging/SandboxPage.page";

/**
 * Sandbox send flows.
 *
 * The e2e API always runs with `WHATSAPP_ENABLED=false` (see
 * `apps/api/.env.e2e.example`), so `GET /devices` can never return a real
 * `CONNECTED` device — the composer + queue would be permanently unreachable
 * through the real backend. Every test past the empty-state one mocks
 * `GET /devices` (a synthetic connected device) plus the send/status/groups
 * endpoints via `page.route`, per the exception documented in
 * `patterns/e2e.md` § "Database CRUD" (mocks only when no real-backend path
 * exists). This file owns that exception for the whole `messaging` module.
 *
 * One `describe` per sub-flow keeps the mapping to the coverage rubric clear,
 * even though they all live in this single file (agent ownership boundary
 * for this task groups every messaging flow into one spec — see the run's
 * final report for the E-H4 trade-off).
 */

const CONNECTED_DEVICE = {
  id: "e2e-sandbox-device",
  name: "Sandbox E2E Device",
  identifier: "5511999998888",
  status: "CONNECTED",
  webhooks: {
    onConnect: null,
    onDisconnect: null,
    onReceive: null,
    onMessageStatus: null,
    onSend: null,
  },
  lastConnectedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/** Mocks `GET /devices` with a single connected device so the composer
 *  renders instead of the empty state. Must be registered before `goto()`. */
async function mockConnectedDevice(page: Page) {
  await page.route("**/api/devices", async (route: Route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({ json: { ok: true, data: [CONNECTED_DEVICE] } });
  });
}

/** Mocks `GET /messages/:id` to always resolve READ on the first poll, so a
 *  queue row's status settles immediately instead of waiting out the real
 *  2s polling interval. */
async function mockMessageStatusReady(page: Page) {
  await page.route("**/api/messages/*", async (route: Route) => {
    const messageId = route.request().url().split("/").pop();
    await route.fulfill({
      json: {
        ok: true,
        data: {
          messageId,
          status: "READ",
          failureReason: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    });
  });
}

let sandboxPage: SandboxPage;

test.beforeEach(async ({ page }) => {
  sandboxPage = new SandboxPage(page);
});

test.describe("Sandbox Send — empty state", () => {
  test("shows the empty state against the real API and its CTA goes to /devices", async ({
    page,
  }) => {
    // No mocking here on purpose: WHATSAPP_ENABLED=false guarantees the real
    // seed account has zero CONNECTED devices, so this exercises the actual
    // empty-state contract end to end.
    await sandboxPage.goto();

    await expect(sandboxPage.pageTitle).toBeVisible();
    await expect(sandboxPage.emptyStateTitle).toBeVisible();
    await sandboxPage.emptyStateAction.click();

    await expect(page).toHaveURL(/\/devices$/, { timeout: 15000 });
    await expect(
      page.getByRole("heading", { level: 1, name: /dispositivos|devices/i }),
    ).toBeVisible();
  });
});

test.describe("Sandbox Send — text", () => {
  test("sends a text message with a fresh Idempotency-Key and the queue reaches READ", async ({
    page,
  }) => {
    await mockConnectedDevice(page);
    await mockMessageStatusReady(page);

    const requests: { body: unknown; idempotencyKey: string | undefined }[] =
      [];
    await page.route("**/api/devices/*/messages", async (route: Route) => {
      const request = route.request();
      requests.push({
        body: request.postDataJSON(),
        idempotencyKey: request.headers()["idempotency-key"],
      });
      await route.fulfill({
        json: {
          ok: true,
          data: { messageId: "msg-text-1", status: "PENDING" },
        },
      });
    });

    await sandboxPage.goto();
    await sandboxPage.fillPhone("11988887777");
    await sandboxPage.fillText("Hello from the sandbox");
    await sandboxPage.send();

    await expect(page.getByText(/lida|read/i)).toBeVisible({ timeout: 10000 });

    expect(requests).toHaveLength(1);
    expect(requests[0].body).toMatchObject({
      phone: "11988887777",
      text: "Hello from the sandbox",
    });
    expect(requests[0].idempotencyKey).toBeTruthy();
  });

  test("sends a burst of 3 with distinct Idempotency-Keys and (i/3) suffixes", async ({
    page,
  }) => {
    await mockConnectedDevice(page);
    await mockMessageStatusReady(page);

    const requests: {
      body: { text?: string };
      idempotencyKey: string | undefined;
    }[] = [];
    await page.route("**/api/devices/*/messages", async (route: Route) => {
      const request = route.request();
      requests.push({
        body: request.postDataJSON(),
        idempotencyKey: request.headers()["idempotency-key"],
      });
      await route.fulfill({
        json: {
          ok: true,
          data: {
            messageId: `msg-burst-${requests.length}`,
            status: "PENDING",
          },
        },
      });
    });

    await sandboxPage.goto();
    await sandboxPage.fillPhone("11988887777");
    await sandboxPage.fillText("Burst message");
    await sandboxPage.setCount(3);
    await sandboxPage.send();

    await expect.poll(() => requests.length, { timeout: 10000 }).toBe(3);

    const keys = new Set(requests.map((r) => r.idempotencyKey));
    expect(keys.size).toBe(3);
    // The composer sends the burst one after another, so arrival order is
    // the send order. A parallel burst would make these three lines flaky.
    expect(requests[0].body.text).toBe("Burst message (1/3)");
    expect(requests[1].body.text).toBe("Burst message (2/3)");
    expect(requests[2].body.text).toBe("Burst message (3/3)");
  });
});

test.describe("Sandbox Send — media", () => {
  test("sends an image with phone, image and caption", async ({ page }) => {
    await mockConnectedDevice(page);
    await mockMessageStatusReady(page);

    let capturedBody: unknown = null;
    await page.route(
      "**/api/devices/*/messages/image",
      async (route: Route) => {
        capturedBody = route.request().postDataJSON();
        await route.fulfill({
          json: {
            ok: true,
            data: { messageId: "msg-image-1", status: "PENDING" },
          },
        });
      },
    );

    await sandboxPage.goto();
    await sandboxPage.selectType("image");
    await sandboxPage.fillPhone("11988887777");
    await sandboxPage.fillMediaUrl("https://example.com/image.png");
    await sandboxPage.fillCaption("A test caption");
    await sandboxPage.send();

    await expect
      .poll(() => capturedBody, { timeout: 10000 })
      .toMatchObject({
        phone: "11988887777",
        image: "https://example.com/image.png",
        caption: "A test caption",
      });
  });
});

test.describe("Sandbox Send — group", () => {
  test("lists mocked groups and posts { groupJid, text } to the group endpoint", async ({
    page,
  }) => {
    await mockConnectedDevice(page);
    await mockMessageStatusReady(page);
    const groupJid = "120363000000000000@g.us";
    await page.route("**/api/devices/*/groups", async (route: Route) => {
      await route.fulfill({
        json: { ok: true, data: [{ jid: groupJid, name: "QA Group" }] },
      });
    });

    let capturedBody: unknown = null;
    await page.route(
      "**/api/devices/*/messages/group",
      async (route: Route) => {
        capturedBody = route.request().postDataJSON();
        await route.fulfill({
          json: {
            ok: true,
            data: { messageId: "msg-group-1", status: "PENDING" },
          },
        });
      },
    );

    await sandboxPage.goto();
    await sandboxPage.selectType("group");
    await sandboxPage.selectGroup(groupJid);
    await sandboxPage.fillText("Hello group");
    await sandboxPage.send();

    await expect
      .poll(() => capturedBody, { timeout: 10000 })
      .toMatchObject({
        groupJid,
        text: "Hello group",
      });
  });
});

// ── Negative path ──────────────────────────────────────────────────────────

test.describe("Sandbox Send — negative", () => {
  test("marks the phone field when the API reports the number is not on WhatsApp", async ({
    page,
  }) => {
    await mockConnectedDevice(page);
    await page.route("**/api/devices/*/messages", async (route: Route) => {
      await route.fulfill({
        status: 422,
        json: {
          ok: false,
          error: {
            code: "NUMBER_NOT_ON_WHATSAPP",
            message: "This number isn't on WhatsApp.",
          },
        },
      });
    });

    await sandboxPage.goto();
    await sandboxPage.fillPhone("11988887777");
    await sandboxPage.fillText("Hello");
    await sandboxPage.send();

    await expect(sandboxPage.phoneError).toBeVisible();
  });

  test("shows the offline placeholder when the device's groups endpoint reports offline", async ({
    page,
  }) => {
    await mockConnectedDevice(page);
    await page.route("**/api/devices/*/groups", async (route: Route) => {
      await route.fulfill({
        status: 503,
        json: {
          ok: false,
          error: { code: "DEVICE_OFFLINE", message: "Device offline." },
        },
      });
    });

    await sandboxPage.goto();
    await sandboxPage.selectType("group");

    await expect(sandboxPage.groupSelect).toContainText(
      /o dispositivo está offline|the device is offline/i,
    );
  });

  test("client validation rejects a short phone number and sends nothing", async ({
    page,
  }) => {
    await mockConnectedDevice(page);
    let sendCalls = 0;
    await page.route("**/api/devices/*/messages", async (route: Route) => {
      sendCalls++;
      await route.fulfill({
        json: {
          ok: true,
          data: { messageId: "unexpected", status: "PENDING" },
        },
      });
    });

    await sandboxPage.goto();
    await sandboxPage.fillPhone("123");
    await sandboxPage.fillText("Hello");
    await sandboxPage.send();

    await expect(sandboxPage.phoneError).toBeVisible();
    expect(sendCalls).toBe(0);
    await expect(sandboxPage.queueEmptyTitle).toBeVisible();
  });
});
