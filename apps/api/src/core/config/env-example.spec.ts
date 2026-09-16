import { readFileSync } from "node:fs";
import path from "node:path";
import { envObjectSchema } from "./schema";

/**
 * The env templates are the operator-facing contract: every variable the
 * schema knows must be documented in each of them (active or commented out),
 * and they must not carry keys the schema no longer reads. Both directions
 * drifted before this gate existed — first in the local template, then in the
 * production one.
 */
const API_ROOT = path.resolve(__dirname, "../../..");
const REPO_ROOT = path.resolve(API_ROOT, "../..");

const TEMPLATES = [
  {
    name: "apps/api/.env.example",
    file: path.join(API_ROOT, ".env.example"),
    // Keys a template may carry that the app itself never reads.
    extraKeys: [] as string[],
  },
  {
    name: "infra/.env.prod.example",
    file: path.join(REPO_ROOT, "infra/.env.prod.example"),
    // Read by apps/api/docker-entrypoint.sh, not by the app.
    extraKeys: ["RUN_MIGRATIONS"],
  },
];

// `KEY=value` or a commented-out default `# KEY=value`.
const DOCUMENTED_LINE = /^\s*#?\s*([A-Z][A-Z0-9_]*)=/;
// Only an uncommented `KEY=value` is an active setting.
const ACTIVE_LINE = /^\s*([A-Z][A-Z0-9_]*)=(.*)$/;

function readLines(file: string): string[] {
  return readFileSync(file, "utf8").split("\n");
}

function documentedKeys(file: string): Set<string> {
  const keys = new Set<string>();
  for (const line of readLines(file)) {
    const match = DOCUMENTED_LINE.exec(line);
    if (match) keys.add(match[1]!);
  }
  return keys;
}

function activeValues(file: string): Map<string, string> {
  const values = new Map<string, string>();
  for (const line of readLines(file)) {
    const match = ACTIVE_LINE.exec(line);
    if (match) values.set(match[1]!, match[2]!.trim());
  }
  return values;
}

describe.each(TEMPLATES)("$name ↔ env schema", ({ file, extraKeys }) => {
  const documented = documentedKeys(file);
  const schemaKeys = Object.keys(envObjectSchema.shape);

  it("documents every variable the schema reads", () => {
    const undocumented = schemaKeys.filter((key) => !documented.has(key));
    expect(undocumented).toEqual([]);
  });

  it("carries no variable the schema no longer reads", () => {
    const stale = [...documented].filter(
      (key) => !(key in envObjectSchema.shape) && !extraKeys.includes(key),
    );
    expect(stale).toEqual([]);
  });
});

describe("infra/.env.prod.example — production defaults", () => {
  const active = activeValues(TEMPLATES[1]!.file);

  it("runs production with the WhatsApp gateway on (the single replica owns the sockets)", () => {
    expect(active.get("NODE_ENV")).toBe("production");
    expect(active.get("WHATSAPP_ENABLED")).toBe("true");
  });

  it("keeps the stamped image version authoritative (APP_VERSION stays commented)", () => {
    expect(active.has("APP_VERSION")).toBe(false);
    expect(active.has("GIT_COMMIT")).toBe(false);
  });
});
