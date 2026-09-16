#!/usr/bin/env tsx
/**
 * E2E Runner — full ephemeral cycle.
 *
 * Single command that owns the entire E2E lifecycle:
 *   1. Tear down any leftover E2E stack (`docker compose down -v`).
 *   2. Bring up a virgin Postgres + Redis (tmpfs, ports :5433 / :6380).
 *   3. Apply migrations against the E2E DB.
 *   4. Run `prisma/seed.ts`.
 *   5. Start the API on :3334.
 *   6. Run Playwright (which spawns Vite on :3001).
 *   7. Stop the API.
 *   8. Tear the stack down again.
 *
 * Dev backend on :4444/:5432/:6379 is never touched — you can run this while
 * `yarn start` is up.
 *
 * Flags
 *   --keep      Skip the final teardown (and the initial down-v). Useful for
 *               iteration mode (`yarn test:e2e:ui`). The stack is reused on
 *               the next run; seed is skipped if the seed user is already
 *               present.
 *   --headed    Forwarded to Playwright.
 *   --ui        Forwarded to Playwright (implies --keep).
 *   (everything else is forwarded to Playwright unchanged)
 */

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = resolve(__dirname, "..");
const REPO_ROOT = resolve(WEB_DIR, "../..");
const API_DIR = resolve(REPO_ROOT, "apps/api");
const COMPOSE_FILE = resolve(REPO_ROOT, "docker-compose.e2e.yml");

const API_HEALTH_URL = "http://localhost:3334/healthz";
// Ports owned by the E2E cycle. Fixed (not per-worktree) on purpose, so the
// suite always talks to the same endpoints. The downside is that a crashed run
// from ANY worktree leaves orphans that block the next bring-up — handled by
// killPortListeners() below.
const E2E_PORTS = [3334, 3001] as const;

const args = process.argv.slice(2);
const keep = args.includes("--keep") || args.includes("--ui");
const playwrightArgs = args.filter((a) => a !== "--keep");

let apiProcess: ChildProcess | null = null;

function log(step: string, msg: string) {
  process.stdout.write(`\x1b[36m[e2e:${step}]\x1b[0m ${msg}\n`);
}
function warn(step: string, msg: string) {
  process.stdout.write(`\x1b[33m[e2e:${step}]\x1b[0m ${msg}\n`);
}
function fail(step: string, msg: string): never {
  process.stderr.write(`\x1b[31m[e2e:${step}] ${msg}\x1b[0m\n`);
  process.exit(1);
}

function parseDotenv(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

// The seed account (apps/api/prisma/seed.ts; mirrored in e2e/fixtures/constants.ts).
const SEED_USER_EMAIL = "demo@example.com";

function buildApiEnv(): NodeJS.ProcessEnv {
  const base = parseDotenv(resolve(API_DIR, ".env"));
  // A local `.env.e2e` wins; the committed example serves CI and fresh checkouts.
  const localOverride = resolve(API_DIR, ".env.e2e");
  const overridePath = existsSync(localOverride)
    ? localOverride
    : resolve(API_DIR, ".env.e2e.example");
  const override = parseDotenv(overridePath);
  if (Object.keys(override).length === 0) {
    fail("env", "neither apps/api/.env.e2e nor apps/api/.env.e2e.example found");
  }
  const merged = { ...process.env, ...base, ...override };
  return {
    ...merged,
    // Whatever the dev `.env` says, the suite never opens real WhatsApp
    // sessions and never sends real e-mail (an empty key selects the console
    // mail provider).
    WHATSAPP_ENABLED: "false",
    RESEND_API_KEY: "",
    // The auth specs hit the IP-keyed auth limiter more than its default (10 /
    // 15 min) allows across one run.
    RATE_LIMIT_AUTH_MAX: merged.RATE_LIMIT_AUTH_MAX ?? "100",
  };
}

function run(cmd: string, args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) {
  const res = spawnSync(cmd, args, {
    stdio: "inherit",
    cwd: opts.cwd,
    env: opts.env ?? process.env,
  });
  if (res.status !== 0) fail("exec", `${cmd} ${args.join(" ")} → exit ${res.status}`);
}

function listPortPids(port: number): string[] {
  const res = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], {
    encoding: "utf8",
  });
  return (res.stdout ?? "").trim().split(/\s+/).filter(Boolean);
}

