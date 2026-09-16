import dotenv from "dotenv";
import path from "node:path";
import { envSchema } from "./schema";

dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const missingFields = Object.keys(parsed.error.flatten().fieldErrors);
  // eslint-disable-next-line no-console
  console.error("❌ Invalid environment variables:");
  // eslint-disable-next-line no-console
  console.error(`  Missing or invalid: ${missingFields.join(", ")}`);
  // Also print each issue's message: a cross-field refine failure (e.g.
  // TYPING_MIN_MS > TYPING_MAX_MS) is meaningless from the field name alone.
  // eslint-disable-next-line no-console
  console.error(`  ${parsed.error.issues.map((i) => i.message).join("\n  ")}`);
  process.exit(1);
}

/** The validated runtime configuration. Import via `@core/config`. */
export const env = parsed.data;
