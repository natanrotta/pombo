#!/usr/bin/env node
// `yarn make-tag` — gera a tag da versão (vX.Y) e a publica.
//
// Faz perguntas sobre a versão e dispara o build no GitHub Actions
// (build-api.yml): roda os testes → builda a imagem no GHCR → cria o git tag
// vX.Y. Acompanha o run até o fim e reporta ✅/❌. Não faz deploy — para subir a
// versão em produção, use `yarn deploy`.

import {
  requireInteractive,
  requireGh,
  prodVersion,
  latestTag,
  tagExists,
  bump,
  isValidVersion,
  question,
  choose,
  confirm,
  confirmChoice,
  runCheck,
  runsInFlight,
  followRun,
  dispatchAndWatch,
  printRunFailureLogs,
  askClose,
  BUILD_WF,
  c,
  log,
  info,
  ok,
  warn,
  err,
  hr,
  fail,
} from "./lib/deploy-cli.mjs";

async function main() {
  requireInteractive();
  const repo = requireGh();

  log(c.bold("\n📦 Gerar tag de versão (build)\n"));
  info(`Repo: ${repo}`);

  // Já existe um build vivo? O git tag da versão só nasce no FIM do run, então
  // disparar OUTRO build agora quase sempre calcula a MESMA versão e morre com
  // "tag já existe" (o concurrency group serializa e o 2º run vê o tag do 1º).
  // O caminho certo é acompanhar o run que já está rodando.
  const inflight = runsInFlight(BUILD_WF);
  if (inflight.length) {
    const run = inflight[0];
    warn(
      `Já existe um build ${run.status === "queued" ? "NA FILA" : "EM ANDAMENTO"} (run ${c.cyan(run.databaseId)}). ` +
        `A versão dele só vira git tag no fim — disparar outro agora tende a colidir ("tag já existe").`
    );
    const action = await choose("O que você quer fazer?", [
      { value: "watch", label: `Acompanhar o run ${run.databaseId} ao vivo`, hint: "(padrão)" },
      { value: "new", label: "Disparar OUTRO build mesmo assim" },
      { value: "abort", label: "Cancelar" },
    ]);
    if (action === "abort") {
      warn("Cancelado — nada foi disparado.");
      askClose();
      process.exit(1);
    }
    if (action === "watch") {
      askClose();
      info(`Acompanhando o run ${run.databaseId} ao vivo (Ctrl-C aqui não cancela o run no GitHub)…`);
      hr();
      const good = await followRun(run.databaseId);
      hr();
      if (good) {
        ok(`Build em andamento terminou ✅ — a versão já está publicada. Para subir:  ${c.bold("yarn deploy")}.`);
        process.exit(0);
      }
      printRunFailureLogs(run.databaseId);
      err("O build em andamento FALHOU — veja o erro acima antes de gerar outra versão.");
      process.exit(1);
    }
    // action === "new": segue o fluxo normal (consciente do risco).
    hr();
  }

  const running = await prodVersion();
  info(`Versão em produção agora: ${running ? c.cyan(running) : c.dim("desconhecida")}`);

  const latest = latestTag();
  info(`Último tag de release: ${latest ? c.cyan(latest) : c.dim("nenhum")}`);
  hr();

  // Escolha do bump. As prévias mostram exatamente o que será criado.
  const kind = await choose("Que tipo de versão você quer gerar?", [
    { value: "minor", label: `Minor  → ${bump(latest, "minor")}`, hint: "(padrão)" },
    { value: "major", label: `Major  → ${bump(latest, "major")}` },
    { value: "custom", label: "Versão específica (digitar o vX.Y)" },
  ]);

  let target = kind === "custom" ? await question("Digite a versão (vX.Y)", "") : bump(latest, kind);
  target = target.trim();

  if (!isValidVersion(target)) {
    fail(`Versão inválida: "${target}". Use o formato vX.Y (ex.: v1.5).`);
  }
  if (tagExists(target)) {
    fail(`O tag ${target} já existe. Escolha outra versão (ou faça deploy dele com \`yarn deploy\`).`);
  }

  // Trava de testes: roda o unit do backend localmente antes de gastar um build.
  // (O build-api.yml revalida no passo [2/5] de qualquer forma — isto é o
  // fail-fast local.)
  hr();
  if (!runCheck("testes unitários do backend", "yarn", ["workspace", "@pombo/api", "test"])) {
    if (!(await confirm("Os testes do backend falharam. Gerar o build mesmo assim? (o CI vai revalidar)"))) {
      warn("Cancelado — nada foi disparado.");
      askClose();
      process.exit(1);
    }
  }

  hr();
  log(`Vou disparar o build da versão ${c.bold(c.green(target))} (acompanho cada step ao vivo):`);
  log(c.dim("  · testes do backend + type-check (trava 1)"));
  log(c.dim("  · builda a imagem e faz o BOOT-SMOKE: sobe + migra + /healthz (trava 2)"));
  log(c.dim(`  · só então publica no GHCR e cria o git tag ${target} (imagem que não boota não sobe)`));
  log("");

  if (!(await confirmChoice(`Confirmar a geração da versão ${target}?`, `Gerar ${target}`))) {
    warn("Cancelado — nada foi disparado.");
    askClose();
    process.exit(1);
  }

  askClose();
  const { ok: success, runId } = await dispatchAndWatch(BUILD_WF, [`version=${target}`]);

  if (success) {
    ok(`Versão ${c.bold(target)} publicada no GHCR e marcada como git tag.`);
    info(`Para subir em produção:  ${c.bold(`yarn deploy`)}  (e escolha ${target} ou "latest").`);
    process.exit(0);
  }
  // Registra o erro no console — ex.: o boot-smoke dumpa o stack do container
  // que não subiu (foi isso que teria mostrado o crash da v1.9 na hora).
  printRunFailureLogs(runId);
  err(`O build da versão ${target} NÃO foi confirmado. Veja os logs no GitHub Actions.`);
  process.exit(1);
}

main().catch((error) => {
  askClose();
  err(`Erro inesperado: ${error?.message ?? error}`);
  process.exit(1);
});
