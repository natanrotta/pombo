// Shared helpers for the guided deploy CLI (`yarn make-tag` · `yarn deploy` ·
// `yarn rollback` · `yarn monitor-status`).
//
// These scripts are the operator-facing layer on top of the GitHub Actions
// workflows (build-api.yml + deploy-api.yml), which they dispatch with
// `gh workflow run`. They use the operator's local `gh` login — never the API's
// GITHUB_ACTIONS_TOKEN — so nothing here reads or prints a secret. Zero external
// deps: Node built-ins only (child_process, readline/promises, fetch).

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";
import { emitKeypressEvents } from "node:readline";
import { stdin, stdout } from "node:process";

// ── Deploy target (infra/deploy.env — NO real host ships with the repo) ───────
// The targets live in `infra/deploy.env` (gitignored; template:
// infra/deploy.env.example) — the SAME file the Makefile reads. It is loaded
// here when present; a variable already exported in the shell always wins
// (process.loadEnvFile never overrides an existing key). Unset targets make
// deploy/rollback fail fast, so a stray command can never touch someone else's
// infrastructure.
//   API_URL   e.g. https://api.your-domain.tld   (the deployed API base)
//   WEB_URL   e.g. https://app.your-domain.tld   (web frontend, for monitor)
//   SITE_URL  e.g. https://your-domain.tld        (marketing site, for monitor)
//   DATA_HOST the DB host reachable over SSH       (never public)
//   SSH_USER  defaults to "root"
export const DEPLOY_ENV_FILE = fileURLToPath(new URL("../../infra/deploy.env", import.meta.url));
if (existsSync(DEPLOY_ENV_FILE)) process.loadEnvFile(DEPLOY_ENV_FILE);

export const API_URL = (process.env.API_URL || "").trim().replace(/\/+$/, "");
export const HEALTH_URL = API_URL ? `${API_URL}/api/health` : "";
export const BUILD_WF = process.env.BUILD_WF || "build-api.yml";
export const DEPLOY_WF = process.env.DEPLOY_WF || "deploy-api.yml";
/** The branch the CI workflows dispatch from. Override via env if needed. */
export const DEPLOY_REF = process.env.DEPLOY_REF || "main";

export const WEB_URL = (process.env.WEB_URL || "").trim().replace(/\/+$/, "");
export const SITE_URL = (process.env.SITE_URL || "").trim().replace(/\/+$/, "");
/** DB host reached over SSH for the DB/migrations snapshot. Empty by default. */
export const DATA_HOST = (process.env.DATA_HOST || "").trim();
export const SSH_USER = (process.env.SSH_USER || "").trim() || "root";

/** Fail fast unless the deploy target is configured. Keeps deploy/rollback from
 *  ever running against an unset (or someone else's) host. */
export function requireDeployTarget() {
  if (!API_URL) {
    fail(
      "Alvo de deploy não configurado (API_URL vazio).\n" +
        "  Copie infra/deploy.env.example → infra/deploy.env e preencha API_URL\n" +
        "  (ex.: https://api.your-domain.tld) — ou exporte API_URL no shell. Ver DEPLOY.md.",
    );
  }
}

// ── Colors (auto-off when not a TTY or NO_COLOR is set) ──────────────────────
const useColor = stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));
export const c = {
  bold: paint("1"),
  dim: paint("2"),
  red: paint("31"),
  green: paint("32"),
  yellow: paint("33"),
  blue: paint("34"),
  cyan: paint("36"),
};

// ── Logging ──────────────────────────────────────────────────────────────────
export const log = (msg = "") => console.log(msg);
export const info = (msg) => console.log(`${c.cyan("›")} ${msg}`);
export const ok = (msg) => console.log(`${c.green("✔")} ${msg}`);
export const warn = (msg) => console.log(`${c.yellow("!")} ${msg}`);
export const err = (msg) => console.error(`${c.red("✖")} ${msg}`);
export const hr = () => console.log(c.dim("─".repeat(56)));

/** Print a message and exit with a non-zero code. Used for every fail-fast path
 *  so a script never dispatches on a bad precondition. Closes the readline
 *  interface first (idempotent) so every exit path cleans up interactive state,
 *  even when `fail()` fires mid-prompt. */
export function fail(msg, code = 1) {
  askClose();
  err(msg);
  process.exit(code);
}

