#!/usr/bin/env bash
# infra/backup/backup-db.sh — roda no host de DATA via systemd timer (Backup Nível 1).
#
# Dump lógico do Postgres → criptografa client-side (age) → envia p/ R2/B2
# (offsite) → ping no dead-man switch. Ver install-backup.sh (timers) e
# infra/backup/README.md.
#
# Regra: o dump (contas, tokens, chaves de sessão do WhatsApp) NUNCA sai da
# máquina em claro. A chave PRIVADA age fica FORA deste host — aqui só usamos a
# chave PÚBLICA (recipient), que só cifra.
#
# Agenda: os systemd timers do install-backup.sh rodam este script 2x/dia
# (03:30 e 15:30). Alternativa por cron (crontab -e no host de DATA):
#   30 3,15 * * *  . /etc/pombo/backup.env && /opt/pombo/backup-db.sh >> /var/log/pombo-backup.log 2>&1
#
# Pré-requisitos: docker, age, rclone (remote 'r2' configurado), curl.

set -euo pipefail

# ── Config (sobrescreva via /etc/pombo/backup.env) ──────────────────────────
: "${PG_CONTAINER:=pombo-db}"
: "${PG_USER:=pombo}"
: "${PG_DB:=pombo}"
: "${AGE_RECIPIENT:?defina AGE_RECIPIENT (chave PÚBLICA age, ex: age1xxxx...)}"
: "${RCLONE_REMOTE:=r2}"
: "${RCLONE_BUCKET:=pombo-backups}"
: "${HC_PING_URL:?defina HC_PING_URL (healthchecks.io, ex: https://hc-ping.com/<uuid>)}"
: "${TMP_DIR:=/tmp}"
# Retenção do tier daily/: mantém só os N dumps mais recentes (count-based).
# A 2x/dia, 5 dumps = ~2,5 dias de histórico rolante. Weekly/monthly (GFS) são
# uma rede separada, promovida por backup-promote.sh — não contam neste limite.
: "${DAILY_RETENTION_COUNT:=5}"
# Sanidade: precisa ser inteiro >= 1 (senão a poda abaixo quebraria ou apagaria tudo).
case "${DAILY_RETENTION_COUNT}" in ''|*[!0-9]*) echo "[backup-db] ERRO: DAILY_RETENTION_COUNT='${DAILY_RETENTION_COUNT}' não é inteiro." >&2; exit 2 ;; esac
[ "${DAILY_RETENTION_COUNT}" -ge 1 ] || { echo "[backup-db] ERRO: DAILY_RETENTION_COUNT deve ser >= 1." >&2; exit 2; }

# Padrão dos nossos dumps (pombo-YYYYMMDD-HHMM.dump.age). A poda só considera/
# apaga arquivos que casam com isto — nunca mexe em objeto de nome inesperado.
DUMP_RE='^pombo-[0-9]{8}-[0-9]{4}\.dump\.age$'

STAMP="$(date -u +%Y%m%d-%H%M)"
FILE="pombo-${STAMP}.dump"
ENC="${FILE}.age"

# Sinaliza início ao dead-man switch (mede duração; opcional).
curl -fsS --retry 3 "${HC_PING_URL}/start" >/dev/null 2>&1 || true

# Garante limpeza dos temporários mesmo em falha.
cleanup() { rm -f "${TMP_DIR}/${FILE}" "${TMP_DIR}/${ENC}"; }
trap cleanup EXIT

# 1) dump custom-format (-Fc, compactado) de dentro do container
docker exec "${PG_CONTAINER}" pg_dump -U "${PG_USER}" -Fc "${PG_DB}" > "${TMP_DIR}/${FILE}"

# 2) criptografa ANTES de sair da máquina (privada guardada offsite)
age -r "${AGE_RECIPIENT}" -o "${TMP_DIR}/${ENC}" "${TMP_DIR}/${FILE}"
rm -f "${TMP_DIR}/${FILE}"

# 3) envia para o offsite (R2/B2)
rclone copy "${TMP_DIR}/${ENC}" "${RCLONE_REMOTE}:${RCLONE_BUCKET}/daily/"

# 4) retenção count-based: mantém só os N dumps mais recentes em daily/, apaga
#    os mais antigos. Os nomes (pombo-YYYYMMDD-HHMM.dump.age) ordenam
#    cronologicamente, então `sort` põe o mais antigo primeiro. Removemos os
#    (total - N) primeiros. Weekly/monthly (GFS) ficam intactos — outros prefixos.
#    O grep restringe aos NOSSOS dumps (nunca apaga objeto de nome inesperado).
mapfile -t ALL_DUMPS < <(rclone lsf "${RCLONE_REMOTE}:${RCLONE_BUCKET}/daily/" --files-only 2>/dev/null | grep -E "${DUMP_RE}" | sort)
TOTAL=${#ALL_DUMPS[@]}
if [ "${TOTAL}" -gt "${DAILY_RETENTION_COUNT}" ]; then
  REMOVE=$(( TOTAL - DAILY_RETENTION_COUNT ))
  for old in "${ALL_DUMPS[@]:0:REMOVE}"; do
    rclone deletefile "${RCLONE_REMOTE}:${RCLONE_BUCKET}/daily/${old}"
    echo "[backup-db] retencao: apagado dump antigo ${old}"
  done
fi

# 5) ping de SUCESSO no dead-man switch (se não chegar, healthchecks.io alerta)
curl -fsS --retry 3 "${HC_PING_URL}" >/dev/null

if [ "${TOTAL}" -eq 0 ]; then
  # lsf não retornou nada (ex.: falha transitória de rede) — o upload acima já
  # foi confirmado; só a contagem ficou indisponível. Não engana o operador.
  echo "[backup-db] ok: ${ENC} enviado -> ${RCLONE_REMOTE}:${RCLONE_BUCKET}/daily/ (contagem indisponível — lsf falhou?)"
else
  KEPT=$(( TOTAL > DAILY_RETENTION_COUNT ? DAILY_RETENTION_COUNT : TOTAL ))
  echo "[backup-db] ok: ${ENC} -> ${RCLONE_REMOTE}:${RCLONE_BUCKET}/daily/ (mantendo ${KEPT}/${DAILY_RETENTION_COUNT} dumps)"
fi
