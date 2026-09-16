import { test, expect } from "../../fixtures/auth.fixture";
import { waitForSettledUi } from "../../fixtures/visual";
import type { Page } from "@playwright/test";

/**
 * Visual regression for the design system. The DEV-only `/dev/styleguide`
 * gallery renders every shared primitive in every state; each section and each
 * overlay is compared against a versioned baseline in light and dark.
 *
 * A design change is EXPECTED to fail this spec: review the diff in the HTML
 * report, then accept it with `yarn test:e2e --update-snapshots`.
 *
 * Not a user flow, so there is no negative case (E-H4 does not apply): the
 * assertion is "nothing moved that was not meant to".
 */

const STYLEGUIDE_PATH = "/dev/styleguide";
const SECTIONS = [
  "typography",
  "colors",
  "shadows",
  "buttons",
  "badges",
  "fields",
  "cards",
  "states",
  "controls",
  "overlays",
] as const;
const SCHEMES = ["light", "dark"] as const;

async function openStyleguide(page: Page) {
  await page.goto(STYLEGUIDE_PATH);
  await expect(page.getByRole("heading", { level: 1, name: "Styleguide" })).toBeVisible();
  await waitForSettledUi(page);
}

for (const scheme of SCHEMES) {
  test.describe(`Styleguide — ${scheme}`, () => {
    test.use({ colorScheme: scheme, viewport: { width: 1280, height: 900 } });

    test("every section matches its baseline", async ({ page }) => {
      await openStyleguide(page);
      for (const section of SECTIONS) {
        const block = page.getByTestId(`styleguide-${section}`);
        await block.scrollIntoViewIfNeeded();
        await waitForSettledUi(page);
        await expect(block).toHaveScreenshot(`${section}-${scheme}.png`);
      }
    });

    test("the modal matches its baseline", async ({ page }) => {
      await openStyleguide(page);
      await page.getByRole("button", { name: "Abrir modal" }).click();
      const modal = page.getByTestId("app-modal");
      await expect(modal).toBeVisible();
      await waitForSettledUi(page);
      await expect(modal).toHaveScreenshot(`modal-${scheme}.png`);
    });

    test("the confirmation dialog matches its baseline", async ({ page }) => {
      await openStyleguide(page);
      await page.getByRole("button", { name: "Abrir confirmação" }).click();
      const dialog = page.getByTestId("confirm-dialog");
      await expect(dialog).toBeVisible();
      await waitForSettledUi(page);
      await expect(dialog).toHaveScreenshot(`confirm-${scheme}.png`);
    });

    for (const status of ["success", "info", "warning", "error"] as const) {
      test(`the ${status} toast matches its baseline`, async ({ page }) => {
        await openStyleguide(page);
        await page.getByRole("button", { name: `Toast ${status}` }).click();
        const toast = page.getByTestId("toast");
        await expect(toast).toBeVisible();
        await waitForSettledUi(page);
        await expect(toast).toHaveScreenshot(`toast-${status}-${scheme}.png`);
      });
    }
  });
}
