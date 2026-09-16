import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * B-C14 guard. The auth/scope middlewares are FACTORIES — `authMiddleware()`
 * returns the handler. Mounting the factory itself (`router.use(authMiddleware)`)
 * makes Express call it as the handler: it returns a function, never calls
 * `next()`, every request on that router hangs, and the guard is never applied.
 * Nothing at type level catches it (a factory IS a function), so this spec
 * walks every route file and refuses a factory name that is not immediately
 * called.
 */
const SRC = path.resolve(__dirname, "../../..");

const FACTORIES = [
  "authMiddleware",
  "emailVerificationAuthMiddleware",
  "rejectScopedTokens",
  "requireScope",
  "bearerFromQueryToken",
  "apiTokenAuthMiddleware",
] as const;

const FACTORY_SOURCES = [
  "core/http/middlewares/auth.middleware.ts",
  "modules/public-api/infrastructure/middleware/api-token-auth.middleware.ts",
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (entry === "generated" || entry === "node_modules") continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const isRouteFile = (file: string): boolean =>
  /\/infrastructure\/route\/[^/]+\.routes\.ts$/.test(file) ||
  file.endsWith("/core/http/routes/index.ts") ||
  file.endsWith("/core/http/app.ts");

// Imports and comments are not mounts — a comment that merely mentions a
// factory name must not trip the guard.
const stripImports = (source: string): string =>
  source
    .replace(/^import[\s\S]*?from\s+["'][^"']+["'];?/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");

describe("route mounting (B-C14)", () => {
  const routeFiles = walk(SRC).filter(isRouteFile);

  it("finds the route files it guards", () => {
    expect(routeFiles.length).toBeGreaterThanOrEqual(5);
  });

  it("never mounts a /users surface again (the unscoped CRUD was deleted, not fixed)", () => {
    const aggregator = readFileSync(
      path.join(SRC, "core/http/routes/index.ts"),
      "utf8",
    );
    expect(aggregator).not.toMatch(/["']\/users["']/);
    expect(routeFiles.some((file) => /\/user\.routes\.ts$/.test(file))).toBe(
      false,
    );
  });

  it("every guarded factory name is still exported from its source (rename → update FACTORIES)", () => {
    const exported = FACTORY_SOURCES.flatMap((relative) => {
      const source = readFileSync(path.join(SRC, relative), "utf8");
      return [...source.matchAll(/^export function (\w+)\(/gm)].map(
        (m) => m[1],
      );
    });
    for (const name of FACTORIES) expect(exported).toContain(name);
  });

  it.each(FACTORIES)("never mounts %s without calling it", (factory) => {
    const pattern = new RegExp(`\\b${factory}\\b(?!\\s*\\()`, "g");
    const offenders: string[] = [];
    for (const file of routeFiles) {
      const body = stripImports(readFileSync(file, "utf8"));
      const lines = body.split("\n");
      lines.forEach((line, index) => {
        if (pattern.test(line)) {
          offenders.push(
            `${path.relative(SRC, file)}:${index + 1}: ${line.trim()}`,
          );
        }
        pattern.lastIndex = 0;
      });
    }
    expect(offenders).toEqual([]);
  });
});
