# Pombo — operações de infra de produção a partir da SUA máquina.
#
# A interface do dia a dia são QUATRO comandos guiados (perguntam, acompanham o
# run e verificam /api/health) — NÃO precisa deste Makefile pro fluxo normal:
#
#   yarn make-tag         gera a versão vX.Y (testes + boot-smoke → GHCR + git tag)
#   yarn deploy           sobe uma versão em produção e verifica /api/health
#   yarn rollback         reverte para uma versão anterior (guiado)
#   yarn monitor-status   saúde dos serviços (Backend · Banco · App · Site)
#
# Este Makefile é a camada AVANÇADA/rara por baixo deles: plano B do deploy (sem
# runner), setup do runner, SSH/logs/status dos hosts e backup.
#
# Requisitos:  gh (GitHub CLI autenticado: `gh auth login`) · ssh nos hosts
# Guia enxuto: DEPLOY.md · arquitetura + runbook: .claude/knowledge/devops.md

# ── Alvos (infra/deploy.env) ───────────────────────────────────────────────────
# Os hosts vêm do MESMO arquivo que os comandos yarn leem: infra/deploy.env
# (gitignored — copie de infra/deploy.env.example). Precedência: `make VAR=…` >
# variável exportada no shell > infra/deploy.env. O repo não traz host real: um
# alvo que precisa de host falha na hora se ele não estiver definido.
DEPLOY_ENV  ?= infra/deploy.env
DEPLOY_VARS := API_URL WEB_URL SITE_URL APP_HOST DATA_HOST SSH_USER GH_REPO IMAGE

# KEY=value do arquivo (última ocorrência), sem aspas nem comentário no fim. Só
# aceita [A-Za-z0-9._:/@-]: os valores entram em comandos de shell/ssh, então um
# valor com aspas, espaço, `;` ou `$` é descartado (o alvo falha como "não definido").
deploy_env_value = $(shell sed -n -e 's/^[[:space:]]*$(1)=//p' $(DEPLOY_ENV) | tail -n 1 | sed -e 's/[[:space:]]\#.*$$//' -e 's/^"\(.*\)"$$/\1/' | grep -E '^[A-Za-z0-9._:/@-]*$$')

ifneq ($(wildcard $(DEPLOY_ENV)),)
$(foreach v,$(DEPLOY_VARS),$(if $(filter environment% command%,$(origin $(v))),,$(eval $(v) := $(call deploy_env_value,$(v)))))
endif

TAG       ?= latest
APP_DIR   ?= /opt/pombo/app/infra/app
SSH_USER  := $(or $(strip $(SSH_USER)),root)
API_URL   := $(patsubst %/,%,$(strip $(API_URL)))
APP_HOST  := $(strip $(APP_HOST))
DATA_HOST := $(strip $(DATA_HOST))
GH_REPO   := $(strip $(GH_REPO))
GH_OWNER  := $(shell printf '%s' '$(firstword $(subst /, ,$(GH_REPO)))' | tr '[:upper:]' '[:lower:]')
# Mesma imagem que o build-api.yml publica: ghcr.io/<owner>/pombo-api.
IMAGE     := $(or $(strip $(IMAGE)),$(if $(GH_OWNER),ghcr.io/$(GH_OWNER)/pombo-api))
# Usuário do `docker login` = o owner do caminho da imagem.
IMAGE_OWNER := $(word 2,$(subst /, ,$(IMAGE)))

# Aborta o alvo (antes de qualquer ssh) quando uma variável obrigatória está vazia.
require = $(if $(strip $($(1))),,$(error $(1) não definido (ou inválido) — preencha $(DEPLOY_ENV) (modelo: infra/deploy.env.example) ou passe $(1)=…))

.DEFAULT_GOAL := help

# ── Redirecionamentos (memória muscular → comando guiado) ─────────────────────
# Sem `## ` de propósito: não aparecem no `make help`. Só apontam pro yarn certo.
.PHONY: deploy rollback build status version smoke
deploy rollback build:
	@echo "→ Use o comando guiado:  yarn $@   (o make $@ saiu — o fluxo agora é o yarn)"; exit 1
