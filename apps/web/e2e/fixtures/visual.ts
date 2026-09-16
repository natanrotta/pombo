import type { Page } from "@playwright/test";

/** Finite animations (entrances, fades) must finish before a screenshot;
 *  infinite ones (skeleton pulse) are frozen by `animations: "disabled"`. */
export async function waitForSettledUi(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .every(
        (animation) =>
          animation.playState !== "running" ||
          animation.effect?.getTiming().iterations === Infinity,
      ),
  );
}