// ── Shell ────────────────────────────────────────────────────────────────────
/** Run a command and return its trimmed stdout. Throws on non-zero exit. */
export function capture(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts })
    .toString()
    .trim();
}

/** Run a command inheriting stdio (so live output streams to the terminal).
 *  Returns the numeric exit code (0 = success). */
export function stream(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  return res.status ?? 1;
}

/** True when a binary is resolvable on PATH. */
export function has(cmd) {
  const probe = process.platform === "win32" ? "where" : "which";
  return spawnSync(probe, [cmd], { stdio: "ignore" }).status === 0;
}

/**
 * Run a verification step (a test suite) streaming its output live, and return
 * true on exit 0. Pauses the readline interface around the child so keystrokes
 * typed during the (possibly long) run aren't swallowed by readline before the
 * next prompt; `stdio: "inherit"` is what actually hands stdin/stdout to the
 * child. Used to gate a dispatch on `yarn workspace @pombo/api test`.
 */
export function runCheck(title, cmd, args) {
  info(`Verificando: ${title}…`);
  if (rl) rl.pause();
  hr();
  const code = stream(cmd, args);
  hr();
  if (rl) rl.resume();
  if (code === 0) {
    ok(`${title}: passou.`);
    return true;
  }
  err(`${title}: FALHOU (exit ${code}).`);
  return false;
}

// ── Preconditions ─────────────────────────────────────────────────────────────
/** Ensure the terminal is interactive — these commands ask questions. */
export function requireInteractive() {
  if (!stdin.isTTY) {
    fail(
      "Este comando é interativo e precisa de um terminal (TTY). Rode-o direto no seu terminal, sem pipe/redirect."
    );
  }
}

