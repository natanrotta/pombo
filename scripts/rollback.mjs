#!/usr/bin/env node
// `yarn rollback` — reverte a API para uma versão anterior, de forma GUIADA.
//
// Diferente do `yarn deploy` (que oferece a versão mais nova), aqui a PRIMEIRA
// pergunta é QUAL versão ANTERIOR reenviar. Nada é automático: você escolhe a
// tag, confirma por seleção (o padrão é Cancelar), e o script dispara o
// deploy-api.yml com aquela tag — rollback é subir uma imagem vX.Y anterior (que
// já está no GHCR, sem rebuild) — e acompanha ao vivo. Se falhar, o erro do
// container é puxado pro seu terminal.
//
// Existe porque o deploy NÃO reverte sozinho: quando algo dá errado, você para,
// olha o erro e decide pra qual versão voltar. Este é o comando dessa decisão.

import {
  requireInteractive,
  requireGh,
  requireDeployTarget,
  prodVersion,
  fetchTags,
  recentTags,
  tagExists,
  isValidVersion,
  question,
  choose,
  confirm,
  confirmChoice,
  dispatchAndWatch,
  printRunFailureLogs,
  askClose,
  DEPLOY_WF,
  TAG_PICK_LIMIT,
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
  requireDeployTarget();
  const repo = requireGh();

  log(c.bold("\n↩️  Rollback da API (reenviar uma versão anterior)\n"));
  info(`Repo: ${repo}`);

  // Sincroniza os tags antes de montar o seletor, senão um checkout
  // desatualizado esconderia versões publicadas pelo CI.
  fetchTags();

  const running = await prodVersion();
  info(
    `Versão em produção agora: ${running ? c.cyan(running) : c.dim("desconhecida / prod fora")}`
  );

  const tags = recentTags();
  if (!tags.length) {
    fail("Não encontrei tags de versão (vX.Y). Gere uma com `yarn make-tag` antes de reverter.");
  }
  hr();

  // Pergunta principal: QUAL versão reenviar — já prontas para SELECIONAR.
  // Ofereço as `TAG_PICK_LIMIT` versões recentes (tirando a que está rodando —
  // reverter "pra ela mesma" não é rollback); a mais nova abaixo da atual é o
  // padrão. Digitar é só o escape para versões mais antigas.
  const selectable = tags.filter((t) => t !== running);
  const pick = selectable.slice(0, TAG_PICK_LIMIT);
  const rest = selectable.slice(TAG_PICK_LIMIT);

  const picks = pick.map((t, i) => ({
    value: t,
    label: t,
    hint: i === 0 ? (running ? "(mais recente abaixo da atual · padrão)" : "(mais recente · padrão)") : undefined,
  }));
  picks.push({ value: "__other__", label: "Outra versão (digitar o vX.Y)" });

  let tag = await choose("Qual versão você quer REENVIAR (rollback)?", picks);
  if (tag === "__other__") {
    if (rest.length) info(`Outras versões publicadas: ${rest.map((t) => c.cyan(t)).join(", ")}`);
    tag = (await question("Digite a versão (vX.Y)", pick[0] ?? tags[0] ?? "")).trim();
  }

  if (!isValidVersion(tag)) {
    fail(`Versão inválida: "${tag}". Use o formato vX.Y (ex.: v1.5).`);
  }
  if (!tagExists(tag)) {
    fail(
      `O tag ${tag} não existe — não há imagem publicada pra essa versão. Disponíveis: ${tags.join(", ")}.`
    );
  }
  if (running && tag === running) {
    if (!(await confirm(`${tag} já é a versão em produção. Reenviar mesmo assim?`))) {
      warn("Cancelado — nada foi disparado.");
      askClose();
      process.exit(1);
    }
  }

  hr();
  log(`Vou REVERTER produção para ${c.bold(c.green(tag))} (acompanho cada step ao vivo):`);
  if (running) log(c.dim(`  · produção sai de ${running} → ${tag}`));
  log(c.dim("  · cutover LOCAL no host de APP (runner self-hosted, sem SSH): pull da vX.Y + up --wait (drena as filas)"));
  log(c.dim("  · o container aplica as migrations pendentes no boot e verifico /api/health de fora"));
  warn("Migrations não são revertidas: a versão antiga precisa aceitar o schema atual (migrations aditivas).");
  log(c.dim("  · se falhar, mostro o erro aqui pra você escolher outra versão"));
  warn("As imagens antigas seguem no GHCR — rollback é subir uma delas, sem rebuild.");
  log("");

  // Confirmação por SELEÇÃO — produção não reverte num Enter acidental: o padrão
  // é Cancelar, pra reverter você escolhe a versão de propósito (setas + Enter).
  if (!(await confirmChoice(`Confirmar o rollback para ${tag}?`, `Reverter para ${tag}`))) {
    warn("Cancelado — nada foi disparado.");
    askClose();
    process.exit(1);
  }

  askClose();
  const { ok: success, runId } = await dispatchAndWatch(DEPLOY_WF, [`tag=${tag}`]);

  const now = await prodVersion();
  if (success) {
    ok(`Rollback confirmado — produção: ${c.dim(running ?? "?")} → ${c.bold(c.green(now ?? tag))}.`);
    process.exit(0);
  }
  // Falhou: registra o erro no console pra você decidir a próxima versão.
  printRunFailureLogs(runId);
  err(`Rollback para ${tag} NÃO confirmou. /api/health agora: ${now ?? "sem resposta"}.`);
  warn("Analise o erro acima e tente outra versão anterior:  " + c.bold("yarn rollback"));
  process.exit(1);
}

main().catch((error) => {
  askClose();
  err(`Erro inesperado: ${error?.message ?? error}`);
  process.exit(1);
});
