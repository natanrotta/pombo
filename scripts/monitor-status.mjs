#!/usr/bin/env node
// `yarn monitor-status` — a saúde da produção numa tela só, sem entrar no servidor.
// Consulta os serviços em paralelo e imprime um painel alinhado:
//
//   Backend  → GET /api/health           versão · estável · uptime · gateway · migrations
//   Banco    → SSH no host de DATA        status · migração · versão
//   App      → GET WEB_URL/version.json   status · versão
//   Site     → GET SITE_URL/              status
//
// Alvos em infra/deploy.env (ou no shell). Um alvo não definido é PULADO — nunca
// sondamos uma URL vazia nem fazemos ssh para um host em branco.
//
// Por que SSH no Banco? /api/health omite de propósito os internos do banco
// (migrations, versão do Postgres) — expô-los sem auth seria fingerprint. O
// caminho tokenless e já autorizado é o SSH no host de DATA (o mesmo do
// `make db-status`). Sem SSH, o bloco degrada: infere "no ar" pelo /api/health.
//
// Read-only: não dispara deploy, não escreve nada. Sai 0 quando os serviços
// críticos configurados (Backend + Banco) estão no ar; 1 caso contrário.

import { spawn } from "node:child_process";
import {
  API_URL,
  HEALTH_URL,
  WEB_URL,
  SITE_URL,
  DATA_HOST,
  SSH_USER,
  recentTags,
  VERSION_RE,
  c,
  log,
} from "./lib/deploy-cli.mjs";

// ── Formatters ────────────────────────────────────────────────────────────────
const stripScheme = (url) => url.replace(/^https?:\/\//, "");

/** Uptime em segundos → "3d 4h", "2h 15m", "22m 20s", "45s". */
function fmtUptime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return "?";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

/** ISO timestamp → "há 3h" / "há 12min" / "agora há pouco" (null se inválido). */
function fmtAgo(iso) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const sec = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (sec < 90) return "agora há pouco";
  const min = Math.round(sec / 60);
  if (min < 90) return `há ${min}min`;
  const hr = Math.round(min / 60);
  if (hr < 36) return `há ${hr}h`;
  return `há ${Math.round(hr / 24)}d`;
}

/** vX.Y → número comparável (v1.12 → 1012), ou null. */
const verNum = (v) => {
  const m = typeof v === "string" ? v.match(VERSION_RE) : null;
  return m ? Number(m[1]) * 1000 + Number(m[2]) : null;
};

// ── HTTP probe ────────────────────────────────────────────────────────────────
/** GET com timeout. Retorna { up, status, ms, body } — body é JSON quando pedido
 *  e parseável, senão null. Nunca lança: erro/timeout viram { up:false }. */
async function probe(url, { timeoutMs = 8000, json = false } = {}) {
  const t0 = performance.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
    const ms = Math.round(performance.now() - t0);
    let body = null;
    if (json) {
      try {
        body = await res.json();
      } catch {
        body = null;
      }
    }
    return { up: res.ok, status: res.status, ms, body };
  } catch {
    return { up: false, status: 0, ms: Math.round(performance.now() - t0), body: null };
  }
}

/** Frontend: tenta o /version.json (dá liveness + versão de uma vez); se ele não
 *  existir (site) ou não for JSON válido, cai pro root só pra medir "no ar". */
async function frontendProbe(base, { versioned }) {
  if (versioned) {
    const v = await probe(`${base}/version.json`, { json: true, timeoutMs: 8000 });
    if (v.up && v.body && typeof v.body.commit === "string") {
      return { up: true, status: v.status, ms: v.ms, version: v.body };
    }
  }
  const r = await probe(base, { timeoutMs: 8000 });
  return { up: r.up, status: r.status, ms: r.ms, version: null };
}

