import dotenv from "dotenv";
import path from "node:path";

/**
 * Unit tests never need real secrets, but any spec that reaches `core/config`
 * exits the process when a required variable is missing. The local `.env`
 * loads first and wins (dotenv never overrides a set variable); the committed
 * `.env.example` fills whatever is left, so CI and fresh worktrees without an
 * `.env` still run the suite.
 *
 * This holds because every spec in this project's `vitest.config.ts` is a unit
 * test with no real database or Redis connection. A suite that needs a live
 * service must not rely on this fallback — it would get the example's fake
 * `DATABASE_URL` instead of failing loudly.
 */
const API_ROOT = path.resolve(__dirname, "../..");

dotenv.config({ path: path.join(API_ROOT, ".env"), quiet: true });
dotenv.config({ path: path.join(API_ROOT, ".env.example"), quiet: true });
