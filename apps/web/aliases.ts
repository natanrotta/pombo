import { fileURLToPath } from "node:url";

/**
 * The one path-alias map, shared by `vite.config.ts` and `vitest.config.ts`.
 * `tsconfig.json` `paths` mirrors it (`@/*`, `@assets/*`) — TypeScript can't
 * import a module, so that copy stays hand-written.
 *
 * `@` resolves every `@/app`, `@/core`, `@/shared`, `@/modules` import because
 * Vite matches a string alias as a path prefix (`@/x` → `src/x`).
 */
export const aliases = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
  "@assets": fileURLToPath(new URL("./assets", import.meta.url)),
};