/** Ensure `gh` exists and is authenticated; return the current repo (owner/name). */
export function requireGh() {
  if (!has("gh")) {
    fail(
      "GitHub CLI (`gh`) não encontrado. Instale com `brew install gh` e rode `gh auth login`.\nDoc: https://cli.github.com"
    );
  }
  if (spawnSync("gh", ["auth", "status"], { stdio: "ignore" }).status !== 0) {
    fail("`gh` não está autenticado. Rode `gh auth login` e tente de novo.");
  }
  try {
    return capture("gh", ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"]);
  } catch {
    fail("Não consegui detectar o repositório GitHub. Rode o comando de dentro do repo do Pombo.");
  }
}

// ── Prompts ──────────────────────────────────────────────────────────────────
/** One readline session per script run, closed by `askClose()`. */
let rl = null;
function ask() {
  if (!rl) rl = readline.createInterface({ input: stdin, output: stdout });
  return rl;
}
export function askClose() {
  if (rl) {
    rl.close();
    rl = null;
  }
}

/** Free-text question with an optional default (shown in dim). */
export async function question(label, def = "") {
  const suffix = def ? c.dim(` [${def}]`) : "";
  const answer = (await ask().question(`${c.bold("?")} ${label}${suffix} `)).trim();
  return answer || def;
}

/** Yes/no confirmation — agora por SELEÇÃO (setas), não digitação. Mantém a
 *  assinatura (retorna boolean) pra todos os call sites herdarem o menu sem
 *  mudança. Default = NÃO em tudo que toca produção. */
export async function confirm(label, defaultYes = false) {
  return choose(
    label,
    [
      { value: true, label: "Sim" },
      { value: false, label: "Não" },
    ],
    defaultYes ? 0 : 1
  );
}

/** Confirmação forte por SELEÇÃO em vez de digitar o valor: oferece a ação (ex.:
 *  a tag) e "Cancelar". O padrão é SEMPRE Cancelar — produção nunca sobe num Enter
 *  acidental; pra confirmar você move pra ação de propósito. Retorna true = ação,
 *  false = cancelar. */
export async function confirmChoice(label, actionLabel, { hint } = {}) {
  return choose(
    label,
    [
      { value: true, label: actionLabel, hint },
      { value: false, label: "Cancelar" },
    ],
    1 // default = Cancelar
  );
}

// ── Interactive single-choice menu (arrow keys) ───────────────────────────────
const ESC = "\x1b";
const saveCursor = () => stdout.write(`${ESC}7`); // DEC save cursor position
const restoreCursor = () => stdout.write(`${ESC}8`); // DEC restore
const clearDown = () => stdout.write(`${ESC}[0J`); // erase from cursor to end of screen

/**
 * Single-choice menu you NAVIGATE with the arrow keys (↑/↓ or j/k; digits 1-9
 * jump; Enter confirms; Ctrl-C/Esc aborts) instead of typing a number — the
 * selected row shows a `›` and the rest are dimmed. `choices` = [{ value, label,
 * hint? }] where `label` is PLAIN text (no ANSI) and `hint` is an optional dim
 * suffix like "(padrão)". Returns the chosen value and collapses the menu to a
 * single record line after Enter, so the scrollback stays clean.
 *
 * Takes over stdin in raw mode using Node built-ins only (no external prompt
 * dep). Non-TTY (pipe/CI) → prints the list and reads a typed number, so nothing
 * breaks when there is no interactive terminal.
 */
export async function choose(label, choices, defaultIndex = 0) {
  const wrap = (i) => (i + choices.length) % choices.length;
  let index = Number.isInteger(defaultIndex) ? wrap(defaultIndex) : 0;

  // Non-TTY: degrade to the classic printed list + typed number.
  if (!stdin.isTTY || !stdout.isTTY) {
    log(`${c.bold("?")} ${label}`);
    choices.forEach((ch, i) => {
      const marker = i === index ? c.cyan(`${i + 1})`) : c.dim(`${i + 1})`);
      const hint = ch.hint ? ` ${c.dim(ch.hint)}` : "";
      log(`  ${marker} ${ch.label}${hint}`);
    });
    const raw = await question(`Escolha 1-${choices.length}`, String(index + 1));
    const idx = Number.parseInt(raw, 10) - 1;
    if (!Number.isInteger(idx) || idx < 0 || idx >= choices.length) fail(`Opção inválida: "${raw}".`);
    return choices[idx].value;
  }

  // Take over stdin in raw mode: free the shared readline first (it is recreated
  // lazily by the next question/confirm) so the two never fight over keystrokes.
  askClose();

  const rows = choices.length + 1; // the question line + one line per option
  const paint = () => {
    restoreCursor();
    clearDown();
    stdout.write(`${c.bold("?")} ${label} ${c.dim("· ↑/↓ e Enter")}\n`);
    choices.forEach((ch, i) => {
      const on = i === index;
      const pointer = on ? c.cyan("›") : " ";
      const text = on ? c.cyan(ch.label) : c.dim(ch.label);
      const hint = ch.hint ? ` ${c.dim(ch.hint)}` : "";
      stdout.write(` ${pointer} ${text}${hint}\n`);
    });
  };

  return new Promise((resolve) => {
    emitKeypressEvents(stdin);
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();

    const cleanup = () => {
      stdin.removeListener("keypress", onKey);
      stdin.setRawMode(wasRaw ?? false);
      stdin.pause();
    };
    const abort = () => {
      cleanup();
      stdout.write("\n");
      process.exit(130);
    };

    const onKey = (str, key = {}) => {
      const name = key.name;
      if ((key.ctrl && name === "c") || name === "escape") {
        abort();
      } else if (name === "up" || name === "k" || (key.shift && name === "tab")) {
        index = wrap(index - 1);
        paint();
      } else if (name === "down" || name === "j" || name === "tab") {
        index = wrap(index + 1);
        paint();
      } else if (str && /^[1-9]$/.test(str) && Number(str) <= choices.length) {
        index = Number(str) - 1;
        paint();
      } else if (name === "return" || name === "enter") {
        cleanup();
        restoreCursor();
        clearDown();
        const chosen = choices[index];
        const hint = chosen.hint ? ` ${c.dim(chosen.hint)}` : "";
        stdout.write(`${c.bold("?")} ${label} ${c.cyan(`› ${chosen.label}`)}${hint}\n`);
        resolve(chosen.value);
      }
    };

    // Reserve the block's rows up-front (pre-scroll), then anchor the cursor at
    // its top so every redraw restores to a stable position — no drift when the
    // menu lands near the bottom of the screen.
    stdout.write("\n".repeat(rows));
    stdout.write(`${ESC}[${rows}A`);
    saveCursor();
    paint();
    stdin.on("keypress", onKey);
  });
}

// ── Version math (vMAJOR.MINOR — mirrors build-api.yml) ───────────────────────
export const VERSION_RE = /^v(\d+)\.(\d+)$/;
export const isValidVersion = (v) => VERSION_RE.test(v);

/** How many recent version tags the deploy/rollback pickers offer to SELECT
 *  before falling back to "digitar uma versão". Keeps the menus curtos e
 *  escaneáveis — selecionar é o caminho padrão, digitar é o escape. */
export const TAG_PICK_LIMIT = 3;

/** Sync local tags with the remote (quietly). Best-effort: offline / no remote
 *  just leaves the local tags as-is. Call before reading tags so the picker and
 *  `tagExists` see CI-pushed releases, not a stale checkout. */
export function fetchTags() {
  try {
    execFileSync("git", ["fetch", "--tags", "--force"], { stdio: "ignore" });
  } catch {
    // Offline / no remote: fall back to whatever tags exist locally.
  }
}

/** Fetch remote tags (quietly) then return the newest `vX.Y` tag, or null. */
export function latestTag() {
  fetchTags();
  try {
    const out = capture("git", ["tag", "-l", "v[0-9]*.[0-9]*", "--sort=-v:refname"]);
    const first = out.split("\n").find((l) => VERSION_RE.test(l.trim()));
    return first ? first.trim() : null;
  } catch {
    return null;
  }
}

/** Up to `n` newest release tags (vX.Y), newest first — for the rollback/deploy pickers. */
export function recentTags(n = 8) {
  try {
    const out = capture("git", ["tag", "-l", "v[0-9]*.[0-9]*", "--sort=-v:refname"]);
    return out ? out.split("\n").map((t) => t.trim()).filter(Boolean).slice(0, n) : [];
  } catch {
    return [];
  }
}

/** True when a git tag with this name already exists (local or fetched). */
export function tagExists(tag) {
  return spawnSync("git", ["rev-parse", "-q", "--verify", `refs/tags/${tag}`], {
    stdio: "ignore",
  }).status === 0;
}

/** Compute the next version from `latest` for a bump kind. No latest → v1.0. */
export function bump(latest, kind) {
  const m = latest && latest.match(VERSION_RE);
  if (!m) return "v1.0";
  const major = Number(m[1]);
  const minor = Number(m[2]);
  return kind === "major" ? `v${major + 1}.0` : `v${major}.${minor + 1}`;
}

// ── Health / version ──────────────────────────────────────────────────────────
/** Read the version currently answering /api/health (null on any failure). */
export async function prodVersion(timeoutMs = 6000) {
  try {
    const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    const body = await res.json();
    return typeof body?.version === "string" ? body.version : null;
  } catch {
    return null;
  }
}

// ── GHCR (docker) helpers ─────────────────────────────────────────────────────
/** True when the LOCAL docker daemon can read `image` from its registry — a
 *  manifest-only probe, nothing is downloaded. Used to detect "not logged in
 *  to ghcr.io" BEFORE a pull fails with a misleading 401. */
export function canPullImage(image) {
  return spawnSync("docker", ["manifest", "inspect", image], { stdio: "ignore" }).status === 0;
}

/** Best-effort `docker login ghcr.io` using the operator's gh token (the image
 *  is private). Returns true on login success. Note: the gh token only grants
 *  registry read if it has the `read:packages` scope — the caller re-probes
 *  with `canPullImage` and degrades gracefully instead of trusting this. */
export function ghcrLogin(owner) {
  if (!has("docker")) return false;
  try {
    const token = capture("gh", ["auth", "token"]);
    if (!token) return false;
    const res = spawnSync("docker", ["login", "ghcr.io", "-u", owner, "--password-stdin"], {
      input: token,
      stdio: ["pipe", "ignore", "ignore"],
    });
    return res.status === 0;
  } catch {
    return false;
  }
}

// ── GitHub Actions run helpers ────────────────────────────────────────────────
/** Runs of `workflow` ainda vivos (queued/in_progress) — newest first. Used by
 *  `yarn make-tag` to avoid dispatching a DUPLICATE build: the git tag is only
 *  created at the END of a run, so a second dispatch mid-run computes the same
 *  version and dies with "tag já existe" (incidente 2026-07-09). */
export function runsInFlight(workflow) {
  try {
    const out = capture("gh", [
      "run",
      "list",
      `--workflow=${workflow}`,
      "-L",
      "10",
      "--json",
      "databaseId,status,displayTitle,createdAt",
    ]);
    const runs = JSON.parse(out || "[]");
    return runs.filter((r) => ["queued", "in_progress", "waiting", "requested"].includes(r.status));
  } catch {
    return [];
  }
}

/** databaseId of the newest run of `workflow`, or null if there are none. */
export function latestRunId(workflow) {
  try {
    const out = capture("gh", [
      "run",
      "list",
      `--workflow=${workflow}`,
      "-L",
      "1",
      "--json",
      "databaseId",
      "-q",
      ".[0].databaseId // empty",
    ]);
    return out || null;
  } catch {
    return null;
  }
}

/** Sleep helper (async, so we never block the event loop with a busy-wait). */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Setup/teardown steps we don't surface — keeps the live checklist to the
// meaningful stages (the named [n/n] steps, the boot-smoke, the push…).
const NOISE_STEP = /^(Set up job$|Complete job$|Post |Run [\w.@/-]+\/)/i;

/**
 * Follow a run LIVE. Prints each meaningful step as it finishes (`✓`/`✗`/`↷`,
 * with how long it took) and, crucially, shows an ANIMATED spinner + elapsed
 * timer on the step that is currently running — redrawn ~8×/s — so the terminal
 * NEVER looks frozen during a long step (e.g. the multi-minute boot-smoke build:
 * `⠹ Build (load local, sem push)… 2m15s`). Non-TTY (piped/CI) → no spinner,
 * just the plain completion lines. Falls back to `gh run watch` if the JSON view
 * is unavailable. Returns true when the run finished successfully.
 */
export async function followRun(runId) {
  const startAt = new Map(); // step key -> ts (for elapsed on start + completion)
  const finished = new Set();
  const isTty = stdout.isTTY && !process.env.NO_COLOR;
  const SPIN = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let current = null; // { name, at } — the step running right now
  let frame = 0;

  const fmt = (ms) => {
    const s = Math.round(ms / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, "0")}s`;
  };
  const clearLine = () => isTty && stdout.write("\r\x1b[2K");
  const tick = () => {
    if (!isTty || !current) return;
    frame = (frame + 1) % SPIN.length;
    stdout.write(
      `\r\x1b[2K${c.cyan(SPIN[frame])} ${current.name}${c.dim("…")} ${c.dim(fmt(Date.now() - current.at))}`
    );
  };
  // Heartbeat: keeps the "running" line alive so a long step never reads as a
  // freeze. unref() so this timer never keeps the process alive on its own.
  const spin = isTty ? setInterval(tick, 120) : null;
  if (spin && spin.unref) spin.unref();
  // Print a permanent line without leaving the transient spinner line behind.
  const emit = (fn, arg) => {
    clearLine();
    fn(arg);
  };

  try {
    // eslint-disable-next-line no-constant-condition
    for (;;) {
      let data;
      try {
        data = JSON.parse(
          capture("gh", ["run", "view", String(runId), "--json", "status,conclusion,jobs"])
        );
      } catch {
        clearLine();
        // JSON view unavailable → hand off to the built-in watcher.
        return stream("gh", ["run", "watch", String(runId), "--exit-status"]) === 0;
      }
      for (const job of data.jobs ?? []) {
        for (const step of job.steps ?? []) {
          if (NOISE_STEP.test(step.name)) continue;
          const key = `${job.name}#${step.number}`;
          if (step.status === "in_progress") {
            if (!startAt.has(key)) startAt.set(key, Date.now());
            current = { name: step.name, at: startAt.get(key) };
          }
          if (step.status === "completed" && !finished.has(key)) {
            finished.add(key);
            if (current && current.name === step.name) current = null;
            const el = startAt.has(key) ? ` ${c.dim(`(${fmt(Date.now() - startAt.get(key))})`)}` : "";
            if (step.conclusion === "success") emit(ok, `${step.name}${el}`);
            else if (step.conclusion === "skipped") emit(log, `${c.dim(`↷ ${step.name} (pulado)`)}`);
            else emit(err, `${step.name}${step.conclusion ? ` (${step.conclusion})` : ""}${el}`);
          }
        }
      }
      if (data.status === "completed") {
        clearLine();
        return data.conclusion === "success";
      }
      await sleep(2500);
    }
  } finally {
    if (spin) clearInterval(spin);
    clearLine();
  }
}

