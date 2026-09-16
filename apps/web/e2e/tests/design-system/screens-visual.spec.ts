import type { Page, Route } from "@playwright/test";
import { test, expect } from "../../fixtures/auth.fixture";
import { waitForSettledUi } from "../../fixtures/visual";

/**
 * Visual regression for the app screens: the shell (desktop sidebar and
 * mobile bottom nav) around the device list, and the profile page, in light
 * and dark.
 *
 * The session is real, but the data is fixed: `/auth/me` and `/devices` are
 * answered here and the clock is pinned, because the seeded account is shared
 * with specs that rename it and create devices.
 *
 * A layout change is EXPECTED to fail this spec: review the diff in the HTML
 * report, then accept it with `yarn test:e2e --update-snapshots`. Not a user
 * flow, so there is no negative case (E-H4 does not apply).
 */

const NOW = new Date("2026-03-10T14:00:00.000Z");
const SCHEMES = ["light", "dark"] as const;
const DESKTOP = { width: 1280, height: 900 };
const MOBILE = { width: 390, height: 844 };

const USER = {
  id: "visual-user",
  name: "Ana Souza",
  email: "ana.souza@example.com",
  emailVerified: true,
  avatarUrl: null,
  language: "pt-BR",
  status: "ACTIVE",
  createdAt: "2026-01-05T12:00:00.000Z",
  updatedAt: "2026-01-05T12:00:00.000Z",
};

const NO_WEBHOOKS = {
  onConnect: null,
  onDisconnect: null,
  onReceive: null,
  onMessageStatus: null,
  onSend: null,
};

const DEVICES = [
  {
    id: "visual-device-1",
    name: "Atendimento",
    identifier: "5511988887777",
    status: "CONNECTED",
    webhooks: NO_WEBHOOKS,
    lastConnectedAt: "2026-03-10T13:40:00.000Z",
    createdAt: "2026-02-01T12:00:00.000Z",
    updatedAt: "2026-03-10T13:40:00.000Z",
  },
  {
    id: "visual-device-2",
    name: "Vendas",
    identifier: null,
    status: "DISCONNECTED",
    webhooks: NO_WEBHOOKS,
    lastConnectedAt: null,
    createdAt: "2026-02-15T12:00:00.000Z",
    updatedAt: "2026-02-15T12:00:00.000Z",
  },
];

function fulfillData(route: Route, data: unknown) {
  return route.fulfill({ json: { ok: true, data } });
}

async function useFixedData(page: Page) {
  await page.clock.setFixedTime(NOW);
  await page.route("**/api/auth/me", (route) => fulfillData(route, USER));
  await page.route("**/api/devices", (route) => fulfillData(route, DEVICES));
  await page.route("**/api/messages/queue", (route) =>
    fulfillData(route, { pending: 17 }),
  );
  await page.route(`**/api/devices/${DEVICES[1].id}`, (route) =>
    fulfillData(route, DEVICES[1]),
  );
}

async function openSettled(page: Page, path: string, heading: RegExp) {
  await page.goto(path);
  // The route guard renders the page only after `/auth/me` resolved.
  await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  await waitForSettledUi(page);
}

for (const scheme of SCHEMES) {
  test.describe(`Auth screen — ${scheme}`, () => {
    // Signed out, and with the locale pinned: the sign-in page is public.
    test.use({
      colorScheme: scheme,
      viewport: DESKTOP,
      storageState: { cookies: [], origins: [] },
      locale: "pt-BR",
    });

    test("the sign-in screen matches its baseline", async ({ page }) => {
      await page.goto("/sign-in");
      await expect(
        page.getByRole("heading", { name: /acesse sua conta/i }),
      ).toBeVisible();
      await waitForSettledUi(page);

      await expect(page).toHaveScreenshot(`sign-in-${scheme}.png`, {
        // Google renders its own button in an iframe — not ours to pin.
        mask: [page.getByTestId("google-signin")],
      });
    });
  });

  test.describe(`App screens — ${scheme}`, () => {
    test.use({ colorScheme: scheme, viewport: DESKTOP });

    test.beforeEach(async ({ page }) => {
      await useFixedData(page);
    });

    test("the shell around the device list matches its baseline", async ({ page }) => {
      await openSettled(page, "/devices", /^dispositivos$/i);
      await expect(page.getByText("Atendimento")).toBeVisible();
      await expect(page).toHaveScreenshot(`devices-${scheme}.png`);
    });

    test("the device detail fits one screen and matches its baseline", async ({
      page,
    }) => {
      await openSettled(page, `/devices/${DEVICES[1].id}`, /^vendas$/i);

      // The whole screen has to fit the viewport — no scrolling to reach the
      // webhook fields or the save button.
      const overflow = await page.evaluate(
        () => document.documentElement.scrollHeight - window.innerHeight,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await expect(page).toHaveScreenshot(`device-detail-${scheme}.png`);
    });

    test("the sandbox matches its baseline", async ({ page }) => {
      await openSettled(page, "/sandbox", /^sandbox$/i);
      await expect(page.getByTestId("sandbox-queue")).toBeVisible();
      await expect(page).toHaveScreenshot(`sandbox-${scheme}.png`);
    });

    test("the profile page matches its baseline", async ({ page }) => {
      await openSettled(page, "/perfil", /^perfil$/i);
      await expect(page).toHaveScreenshot(`profile-${scheme}.png`);
    });

    test.describe("mobile", () => {
      test.use({ viewport: MOBILE });

      test("the bottom-nav shell matches its baseline", async ({ page }) => {
        await openSettled(page, "/devices", /^dispositivos$/i);
        await expect(
          page.getByRole("navigation", { name: /navegação principal/i }),
        ).toBeVisible();
        await expect(page).toHaveScreenshot(`devices-mobile-${scheme}.png`);
      });
    });
  });
}