// SIGTERM, grace period, SIGKILL. Used at start (sweep orphans from a prior
// crashed run in any worktree) and at the end (Ctrl+C race vs. our own
// teardown can outrun stopApi). The grace window is generous (2s) because the
// API installs graceful-shutdown handlers that drain BullMQ / Bugsnag — anything
// slower than that we don't care about, force-kill is fine.
function killPortListeners(ports: readonly number[]) {
  for (const port of ports) {
    const pids = listPortPids(port);
    if (pids.length === 0) continue;
    warn("port", `killing leftover listener(s) on :${port} (pid ${pids.join(", ")})`);
    spawnSync("kill", ["-TERM", ...pids], { stdio: "ignore" });
    spawnSync("sh", ["-c", "sleep 2"]);
    const still = listPortPids(port);
    if (still.length > 0) {
      warn("port", `force-killing remaining listener(s) on :${port} (pid ${still.join(", ")})`);
      spawnSync("kill", ["-KILL", ...still], { stdio: "ignore" });
      spawnSync("sh", ["-c", "sleep 0.5"]);
    }
  }
}

async function isApiHealthy(): Promise<boolean> {
  try {
    const res = await fetch(API_HEALTH_URL);
    return res.ok;
  } catch {
    return false;
  }
}

async function waitForHttp(url: string, label: string, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // still booting
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  fail("wait", `${label} not healthy at ${url} within ${timeoutMs}ms`);
}

function seedUserPresent(): boolean {
  const res = spawnSync(
    "docker",
    [
      "compose",
      "-f",
      COMPOSE_FILE,
      "exec",
      "-T",
      "postgres-e2e",
      "psql",
      "-U",
      "postgres",
      "-d",
      "pombo_e2e",
      "-tAc",
      `SELECT COUNT(*) FROM "user" WHERE email = '${SEED_USER_EMAIL}';`,
    ],
    { encoding: "utf8" }
  );
  return res.status === 0 && Number.parseInt(res.stdout.trim(), 10) > 0;
}

function dockerDown(label: string) {
  log("docker", label);
  spawnSync("docker", ["compose", "-f", COMPOSE_FILE, "down", "-v"], {
    stdio: "inherit",
  });
  // Backstop: container_name is fixed in the compose file, so leftovers from a
  // crashed run — or from the same compose file invoked from another worktree
  // (different compose project) — slip past `down -v` and collide on the next
  // `up`. Force-remove by name; silent if they don't exist.
  spawnSync("docker", ["rm", "-f", "pombo-postgres-e2e", "pombo-redis-e2e"], {
    stdio: "ignore",
  });
}

function dockerUp() {
  log("docker", "bringing up postgres-e2e + redis-e2e…");
  run("docker", ["compose", "-f", COMPOSE_FILE, "up", "-d", "--wait"]);
}

function stopApi() {
  if (!apiProcess || apiProcess.killed) return;
  log("api", "stopping API…");
  apiProcess.kill("SIGTERM");
  setTimeout(() => apiProcess?.kill("SIGKILL"), 2_000).unref();
}

let teardownStarted = false;
function teardown(reason: string) {
  if (teardownStarted) return;
  teardownStarted = true;
  stopApi();
  if (keep) {
    log("done", `--keep set; Docker stack left running. (${reason})`);
  } else {
    dockerDown(`tearing down (${reason})…`);
    // stopApi sends SIGTERM async; if process.exit races it, the API child
    // outlives us and squats :3334 for the next run. Sweep the ports here so
    // every non-keep cycle ends truly clean — orphan-free for the next run.
    killPortListeners(E2E_PORTS);
  }
}