/**
 * Dispatch a workflow on `DEPLOY_REF` (default `main`) and follow it LIVE to
 * completion.
 * - `inputs`: array of `key=value` strings passed as `-f key=value`.
 * - Captures the latest run id BEFORE dispatch so it waits for a genuinely NEW
 *   run to appear (never watches a stale one), then streams the steps via
 *   `followRun`.
 * Returns `{ ok, runId }` — `runId` lets the caller pull the failure logs
 * (see `printRunFailureLogs`) so the error is registered in the console.
 */
export async function dispatchAndWatch(workflow, inputs = []) {
  const before = latestRunId(workflow);

  const args = ["workflow", "run", workflow, "--ref", DEPLOY_REF];
  for (const input of inputs) args.push("-f", input);
  const code = stream("gh", args);
  if (code !== 0) {
    err("Falha ao disparar o workflow no GitHub Actions.");
    return { ok: false, runId: null };
  }
  info("Disparado. Aguardando o run aparecer no GitHub…");

  // Poll for the new run id (GitHub takes a few seconds to create it).
  let runId = null;
  for (let i = 0; i < 20; i++) {
    await sleep(2000);
    const current = latestRunId(workflow);
    if (current && current !== before) {
      runId = current;
      break;
    }
  }
  if (!runId) {
    warn(
      `Não localizei o novo run em ~40s. Acompanhe manualmente:  gh run list --workflow=${workflow}`
    );
    return { ok: false, runId: null };
  }

  info(`Acompanhando o run ${runId} ao vivo (Ctrl-C aqui não cancela o run no GitHub)…`);
  hr();
  const ok = await followRun(runId);
  hr();
  return { ok, runId };
}

