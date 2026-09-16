import { fileURLToPath } from "node:url";

/**
 * The one path-alias map, shared by `vite.config.ts` and `vitest.config.ts`.
 * `tsconfig.json` `paths` mirrors it (`@/*`, `@assets/*`) — TypeScript can't
 * import a module, so that copy stays hand-written.
 *
 * `@` resolves every `@/app`, `@/core`, `@/shared`, `@/modules` import because
 * Vite matches a string alias as a path prefix (`@/x` → `src/x`).
 *
 * `@pombo/shared-types` points at the package's TypeScript SOURCE, not its
 * CommonJS `dist` (which exists for the API). A linked workspace package that
 * goes through Vite's dep pre-bundle is never re-optimized when it changes, so
 * a new runtime export (e.g. `ErrorCodes`) would be missing from the stale
 * bundle and the app would render blank until `vite --force`.
 */
export const aliases = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
  "@assets": fileURLToPath(new URL("./assets", import.meta.url)),
  "@pombo/shared-types": fileURLToPath(
    new URL("../../packages/shared-types/src/index.ts", import.meta.url),
  ),
};