async function main() {
  // Single env snapshot for the entire run. Hoisted out of the cold/warm
  // branches so the API spawn (step 5) and the Playwright child (step 6) see
  // the same values. Reading `.env` twice (once per call site) would let a
  // mid-run change diverge between the API and the test process.
  const apiEnv = buildApiEnv();

  // Warm-reuse path: --keep is intended for iteration loops (UI mode, repeated
  // local runs). If the previous cycle left a healthy API on :3334, trust the
  // whole stack and jump straight to Playwright — that's the whole point of
  // --keep. Cold path otherwise (the only path on plain `yarn test:e2e`).
  const reuseExisting = keep && (await isApiHealthy());

  if (reuseExisting) {
    log("api", "warm reuse — E2E API on :3334 already healthy, skipping bring-up.");
  } else {
    // Step 0 — sweep orphan host-side listeners on the E2E ports. `docker
    // compose down` only cleans containers; the API/Vite the runner spawned
    // (possibly from another worktree) survive a crashed run and squat
    // :3334 / :3001, causing EADDRINUSE on the next start.
    killPortListeners(E2E_PORTS);

    // Step 1 — clean slate (skipped on --keep cold start so the stack lives
    // on between iterations).
    if (!keep) dockerDown("initial cleanup — guaranteeing a virgin DB…");

    // Step 2 — bring up.
    dockerUp();

    // Step 3 — apply migrations.
    log("prisma", "applying migrations…");
    run("npx", ["prisma", "migrate", "deploy"], { cwd: API_DIR, env: apiEnv });

    // Step 4 — seed (skip on warm --keep run if seed user is still there).
    if (!seedUserPresent()) {
      log("seed", "running prisma/seed.ts…");
      run("npx", ["tsx", "prisma/seed.ts"], { cwd: API_DIR, env: apiEnv });
    } else {
      log("seed", "seed user already present (warm run) — skipping.");
    }

    // Step 5 — spawn API.
    log("api", "spawning API on :3334 (DB=pombo_e2e)…");
    apiProcess = spawn("npx", ["tsx", "src/main.ts"], {
      cwd: API_DIR,
      env: apiEnv,
      stdio: ["ignore", "pipe", "pipe"],
    });
    apiProcess.stdout?.on("data", (c: Buffer) =>
      process.stdout.write(`\x1b[90m[api]\x1b[0m ${c.toString()}`)
    );
    apiProcess.stderr?.on("data", (c: Buffer) =>
      process.stderr.write(`\x1b[90m[api:err]\x1b[0m ${c.toString()}`)
    );
    apiProcess.on("exit", (code) => {
      if (code !== 0 && code !== null && !teardownStarted) {
        warn("api", `API exited unexpectedly with code ${code}`);
      }
    });

    await waitForHttp(API_HEALTH_URL, "API", 60_000);
  }

  log("ready", "API up. Running Playwright…");

  // Step 6 — Playwright (foreground). Spawns Vite via webServer.
  //
  // Forward the SAME env snapshot the API saw to the Playwright child, and pin
  // `E2E_API_URL` to the E2E port so the fixtures talk to the right API.
  const playwrightEnv = {
    ...apiEnv,
    E2E_API_URL: "http://localhost:3334/api",
  };
  const pw = spawnSync("npx", ["playwright", "test", "--project=chromium", ...playwrightArgs], {
    stdio: "inherit",
    cwd: WEB_DIR,
    env: playwrightEnv,
  });

  // Steps 7 + 8 — teardown.
  teardown(`playwright exit ${pw.status ?? "unknown"}`);
  process.exit(pw.status ?? 1);
}

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    warn("signal", `caught ${sig}.`);
    teardown(sig);
    process.exit(130);
  });
}

main().catch((err) => {
  warn("fatal", (err as Error).message);
  teardown("error");
  process.exit(1);
});
