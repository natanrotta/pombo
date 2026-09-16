#!/usr/bin/env bash
# infra/app/setup-github-runner.sh — instala e registra o runner SELF-HOSTED do
# GitHub Actions no host de APP. O job de cutover do deploy-api.yml roda nele.
#
# Por quê: o cutover rodava via SSH runner→host:22, que passou a ser dropado
# upstream do host (incidente 2026-07-10) — e deploy + rollback morreram juntos.
# O runner inverte a direção: ele mora no host e faz conexão de SAÍDA pro GitHub,
# então firewall de entrada deixa de importar e a porta 22 pode ficar fechada
# ao mundo.
#
# Uso (da SUA máquina, 1x — APP_HOST e GH_REPO em infra/deploy.env):
#   make runner-setup
# que equivale a:
#   TOKEN=$(gh api -X POST repos/OWNER/REPO/actions/runners/registration-token -q .token)
#   { printf 'set -- %s %s\n' "$TOKEN" https://github.com/OWNER/REPO; cat infra/app/setup-github-runner.sh; } \
#     | ssh root@<APP_HOST> 'bash -s'
# (o token vai por stdin — nunca na linha de comando do ssh)
#
# O que faz (idempotente — re-rodar mantém um registro existente):
#   1. cria o usuário de serviço `ghrunner` e o coloca no grupo docker
#   2. baixa a última versão do actions/runner em /opt/pombo/gh-runner
#   3. registra no repo com o label `pombo-app` (runs-on: [self-hosted, pombo-app])
#   4. instala como serviço systemd (sobe sozinho no boot do host)
#   5. garante que o ghrunner consegue LER o .env.prod (env_file do compose)
#
# Conferir depois: https://github.com/OWNER/REPO/settings/actions/runners
set -euo pipefail

TOKEN="${1:?uso: setup-github-runner.sh <registration-token> <repo-url>}"
REPO_URL="${2:?uso: setup-github-runner.sh <registration-token> <repo-url> (ex.: https://github.com/OWNER/REPO)}"
RUNNER_DIR="/opt/pombo/gh-runner"
RUNNER_USER="ghrunner"
ENV_PROD="${ENV_PROD:-/opt/pombo/app/infra/.env.prod}"

echo "→ Usuário de serviço ${RUNNER_USER} (grupo docker)…"
id -u "$RUNNER_USER" >/dev/null 2>&1 \
  || useradd --system --create-home --home-dir "/home/$RUNNER_USER" --shell /bin/bash "$RUNNER_USER"
usermod -aG docker "$RUNNER_USER"

if [ -f "$RUNNER_DIR/.runner" ]; then
  echo "→ Runner já configurado em $RUNNER_DIR — mantendo o registro atual."
else
  echo "→ Baixando a última versão do actions/runner…"
  VER="$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest \
    | sed -n 's/.*"tag_name": *"v\([^"]*\)".*/\1/p')"
  [ -n "$VER" ] || { echo "✖ não consegui resolver a versão do runner"; exit 1; }
  echo "   actions/runner v${VER}"
  mkdir -p "$RUNNER_DIR"
  curl -fsSL -o /tmp/gh-runner.tar.gz \
    "https://github.com/actions/runner/releases/download/v${VER}/actions-runner-linux-x64-${VER}.tar.gz"
  tar -xzf /tmp/gh-runner.tar.gz -C "$RUNNER_DIR"
  rm -f /tmp/gh-runner.tar.gz
  # Dependências de sistema do runner (libicu etc.) — precisa de root.
  "$RUNNER_DIR/bin/installdependencies.sh" || true
  chown -R "$RUNNER_USER:$RUNNER_USER" "$RUNNER_DIR"

  echo "→ Registrando no repo (label: pombo-app)…"
  cd "$RUNNER_DIR"
  sudo -u "$RUNNER_USER" ./config.sh --url "$REPO_URL" --token "$TOKEN" \
    --name pombo-app --labels pombo-app --work _work --unattended --replace
fi

echo "→ Serviço systemd (sobe no boot)…"
cd "$RUNNER_DIR"
./svc.sh install "$RUNNER_USER" 2>/dev/null || true   # já instalado → segue
./svc.sh start 2>/dev/null || true                    # já rodando → segue
./svc.sh status | head -8 || true

# ── .env.prod legível pelo runner ────────────────────────────────────────────
# O cutover (deploy-api.yml) roda como ${RUNNER_USER}; `docker compose` precisa
# LER ../.env.prod (env_file) p/ passar as vars ao container. Sem este grant o
# container sobe SEM env e o boot falha. Idempotente. ⚠️ O grant se PERDE se o
# .env.prod for recriado (novo arquivo herda root:root 600) → re-rode
# `make runner-setup`; o pré-flight do deploy detecta e avisa antes de tocar prod.
echo "→ Grant de leitura do .env.prod ao ${RUNNER_USER}…"
if [ -f "$ENV_PROD" ]; then
  chgrp "$RUNNER_USER" "$ENV_PROD" && chmod 640 "$ENV_PROD"
  echo "   $ENV_PROD → grupo ${RUNNER_USER}, modo 640 (root rw · ${RUNNER_USER} r)."
else
  echo "   ! $ENV_PROD ainda não existe — crie-o e re-rode este setup (ou: chgrp ${RUNNER_USER} + chmod 640) antes do 1º deploy."
fi

echo "✅ Runner pronto. Confira 'Idle' em: ${REPO_URL}/settings/actions/runners"
