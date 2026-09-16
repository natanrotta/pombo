import { defineConfig, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { execSync } from "node:child_process";
import { aliases } from "./aliases";

const enableHttps = process.env.VITE_HTTPS === "true";
// `VITE_PORT` + `VITE_API_PROXY_TARGET` let the Playwright webServer (see
// playwright.config.ts, orchestrated by `scripts/e2e-run.ts`) spin a second
// Vite on port 3001 proxying to the E2E API on :3334 — without disturbing the
// dev pair already running on :4000/:4444. `VITE_API_PROXY_TARGET` doubles as
// the "this is the E2E instance" signal below.
const isE2eInstance = Boolean(process.env.VITE_API_PROXY_TARGET);
const vitePort = Number(process.env.VITE_PORT ?? 4000);
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? "http://localhost:4444";

// Build-time version stamp surfaced in the sidebar (see src/shared/appVersion.ts).
// Resolution order: explicit VITE_APP_VERSION → Cloudflare Pages' CF_PAGES_COMMIT_SHA
// → the build checkout's own short git SHA → "dev". The git fallback is what keeps a
// *production build* carrying a real identifier even when Cloudflare Pages doesn't
// inject CF_PAGES_COMMIT_SHA (the symptom that made prod read "dev"): the Pages build
// clones the repo, so `git rev-parse` resolves there. It runs only for `vite build`,
// so the local dev server stays "dev". Mirrors the API's APP_VERSION ?? commit ?? fallback.
function resolveAppVersion(command: "build" | "serve"): string {
  const explicit = process.env.VITE_APP_VERSION || process.env.CF_PAGES_COMMIT_SHA?.slice(0, 7);
  if (explicit) return explicit;
  if (command === "build") {
    try {
      return execSync("git rev-parse --short HEAD", {
        stdio: ["ignore", "pipe", "ignore"],
        encoding: "utf8",
      }).trim();
    } catch {
      // No git history in the build environment — fall through to the dev sentinel.
    }
  }
  return "dev";
}

// In dev, Vite serves optimized dep chunks (/node_modules/.vite*/deps/*.js?v=<hash>)
// with `Cache-Control: max-age=31536000,immutable`. When the dep optimizer
// re-runs mid-session the chunk FILENAMES rotate but the `v=` browserHash can
// stay identical — so an open tab resolves the old parent chunk straight from
// the browser's disk cache, which imports a chunk file that no longer exists
// (404, "Failed to fetch dynamically imported module"), and even a full reload
// cannot heal because the poisoned URL never revalidates. Forcing `no-cache`
// makes the browser revalidate each dep chunk (cheap localhost 304s via ETag),
// so one plain reload — e.g. the one `lazyWithRetry` fires — always recovers.
// Typed structurally (no `Plugin` annotation): the monorepo hoists a second
// vite copy at the root, and a nominal annotation can bind to the wrong copy
// and fail the assignability check against this file's `defineConfig`.
const devDepsNoImmutableCache = () => ({
  name: "boilerplate:dev-deps-no-immutable-cache",
  apply: "serve" as const,
  configureServer(server: ViteDevServer) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.includes("/node_modules/.vite")) {
        const setHeader = res.setHeader.bind(res);
        res.setHeader = (name: string, value: Parameters<typeof setHeader>[1]) =>
          name.toLowerCase() === "cache-control"
            ? setHeader(name, "no-cache")
            : setHeader(name, value);
      }
      next();
    });
  },
});

export default defineConfig(({ command }) => ({
  plugins: [react(), devDepsNoImmutableCache(), ...(enableHttps ? [basicSsl()] : [])],
  define: {
    __APP_VERSION__: JSON.stringify(resolveAppVersion(command)),
  },
  // The E2E Vite must NOT share the dev server's dep cache: its fresh optimizer
  // run (Playwright uses `reuseExistingServer: false`) swaps
  // node_modules/.vite/deps under the live :4000 server, stranding open tabs on
  // chunk files that no longer exist. Same-name isolation keeps both healthy.
  ...(isE2eInstance ? { cacheDir: "node_modules/.vite-e2e" } : {}),
  server: {
    port: vitePort,
    strictPort: true,
    // Only auto-open the browser in dev, never for the E2E instance.
    open: !isE2eInstance,
    host: enableHttps ? true : undefined,
    headers: {
      "Permissions-Policy": "microphone=*, camera=*",
    },
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: aliases,
  },
  // `@pombo/shared-types` is aliased to its TypeScript source (see aliases.ts),
  // so it is compiled like app code: no CJS interop and no dep pre-bundle that
  // goes stale when the package changes.
  build: {
    rollupOptions: {
      output: {
        // Stable vendor chunks: app deploys (route-chunk churn) no longer
        // invalidate the big framework payloads in the browser cache.
        // framer-motion rides with Chakra (hard peer dep — same graph).
        // Heavy leaf libs (qrcode) are NOT listed: they reach the browser only
        // through lazy route chunks and must keep their own chunks.
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-chakra": ["@chakra-ui/react", "@emotion/react", "framer-motion"],
          "vendor-query": ["@tanstack/react-query", "axios"],
          "vendor-i18n": ["i18next", "react-i18next", "i18next-browser-languagedetector"],
        },
      },
    },
  },
}));