status version:
	@echo "→ Use:  yarn monitor-status   (substitui make status / make version)"; exit 1
smoke:
	@echo "→ O boot-smoke roda no build (yarn make-tag) e como opção no yarn deploy."; exit 1

# ── Deploy — plano B (sem runner self-hosted) ─────────────────────────────────
# Mesmo cutover do deploy-api.yml, via SSH: login no GHCR (token por stdin, nunca
# em argv), pull + up --wait e logout no fim (trap), para a credencial não ficar
# no host. Token: exporte GHCR_TOKEN com um PAT só de `read:packages` (preferido
# — menor raio de estrago); sem ele, usa o `gh auth token` da sua sessão (que
# precisa de read:packages: `gh auth refresh -s read:packages`).
.PHONY: deploy-direct
deploy-direct: ## Plano B sem Actions: cutover DIRETO via SSH (TAG=vX.Y|latest) + verify de fora.
	$(call require,APP_HOST)
	$(call require,IMAGE)
	$(call require,API_URL)
	@echo "🚚 Cutover direto de $(IMAGE):$(TAG) no host de APP ($(APP_HOST)) — sem GitHub Actions…"
	@printf '%s' "$${GHCR_TOKEN:-$$(gh auth token)}" | ssh $(SSH_USER)@$(APP_HOST) 'set -e; docker login ghcr.io -u $(IMAGE_OWNER) --password-stdin >/dev/null; trap "docker logout ghcr.io >/dev/null 2>&1" EXIT; cd $(APP_DIR); export API_IMAGE=$(IMAGE):$(TAG); docker compose -f docker-compose.prod.yml pull api; docker compose -f docker-compose.prod.yml up -d --wait --wait-timeout 300 api; docker image prune -f >/dev/null'
	@echo "→ Verificando de fora ($(API_URL)/api/health)…"; sleep 3; \
	BODY=$$(curl -fsS --max-time 8 $(API_URL)/api/health || true); echo "  $$BODY"; \
	if [ "$(TAG)" = "latest" ]; then echo "$$BODY" | grep -q '"ok":true'; else echo "$$BODY" | grep -q '"version":"$(TAG)"'; fi \
	  && echo "✅ Deploy direto confirmado." \
	  || { echo "❌ /api/health não confirmou ($(TAG)) — veja: make logs"; exit 1; }

.PHONY: runner-setup
runner-setup: ## Instala/registra o runner self-hosted do deploy no host de APP (1x; token via gh).
	$(call require,APP_HOST)
	$(call require,GH_REPO)
	@echo "🤖 Registrando o runner self-hosted (label pombo-app) em $(GH_REPO)…"
	@TOKEN=$$(gh api -X POST repos/$(GH_REPO)/actions/runners/registration-token -q .token) && \
	  { printf 'set -- %s %s\n' "$$TOKEN" "https://github.com/$(GH_REPO)"; cat infra/app/setup-github-runner.sh; } \
	  | ssh $(SSH_USER)@$(APP_HOST) 'bash -s'

# ── Status nos hosts (SSH — visão profunda; o `yarn monitor-status` é a visão rápida) ──
.PHONY: app-status
app-status: ## Status do host de APP: containers + imagem/versão + gateway + túnel + disco.
	$(call require,APP_HOST)
	@{ printf 'API_URL=%s\n' "$(API_URL)"; cat infra/status-app.sh; } | ssh $(SSH_USER)@$(APP_HOST) 'bash -s'

.PHONY: db-status
db-status: ## Status do host de DATA: Postgres + Redis + túnel + disco + backup.
	$(call require,DATA_HOST)
	@ssh $(SSH_USER)@$(DATA_HOST) 'bash -s' < infra/status.sh

# ── Logs (Ctrl-C p/ sair) ──────────────────────────────────────────────────────
.PHONY: logs
logs: ## Tail dos logs da API (host de APP).
	$(call require,APP_HOST)
	ssh -t $(SSH_USER)@$(APP_HOST) 'cd $(APP_DIR) && docker compose -f docker-compose.prod.yml logs -f --tail=100 api'