// ── SSH probe (Banco) ─────────────────────────────────────────────────────────
// Roda um script curto no host de DATA e emite `chave=valor` parseável. Hardcode dos
// nomes de container/credenciais = os mesmos defaults do infra/status.sh.
const DB_REMOTE = `set -uo pipefail
PG_CONTAINER=pombo-db
PG_USER=pombo
PG_DB=pombo
q(){ docker exec "$PG_CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -tAc "$1" 2>/dev/null; }
if docker exec "$PG_CONTAINER" pg_isready -U "$PG_USER" -d "$PG_DB" >/dev/null 2>&1; then
  echo "reachable=1"
  echo "pg_version=$(q 'show server_version;')"
  if [ "$(q "select to_regclass('public._prisma_migrations') is not null;")" = "t" ]; then
    echo "applied=$(q 'select count(*) from _prisma_migrations where finished_at is not null;')"
    echo "pending=$(q 'select count(*) from _prisma_migrations where finished_at is null;')"
    echo "last=$(q 'select migration_name from _prisma_migrations where finished_at is not null order by finished_at desc limit 1;')"
  else
    echo "migrations=absent"
  fi
else
  echo "reachable=0"
fi`;

/** SSH no host de DATA e lê o Postgres. Nunca lança: sem chave/host/timeout →
 *  { ssh:false }. BatchMode=yes garante que nunca trava pedindo senha. */
function dbProbe({ timeoutMs = 12000 } = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(
        "ssh",
        [
          "-o",
          "BatchMode=yes",
          "-o",
          "ConnectTimeout=5",
          "-o",
          "StrictHostKeyChecking=accept-new",
          `${SSH_USER}@${DATA_HOST}`,
          "bash -s",
        ],
        { stdio: ["pipe", "pipe", "ignore"] }
      );
    } catch {
      return resolve({ ssh: false });
    }

    let out = "";
    let done = false;
    const finish = (val) => {
      if (done) return;
      done = true;
      resolve(val);
    };
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* já morreu */
      }
      finish({ ssh: false });
    }, timeoutMs);
    if (timer.unref) timer.unref();

    child.on("error", () => {
      clearTimeout(timer);
      finish({ ssh: false }); // ssh não instalado / não resolvível
    });
    child.stdout.on("data", (d) => (out += d));
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0 || !out.trim()) return finish({ ssh: false });
      const kv = {};
      for (const line of out.split("\n")) {
        const i = line.indexOf("=");
        if (i > 0) kv[line.slice(0, i).trim()] = line.slice(i + 1).trim();
      }
      finish({ ssh: true, ...kv });
    });

    child.stdin.on("error", () => { }); // EPIPE se o ssh morrer antes de ler o stdin
    child.stdin.write(DB_REMOTE);
    child.stdin.end();
  });
}

// ── Rendering ─────────────────────────────────────────────────────────────────
const GREEN_DOT = c.green("●");
const RED_DOT = c.red("●");
const YELLOW_DOT = c.yellow("●");
const KEY_W = 11; // largura da coluna de rótulos (alinhamento)
const row = (key, value) => log(`     ${c.dim(key.padEnd(KEY_W))} ${value}`);

/** Serviço sem alvo configurado — pulado, sem probe. */
function skipped(name, varName) {
  log("");
  log(`  ${c.bold(name.padEnd(9))} ${c.dim(`${varName} não definido — pulado`)}`);
}

