#!/usr/bin/env node
// `yarn deploy` — sobe uma versão da API em produção, sem entrar no servidor.
//
// Faz perguntas sobre qual versão subir, dispara o deploy no GitHub Actions
// (deploy-api.yml) — cutover LOCAL no host via runner self-hosted (sem SSH):
// `docker compose pull && up -d --wait` + VERIFICAÇÃO de fora da versão em
// /api/health — e acompanha o run até o fim, reportando ✅/❌ com veredito
// honesto (falhou sem tocar produção ≠ tocou e não confirmou).
// Rollback = escolher uma versão (vX.Y) anterior.
// Sem runner (offline/não registrado)? Plano B: `make deploy-direct TAG=…`.

import {
  requireInteractive,
  requireGh,
  requireDeployTarget,
  prodVersion,
  fetchTags,
  tagExists,
  isValidVersion,
  recentTags,
  question,
  choose,
  confirm,
  confirmChoice,
  has,
  stream,
  canPullImage,
  ghcrLogin,
  dispatchAndWatch,
  printRunFailureLogs,
  askClose,
  DEPLOY_WF,
  VERSION_RE,
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

/**
 * Boot smoke-test the EXACT image about to be deployed: spins up
 * docker-compose.smoke.yml (ephemeral Postgres+Redis), runs the image's
 * migrate-on-boot and waits for /healthz to answer. This is the honest
 * replacement for the old front-e2e gate — it validates the API artifact
 * (does it boot?), not an unrelated frontend suite. Optional/redundant: the
 * build already smoked it before publishing; this is a local pre-flight.
 * Returns true on a healthy boot (or when Docker is unavailable — degrade
 * gracefully, since the build gate already covered it).
 */
function runBootSmoke(image, owner) {
  if (!has("docker")) {
    warn("Docker não encontrado — pulando o smoke local (a imagem já passou no smoke do build).");
    return true;
  }
  // A imagem no GHCR é PRIVADA: sem login, o pull morre com um 401 que parece
  // "imagem quebrada" e induzia a furar o gate ("subir mesmo assim?"). Probe de
  // acesso primeiro; sem acesso, tenta logar com o token do gh; se ainda assim
  // não der (token sem read:packages), PULA o smoke com instrução clara — o
  // artefato já foi boot-verificado no build, o smoke local é redundante.
  if (!canPullImage(image)) {
    info("Docker local sem acesso à imagem (o GHCR é privado) — autenticando com o token do gh…");
    ghcrLogin(owner);
  }
  if (!canPullImage(image)) {
    warn(
      "Seu docker não tem acesso de leitura à imagem no GHCR — pulando o smoke local (a imagem já passou no boot-smoke do build)."
    );
    info(
      `Para habilitar o smoke local:  ${c.bold("gh auth refresh -h github.com -s read:packages")}  e rode de novo.`
    );
    return true;
  }
  info(`Verificando: boot smoke-test de ${c.cyan(image)} (sobe Postgres+Redis efêmeros, ~1-2min)…`);
  hr();
  const env = { ...process.env, API_IMAGE: image };
  const compose = ["compose", "-f", "docker-compose.smoke.yml"];
  const up = stream("docker", [...compose, "up", "--wait", "--wait-timeout", "180"], { env });
  if (up !== 0) {
    err("boot smoke-test: a imagem NÃO subiu. Últimos logs do container:");
    stream("docker", [...compose, "logs", "--tail=120", "api"], { env });
  }
  stream("docker", [...compose, "down", "-v"], { env }); // sempre derruba o stack efêmero
  hr();
  if (up === 0) {
    ok("boot smoke-test: a imagem sobe, migra e responde /healthz.");
    return true;
  }
  return false;
}

async function main() {
  requireInteractive();
  requireDeployTarget();
  const repo = requireGh();

  log(c.bold("\n🚀 Deploy da API em produção\n"));
  info(`Repo: ${repo}`);

  // Sincroniza os tags antes de montar o seletor + validar rollback, senão um
  // checkout desatualizado esconderia versões recém-publicadas pelo CI.
  fetchTags();

  const running = await prodVersion();
  info(`Versão em produção agora: ${running ? c.cyan(running) : c.dim("desconhecida")}`);
  if (!running) {
    warn(
      "Produção NÃO está respondendo /api/health — ela JÁ está fora do ar ANTES deste deploy (o veredito não terá sugestão automática de rollback)."
    );
  }

  const tags = recentTags();
  hr();

  // Menu: as versões vêm prontas para SELECIONAR — as `TAG_PICK_LIMIT` mais
  // recentes viram itens próprios, a mais nova é o padrão. Digitar é só o
  // escape para versões mais antigas ("Outra versão").
  //
  // A tag explícita (vX.Y) é o padrão: com ela o verify exige match EXATO em
  // /api/health. Com `latest` o verify só confere "alguma versão válida" —
  // aceita como escolha consciente, não como default.
  const pick = tags.slice(0, TAG_PICK_LIMIT);
  const rest = tags.slice(TAG_PICK_LIMIT);

  const choices = pick.map((t, i) => ({
    value: t,
    label:
      i === 0
        ? `${t} — última versão publicada · verificação EXATA`
        : `${t} — verificação EXATA da versão`,
    hint: i === 0 ? "(padrão)" : undefined,
  }));
  choices.push({
    value: "latest",
    label: "latest — a última imagem publicada",
    hint: pick.length ? "(o verify NÃO confere a versão exata)" : "(padrão)",
  });
  choices.push({ value: "specific", label: "Outra versão (vX.Y) — digitar manualmente" });

  let tag = await choose("Qual versão subir?", choices);
  if (tag === "specific") {
    if (rest.length) info(`Outras versões publicadas: ${rest.map((t) => c.cyan(t)).join(", ")}`);
    tag = (await question("Digite a versão (vX.Y)", pick[0] ?? "")).trim();
  }
  if (tag !== "latest") {
    if (!isValidVersion(tag)) {
      fail(`Versão inválida: "${tag}". Use o formato vX.Y (ex.: v1.4).`);
    }
    if (!tagExists(tag)) {
      fail(
        `O tag ${tag} não existe — não há imagem publicada para essa versão. Gere-a antes com \`yarn make-tag\`.`
      );
    }
  }

  // Trava de qualidade: a imagem que vai subir JÁ passou no boot smoke-test no
  // build (build-api.yml sobe a imagem real contra Postgres+Redis, roda o
  // migrate e exige /healthz ANTES de publicar). Então não há trava obrigatória
  // aqui — o deploy re-verifica /api/health e, se não confirmar, o rollback é
  // MANUAL (`yarn rollback`): o workflow nunca reverte sozinho. Opcionalmente o
  // operador pode re-rodar o smoke local do artefato exato.
  const owner = repo.split("/")[0];
  const image = `ghcr.io/${owner}/pombo-api:${tag}`;
  hr();
  info(
    `A imagem ${c.cyan(image)} já foi boot-verificada no build. O deploy re-verifica ` +
      `/api/health e, se não confirmar, te diz na hora o que aconteceu (rollback é MANUAL — 1 comando).`
  );
  if (await confirm("Rodar o boot smoke-test local do artefato antes de subir (opcional)?", false)) {
    if (!runBootSmoke(image, owner)) {
      if (!(await confirm("O boot smoke-test falhou. Subir em produção mesmo assim?"))) {
        warn("Cancelado — nada foi disparado.");
        askClose();
        process.exit(1);
      }
    }
  }

  // Rollback de verdade = a versão pedida é NUMERICAMENTE anterior à que roda.
  const verNum = (v) => {
    const m = typeof v === "string" ? v.match(VERSION_RE) : null;
    return m ? Number(m[1]) * 1000 + Number(m[2]) : null;
  };
  const isRollback =
    tag !== "latest" && verNum(tag) !== null && verNum(running) !== null && verNum(tag) < verNum(running);
  hr();
  log(`Vou subir ${c.bold(c.green(tag))} em produção (acompanho cada step ao vivo):`);
  log(c.dim("  · [1/4] pre-flight no host de APP: tag, API_URL, compose e .env.prod legível (falhou = PRODUÇÃO INTOCADA)"));
  log(c.dim("  · [2/4] pull da imagem no GHCR (falhou = PRODUÇÃO INTOCADA)"));
  log(c.dim("  · [3/4] cutover LOCAL (runner self-hosted, sem SSH): up --wait até HEALTHY — o antigo drena as filas, o novo migra no boot"));
  log(c.dim("  · [4/4] verifico, de fora, a versão em /api/health"));
  log(c.dim(`  · veredito honesto: sucesso · falhou SEM tocar produção · tocou e não confirmou (sugiro rollback p/ ${running ?? "a versão anterior"})`));
  if (isRollback) warn(`Isto é um ROLLBACK: produção sairia de ${running} para ${tag}.`);
  log("");

  // Confirmação por SELEÇÃO — produção não sobe num Enter acidental: o padrão é
  // Cancelar, pra subir você escolhe a tag de propósito (setas + Enter).
  if (!(await confirmChoice(`Confirmar o deploy de ${tag} em produção?`, `Subir ${tag}`))) {
    warn("Cancelado — nada foi disparado.");
    askClose();
    process.exit(1);
  }

  askClose();
  const { ok: success, runId } = await dispatchAndWatch(DEPLOY_WF, [`tag=${tag}`]);

  const now = await prodVersion();
  if (success) {
    ok(`Deploy confirmado — produção: ${c.dim(running ?? "?")} → ${c.bold(c.green(now ?? "?"))}.`);
    process.exit(0);
  }
  // Falhou: registra o ERRO no console (o veredito do run + stack do container,
  // quando houver) pra você partir direto pra análise — sem SSH, sem navegador.
  printRunFailureLogs(runId);
  err(`Deploy de ${tag} NÃO confirmado. /api/health agora: ${now ?? "sem resposta"} (era ${running ?? "desconhecida"}).`);
  // O veredito do run diz QUAL caso aconteceu — ecoa a leitura certa de cada um.
  warn(
    `Leia o veredito acima: ${c.bold("PRODUÇÃO INTOCADA")} = nada mudou (runner/infra → ` +
      `${c.bold("make runner-setup")} ou ${c.bold("make deploy-direct")}); "tocou produção" = ` +
      `considere reverter: ${c.bold("yarn rollback")}${running ? ` — sugestão: ${c.cyan(running)}` : ""}.`
  );
  process.exit(1);
}

main().catch((error) => {
  askClose();
  err(`Erro inesperado: ${error?.message ?? error}`);
  process.exit(1);
});
