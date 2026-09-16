import dotenv from "dotenv";
import path from "node:path";

/**
 * Unit tests never need real secrets, but any spec that reaches `core/config`
 * exits the process when a required variable is missing. The local `.env`
 * loads first and wins (dotenv never overrides a set variable); the committed
 * `.env.example` fills whatever is left, so CI and fresh worktrees without an
 * `.env` still run the suite.
 */
const API_ROOT = path.resolve(__dirname, "../..");

dotenv.config({ path: path.join(API_ROOT, ".env"), quiet: true });
dotenv.config({ path: path.join(API_ROOT, ".env.example"), quiet: true });