/** Cabeçalho + linha de status de um serviço. `meta` é o "HTTP 200 · 149ms". */
function head(name, target, dot, label, meta) {
  log("");
  log(`  ${c.bold(name.padEnd(9))} ${c.dim(target)}`);
  log(`  ${dot} ${label}${meta ? `   ${c.dim(meta)}` : ""}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  log(c.bold("\n📊  Pombo — status de produção"));

  // No targets configured → nothing to monitor. The repo ships them EMPTY on
  // purpose so it never probes/SSHes into an unrelated host. Configure and retry.
  if (!API_URL && !WEB_URL && !SITE_URL && !DATA_HOST) {
    log("");
    log(`  ${c.yellow("!")} Monitoramento não configurado.`);
    log(
      c.dim(
        "    Preencha API_URL / WEB_URL / SITE_URL / DATA_HOST em infra/deploy.env (modelo: infra/deploy.env.example).",
      ),
    );
    log("");
    process.exit(0);
  }

  const t0 = performance.now();
  // Última versão publicada (tags locais, sem rede) — pra sinalizar drift no
  // Backend. Best-effort: se não houver tags, simplesmente não mostra o aviso.
  let localLatest = null;
  try {
    localLatest = recentTags(1)[0] ?? null;
  } catch {
    localLatest = null;
  }

  // Todos os probes em paralelo — o SSH (mais lento) não serializa os HTTP.
  // Alvo não definido = probe pulado (null).
  const [api, app, site, db] = await Promise.all([
    HEALTH_URL ? probe(HEALTH_URL, { json: true, timeoutMs: 8000 }) : null,
    WEB_URL ? frontendProbe(WEB_URL, { versioned: true }) : null,
    SITE_URL ? frontendProbe(SITE_URL, { versioned: false }) : null,
    DATA_HOST ? dbProbe() : { ssh: false },
  ]);

  // ── Backend ──────────────────────────────────────────────────────────────
  const apiBody = api?.body ?? {};
  const apiOk = Boolean(api?.up && apiBody.ok === true);
  if (!api) {
    skipped("Backend", "API_URL");
  } else {
    head(
      "Backend",
      stripScheme(HEALTH_URL),
      apiOk ? GREEN_DOT : RED_DOT,
      apiOk ? c.bold(c.green("ONLINE")) : c.bold(c.red("OFFLINE")),
      api.status ? `HTTP ${api.status} · ${api.ms}ms` : `sem resposta · ${api.ms}ms`
    );
  }
  if (apiOk) {
    const running = typeof apiBody.version === "string" ? apiBody.version : "desconhecida";
    const rn = verNum(running);
    const ln = verNum(localLatest);
    let drift = "";
    if (rn !== null && ln !== null) {
      if (rn >= ln) drift = c.dim(" · última publicada");
      else drift = c.yellow(` · desatualizada (última: ${localLatest})`);
    }
    row("versão", `${c.cyan(running)}${drift}`);
    row("estável", c.green("sim"));
    row("uptime", fmtUptime(apiBody.uptimeSeconds));
    // gateway: ausente = WHATSAPP_ENABLED=false (em produção deveria estar ligado).
    const devices = apiBody.gateway?.devices;
    row(
      "gateway",
      devices
        ? `${c.cyan(`${devices.connected}/${devices.total}`)} ${c.dim("dispositivos conectados")}`
        : c.yellow("desligado (WHATSAPP_ENABLED=false)")
    );
    // migrations: fonte de verdade é o SSH; sem ele, infere do boot healthy
    // (o container só fica healthy DEPOIS do prisma migrate deploy no boot).
    if (db.ssh && db.reachable === "1" && db.applied !== undefined) {
      const pending = Number(db.pending ?? 0);
      row(
        "migrations",
        pending > 0
          ? c.yellow(`! ${pending} pendentes (${db.applied} aplicadas)`)
          : c.green(`✓ em dia · 0 pendentes`)
      );
    } else if (db.ssh && db.migrations === "absent") {
      row("migrations", c.yellow("! sem _prisma_migrations (nunca migrou)"));
    } else {
      row("migrations", `${c.green("✓")} aplicadas ${c.dim("(inferido do boot healthy)")}`);
    }
  } else if (api) {
    row("erro", c.red("a API não confirmou /api/health — produção pode estar fora"));
  }

  // ── Banco ────────────────────────────────────────────────────────────────
  if (!DATA_HOST && !api) {
    skipped("Banco", "DATA_HOST");
  } else if (db.ssh && db.reachable === "1") {
    head("Banco", `host de DATA ${DATA_HOST} · via SSH`, GREEN_DOT, c.bold(c.green("NO AR")), null);
    row("status", "aceitando conexões");
    if (db.migrations === "absent") {
      row("migração", c.yellow("sem _prisma_migrations (a API ainda não migrou)"));
    } else {
      const pending = Number(db.pending ?? 0);
      const counts =
        pending > 0
          ? c.yellow(`${db.applied} aplicadas · ${pending} pendentes`)
          : c.dim(`${db.applied} aplicadas · 0 pendentes`);
      row("migração", `${c.cyan(db.last || "—")}  ${counts}`);
    }
    // server_version vem como "15.18 (Debian …)" — fica só o número.
    const pgNum = db.pg_version ? db.pg_version.split(" ")[0] : null;
    row("versão", pgNum ? `PostgreSQL ${pgNum}` : "PostgreSQL ?");
  } else if (db.ssh && db.reachable === "0") {
    head("Banco", `host de DATA ${DATA_HOST} · via SSH`, RED_DOT, c.bold(c.red("FORA")), null);
    row("status", c.red("Postgres não responde (pg_isready falhou)"));
  } else {
    // Sem SSH (ou DATA_HOST não definido): infere pelo Backend (a API não sobe
    // healthy sem o banco).
    const inferred = apiOk;
    head(
      "Banco",
      DATA_HOST ? `host de DATA ${DATA_HOST}` : "DATA_HOST não definido",
      inferred ? YELLOW_DOT : RED_DOT,
      inferred ? c.bold(c.yellow("NO AR (inferido)")) : c.bold(c.red("DESCONHECIDO")),
      DATA_HOST ? "SSH indisponível" : null
    );
    row(
      "status",
      inferred
        ? "no ar — inferido do /api/health (a API não sobe sem o banco)"
        : c.red("sem SSH e a API não respondeu — não dá pra inferir")
    );
    row("migração", c.dim("— (requer SSH no host de DATA)"));
    row("versão", c.dim("— (requer SSH no host de DATA)"));
  }

  // ── App / Site ────────────────────────────────────────────────────────────
  const frontend = (name, base, res, varName) => {
    if (!res) return skipped(name, varName);
    head(
      name,
      stripScheme(base),
      res.up ? GREEN_DOT : RED_DOT,
      res.up ? c.bold(c.green("ONLINE")) : c.bold(c.red("OFFLINE")),
      res.status ? `HTTP ${res.status} · ${res.ms}ms` : `sem resposta · ${res.ms}ms`
    );
    if (res.version) {
      const sha = String(res.version.commit).slice(0, 7);
      const branch = res.version.branch && res.version.branch !== "unknown" ? res.version.branch : null;
      const ago = res.version.builtAt ? fmtAgo(res.version.builtAt) : null;
      const extra = [branch, ago].filter(Boolean).join(" · ");
      row("versão", `${c.cyan(sha)}${extra ? c.dim(` · ${extra}`) : ""}`);
    } else if (res.up) {
      row("versão", c.dim(name === "Site" ? "— (site não publica version.json)" : "— (sem version.json)"));
    }
  };
  frontend("App", WEB_URL, app, "WEB_URL");
  frontend("Site", SITE_URL, site, "SITE_URL");

  // ── Rodapé ───────────────────────────────────────────────────────────────
  // Só entram na conta os serviços configurados. O Banco conta se houver
  // DATA_HOST ou, na falta dele, pela inferência do Backend — nesse caso os dois
  // itens críticos refletem o MESMO probe (/api/health), de propósito.
  const services = [
    api && { ok: apiOk, critical: true },
    (DATA_HOST || api) && { ok: db.ssh ? db.reachable === "1" : apiOk, critical: true },
    app && { ok: app.up, critical: false },
    site && { ok: site.up, critical: false },
  ].filter(Boolean);
  const upCount = services.filter((s) => s.ok).length;
  const criticalDown = services.some((s) => s.critical && !s.ok);
  const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
  log("");
  if (upCount === services.length) {
    log(`  ${c.green("✨ tudo no ar")} ${c.dim(`· ${upCount}/${services.length} · ${elapsed}s`)}`);
  } else {
    const mark = criticalDown ? c.red("✖") : c.yellow("!");
    log(`  ${mark} ${upCount}/${services.length} no ar ${c.dim(`· ${elapsed}s`)}`);
  }
  log("");
  process.exit(criticalDown ? 1 : 0);
}

main().catch((error) => {
  console.error(`${c.red("✖")} Erro inesperado: ${error?.message ?? error}`);
  process.exit(1);
});
