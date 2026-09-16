import { readFileSync } from "node:fs";
import path from "node:path";
import { envObjectSchema } from "./schema";

/**
 * `.env.example` is the operator-facing contract: every variable the schema
 * knows must be documented there (active or commented out), and it must not
 * carry keys the schema no longer reads. Both directions drifted before this
 * gate existed.
 */
const EXAMPLE_PATH = path.resolve(__dirname, "../../../.env.example");

function documentedKeys(): Set<string> {
  const keys = new Set<string>();
  for (const line of readFileSync(EXAMPLE_PATH, "utf8").split("\n")) {
    // `KEY=value` or a commented-out default `# KEY=value`.
    const match = /^\s*#?\s*([A-Z][A-Z0-9_]*)=/.exec(line);
    if (match) keys.add(match[1]!);
  }
  return keys;
}

describe(".env.example ↔ env schema", () => {
  const documented = documentedKeys();
  const schemaKeys = Object.keys(envObjectSchema.shape);

  it("documents every variable the schema reads", () => {
    const undocumented = schemaKeys.filter((key) => !documented.has(key));
    expect(undocumented).toEqual([]);
  });

  it("carries no variable the schema no longer reads", () => {
    const stale = [...documented].filter(
      (key) => !(key in envObjectSchema.shape),
    );
    expect(stale).toEqual([]);
  });
});
