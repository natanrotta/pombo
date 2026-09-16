#!/usr/bin/env bash
# infra/status-app.sh — snapshot de saúde do host de APP (API + Caddy + versão + gateway + túnel + disco).
#
# Responde "subiu? qual versão? tá saudável?" numa tela só. Read-only.
# Uso (da sua máquina):  make app-status        (repassa o API_URL do infra/deploy.env)
#      (no host):        API_URL=https://api.your-domain.tld bash /opt/pombo/app/infra/status-app.sh
#
# Par do infra/status.sh (que cobre o host de DATA: Postgres/Redis/backup).
set -uo pipefail

API_LOCAL="${API_LOCAL:-http://127.0.0.1:3333}"
# Base pública da API (sem /api/health). Vazio = pula a checagem de fora.
API_URL="${API_URL:-}"
API_URL="${API_URL%/}"

c_ok() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
c_no() { printf '  \033[31m✗\033[0m %s\n' "$1"; }
c_wn() { printf '  \033[33m!\033[0m %s\n' "$1"; }
jget() { sed -n "s/.*\"$1\":\"\([^\"]*\)\".*/\1/p"; }   # extrai "campo":"valor" (string) de JSON simples
jnum() { sed -n "s/.*\"$1\":\([0-9][0-9]*\).*/\1/p"; }     # extrai "campo":123 (número) de JSON simples

echo "================ POMBO · STATUS APP · $(date '+%F %T %Z') ================"

echo; echo "## Containers"
docker ps --filter "name=pombo-" --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null \
  || c_no "docker indisponível"

echo; echo "## Imagem da API"
IMG=$(docker inspect --format '{{.Config.Image}}' pombo-api 2>/dev/null)
[ -n "$IMG" ] && c_ok "imagem: $IMG" || c_no "container pombo-api não encontrado"

echo; echo "## API (local — $API_LOCAL)"
HZ=$(curl -fsS --max-time 5 "$API_LOCAL/healthz" 2>/dev/null | tr -d '\r\n')
[ "$HZ" = "ok" ] && c_ok "/healthz: ok" || c_no "/healthz não respondeu (resposta: ${HZ:-vazio})"
# /api/health = { ok, version, uptimeSeconds, gateway?: { devices: { total, connected } } }
HEALTH=$(curl -fsS --max-time 5 "$API_LOCAL/api/health" 2>/dev/null)
if [ -n "$HEALTH" ]; then
  VER=$(printf '%s' "$HEALTH" | jget version)
  UP=$(printf '%s' "$HEALTH" | jnum uptimeSeconds)
  c_ok "/api/health: version=${VER:-?} uptime=${UP:-?}s"
  [ "$VER" = "unknown" ] && c_wn "version='unknown' — imagem buildada sem APP_VERSION (build manual, não pelo CI)"
  if printf '%s' "$HEALTH" | grep -q '"gateway"'; then
    TOTAL=$(printf '%s' "$HEALTH" | jnum total)
    CONN=$(printf '%s' "$HEALTH" | jnum connected)
    c_ok "gateway WhatsApp: ${CONN:-?}/${TOTAL:-?} dispositivos conectados"
  else
    c_wn "gateway WhatsApp DESLIGADO (WHATSAPP_ENABLED=false no .env.prod)"
  fi
else
  c_no "/api/health não respondeu"
fi

echo; echo "## API (público — via Cloudflare)"
if [ -z "$API_URL" ]; then
  c_wn "API_URL não definido — pulei a checagem de fora (preencha infra/deploy.env)"
else
  PUB=$(curl -fsS --max-time 8 "$API_URL/api/health" 2>/dev/null)
  if [ -n "$PUB" ]; then
    PVER=$(printf '%s' "$PUB" | jget version)
    c_ok "$API_URL → version=${PVER:-?}"
  else
    c_wn "público não respondeu — checar Cloudflare/Caddy/cert"
  fi
fi

echo; echo "## Túnel WireGuard (→ host de DATA)"
if ip link show wg0 >/dev/null 2>&1; then
  ADDR=$(ip -4 -o addr show wg0 | awk '{print $4}')
  c_ok "wg0 UP — $ADDR"
  HS=$(wg show wg0 latest-handshakes 2>/dev/null | awk '{print $2}' | sort -rn | head -1)
  if [ "${HS:-0}" -gt 0 ] 2>/dev/null; then
    AGO=$(( $(date +%s) - HS )); c_ok "último handshake há ${AGO}s"
  else
    c_no "sem handshake — banco inacessível pelo túnel"
  fi
else
  c_no "wg0 AUSENTE — túnel não está no ar"
fi

echo; echo "## Disco"
df -h / | awk 'NR==1 || /\/$/{print "  "$0}'
USEP=$(df --output=pcent / | tail -1 | tr -dc '0-9')
if [ "${USEP:-0}" -ge 80 ]; then c_no "disco em ${USEP}% (acima de 80%!)"; else c_ok "disco em ${USEP}%"; fi

echo; echo "========================================================================"