.PHONY: logs-caddy
logs-caddy: ## Tail dos logs do Caddy (host de APP).
	$(call require,APP_HOST)
	ssh -t $(SSH_USER)@$(APP_HOST) 'cd $(APP_DIR) && docker compose -f docker-compose.caddy.yml logs -f --tail=100 caddy'

# ── Shells ─────────────────────────────────────────────────────────────────────
.PHONY: ssh-app
ssh-app: ## Abre SSH no host de APP.
	$(call require,APP_HOST)
	ssh $(SSH_USER)@$(APP_HOST)

.PHONY: ssh-data
ssh-data: ## Abre SSH no host de DATA.
	$(call require,DATA_HOST)
	ssh $(SSH_USER)@$(DATA_HOST)

# ── Backup (host de DATA) ──────────────────────────────────────────────────────
# Setup de segredos (chave age, rclone R2, healthchecks.io) é manual — ver
# infra/backup/README.md. Estes alvos ligam/operam a automação depois disso.
.PHONY: backup-setup
backup-setup: ## Ativa o backup Nível 1 no host de DATA (scripts + systemd timers). Pré: /etc/pombo/backup.env preenchido.
	$(call require,DATA_HOST)
	ssh $(SSH_USER)@$(DATA_HOST) 'mkdir -p /opt/pombo/backup-src'
	scp infra/backup/*.sh $(SSH_USER)@$(DATA_HOST):/opt/pombo/backup-src/
	ssh $(SSH_USER)@$(DATA_HOST) 'bash /opt/pombo/backup-src/install-backup.sh'

.PHONY: backup-now
backup-now: ## Roda um backup AGORA no host de DATA (o agendado é 2x/dia) e mostra o log.
	$(call require,DATA_HOST)
	ssh $(SSH_USER)@$(DATA_HOST) 'systemctl start pombo-backup.service && sleep 2 && journalctl -u pombo-backup.service -n 25 --no-pager'

.PHONY: backup-status
backup-status: ## Timers (2x/dia + GFS) + contagem/últimos dumps no R2 (host de DATA).
	$(call require,DATA_HOST)
	ssh $(SSH_USER)@$(DATA_HOST) 'systemctl list-timers "pombo-backup*" --no-pager; echo; . /etc/pombo/backup.env 2>/dev/null && { echo "dumps em daily/: $$(rclone lsf "$${RCLONE_REMOTE:-r2}:$${RCLONE_BUCKET:-pombo-backups}/daily/" --files-only 2>/dev/null | grep -c .) (teto $${DAILY_RETENTION_COUNT:-5})"; rclone lsl "$${RCLONE_REMOTE:-r2}:$${RCLONE_BUCKET:-pombo-backups}/daily/" 2>/dev/null | tail -5; } || echo "(rclone/remote indisponível)"'

.PHONY: backup-check
backup-check: ## Confere a invariante de retenção no R2 (0<count<=N). Sai != 0 em erro.
	$(call require,DATA_HOST)
	ssh $(SSH_USER)@$(DATA_HOST) '. /etc/pombo/backup.env 2>/dev/null; /opt/pombo/backup-check.sh'

.PHONY: restore-drill
restore-drill: ## Ensaio de restauração LOCAL (não toca prod). Uso: make restore-drill AGE_KEY=/caminho/backup-age.key
	@[ -n "$(AGE_KEY)" ] || { echo "Informe a chave PRIVADA age: make restore-drill AGE_KEY=/caminho/backup-age.key"; exit 1; }
	AGE_KEY_FILE="$(AGE_KEY)" bash infra/backup/restore-drill.sh

# ── Help ───────────────────────────────────────────────────────────────────────
.PHONY: help
help: ## Lista os alvos disponíveis.
	@echo "Pombo — infra de produção (camada avançada). O fluxo normal é o yarn:"; \
	 echo "  yarn make-tag · yarn deploy · yarn rollback · yarn monitor-status"; echo
	@echo "Alvos deste Makefile (SSH/backup/plano B) — hosts em $(DEPLOY_ENV):"
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
	  | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'
