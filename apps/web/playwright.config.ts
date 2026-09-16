import { defineConfig, devices } from "@playwright/test";

// Default ports for the isolated E2E stack — orchestrated by
// `apps/web/scripts/e2e-up.ts`. The script also exports them so you can
// override if you ever need multiple parallel runs on the same machine.
const E2E_WEB_URL = process.env.E2E_WEB_URL ?? "http://localhost:3001";
const E2E_API_URL = process.env.E2E_API_URL ?? "http://localhost:3334/api";
const E2E_WEB_PORT = Number(new URL(E2E_WEB_URL).port || 3001);
const E2E_API_PROXY_TARGET = E2E_API_URL.replace(/\/api\/?$/, "");

export default defineConfig({
  testDir: "./e2e/tests",
  // All Playwright output (HTML report + per-test traces/screenshots) is
  // funneled into a single gitignored `.playwright/` dir instead of leaving
  // `playwright-report/` and `test-results/` loose at the package root.
  outputDir: "./.playwright/results",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // E2E is single-worker and timing-sensitive: under local machine load a single
  // transient flake (page-load / autosave / modal-list timeout) would otherwise
  // fail the whole run. Match CI's retry budget locally so REAL bugs (which fail
  // every attempt) stay red while transient flakes self-heal. Override with
  // `E2E_RETRIES=0` when authoring a spec to surface flakiness directly.
  retries: process.env.E2E_RETRIES !== undefined ? Number(process.env.E2E_RETRIES) : 2,
  workers: 1,
  timeout: 60000,
  reporter: [["html", { open: "never", outputFolder: "./.playwright/report" }]],
  // Visual baselines live next to the specs and are versioned. The platform
  // suffix keeps a macOS baseline from being compared against Linux (CI)
  // rendering — fonts antialias differently.
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}-{platform}{ext}",
  // Baselines only exist for macOS (`-darwin`). Elsewhere (the Linux CI job)
  // the visual specs still drive the UI but skip the pixel comparison.
  ignoreSnapshots: process.platform !== "darwin",
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      // Same machine + same browser renders deterministically, so the per-pixel
      // color threshold can be tight: the 0.2 default lets a subtle token change
      // (white → a faint tint) pass unnoticed.
      threshold: 0.02,
      maxDiffPixelRatio: 0.002,
      stylePath: "./e2e/fixtures/screenshot.css",
    },
  },
  use: {
    baseURL: E2E_WEB_URL,
    // Test ids are `data-cy` in this app (see patterns/e2e.md).
    testIdAttribute: "data-cy",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testDir: "./e2e",
      testMatch: /global\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    // Vite reads VITE_PORT + VITE_API_PROXY_TARGET to serve the E2E web on
    // :3001 proxying to the E2E API on :3334 — fully isolated from any dev
    // server you might have running on :4000/:4444. Isolation includes the dep
    // cache: vite.config.ts switches this instance to node_modules/.vite-e2e,
    // so its fresh optimizer run never clobbers the dev server's .vite/deps.
    command: `VITE_PORT=${E2E_WEB_PORT} VITE_API_PROXY_TARGET=${E2E_API_PROXY_TARGET} yarn dev`,
    url: E2E_WEB_URL,
    // Never silently latch onto a stale Vite from a prior crashed run.
    // `scripts/e2e-run.ts` sweeps :3001 before bring-up, so the port is
    // guaranteed free and Playwright spawns a fresh Vite every cycle.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