/**
 * On a failed run, pull the ROOT-CAUSE logs into this terminal so you can go
 * straight to analysis — no SSH, no browser. Extracts the meaningful lines
 * (crash stack, migration status, `::error::` annotations) from the run:
 * `--log-failed` covers both the build boot-smoke and the deploy cutover — each
 * dumps the container's logs ON the failed step (the runner is on the APP host,
 * so no SSH is involved). The full log is the fallback. Best-effort and always
 * prints how to see the full log.
 */
export function printRunFailureLogs(runId) {
  if (!runId) return;
  const CAUSE =
    /unregistered dependency|Error:|Exception|Restarting|Applying migration|No pending migrations|migration.*fail|Cannot find module|Stream isn't writeable|healthz|::error::|Exited|exit code/i;
  // gh --log lines are "<job>\t<step>\t<ISO-timestamp> <message>"; keep the msg,
  // dropping the leading timestamp and any ANSI colour codes from the echo.
  // eslint-disable-next-line no-control-regex
  const ANSI = /\x1b\[[0-9;]*m/g;
  const strip = (l) => {
    const parts = l.split("\t");
    const msg = parts.length >= 3 ? parts.slice(2).join(" ") : l;
    return msg.replace(/^\S+Z\s+/, "").replace(ANSI, "");
  };
  const grab = (viewArgs) => {
    try {
      const out = capture("gh", ["run", "view", String(runId), ...viewArgs], {
        maxBuffer: 128 * 1024 * 1024,
      });
      return out.split("\n").filter((l) => CAUSE.test(l)).map(strip);
    } catch {
      return [];
    }
  };

  hr();
  info(`Erro do run ${runId} (puxado pra cá pra análise):`);
  let lines = grab(["--log-failed"]);
  if (lines.length === 0) lines = grab(["--log"]);
  if (lines.length) {
    // Collapse runs of identical lines (e.g. 40× "curl 502") so the real signal
    // — the crash stack — isn't buried in noise. Keep the last chunk for brevity.
    const collapsed = [];
    for (const line of lines) {
      const last = collapsed[collapsed.length - 1];
      if (last && last.text === line) last.count++;
      else collapsed.push({ text: line, count: 1 });
    }
    log(
      collapsed
        .slice(-40)
        .map((e) => (e.count > 1 ? `${e.text}   ${c.dim(`(×${e.count})`)}` : e.text))
        .join("\n")
    );
  } else {
    warn("Não extraí o stack automaticamente — veja abaixo.");
  }
  hr();
  info(
    `Log completo:  ${c.bold(`gh run view ${runId} --log`)}   ·   navegador:  ${c.bold(`gh run view ${runId} --web`)}`
  );
}
