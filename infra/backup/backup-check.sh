#!/usr/bin/env bash
# infra/backup/backup-check.sh — verifica a INVARIANTE de retenção do backup.
#
# Responde numa linha: "há a quantidade certa de dumps em daily/?". É o outro
# lado do controle count-based do backup-db.sh — enquanto o backup-db.sh PODA,
# este script CONFERE. Read-only: não apaga nem envia nada.
#
# Regra: manter os N (DAILY_RETENTION_COUNT, default 5) dumps mais recentes.
#   count == 0        → ERRO   (não há nenhum backup)
#   count  > N        → ERRO   (a poda falhou — mais dumps que o teto)
#   0 < count < N     → AVISO  (ainda aquecendo: < N runs, ou houve uma lacuna)
#   count == N        → OK     (estado estável)
#
# Freshness ("o último backup rodou a tempo?") é responsabilidade do dead-man
# switch (healthchecks.io) — não é reimplementado aqui.
#
# Uso no host de DATA (via systemd EnvironmentFile ou . backup.env):
#   . /etc/pombo/backup.env && /opt/pombo/backup-check.sh
# Saída != 0 em ERRO (serve de gate p/ automação).

set -euo pipefail

: "${RCLONE_REMOTE:=r2}"
: "${RCLONE_BUCKET:=pombo-backups}"
: "${DAILY_RETENTION_COUNT:=5}"
case "${DAILY_RETENTION_COUNT}" in ''|*[!0-9]*) echo "[backup-check] ERRO: DAILY_RETENTION_COUNT='${DAILY_RETENTION_COUNT}' não é inteiro."; exit 2 ;; esac
[ "${DAILY_RETENTION_COUNT}" -ge 1 ] || { echo "[backup-check] ERRO: DAILY_RETENTION_COUNT deve ser >= 1."; exit 2; }

command -v rclone >/dev/null 2>&1 || { echo "[backup-check] ERRO: rclone não instalado."; exit 2; }

# Conta só os NOSSOS dumps (pombo-YYYYMMDD-HHMM.dump.age) — ignora objeto de nome inesperado.
LIST="$(rclone lsf "${RCLONE_REMOTE}:${RCLONE_BUCKET}/daily/" --files-only 2>/dev/null | grep -E '^pombo-[0-9]{8}-[0-9]{4}\.dump\.age$' | sort || true)"
if [ -n "${LIST}" ]; then
  COUNT="$(printf '%s\n' "${LIST}" | grep -c . || true)"
else
  COUNT=0
fi

DEST="${RCLONE_REMOTE}:${RCLONE_BUCKET}/daily/"

if [ "${COUNT}" -eq 0 ]; then
  echo "[backup-check] ✗ ERRO: nenhum dump em ${DEST} — o backup não está gerando/enviando."
  exit 1
elif [ "${COUNT}" -gt "${DAILY_RETENTION_COUNT}" ]; then
  echo "[backup-check] ✗ ERRO: ${COUNT} dumps em ${DEST} (teto ${DAILY_RETENTION_COUNT}) — a poda count-based falhou."
  exit 1
elif [ "${COUNT}" -lt "${DAILY_RETENTION_COUNT}" ]; then
  echo "[backup-check] ! AVISO: ${COUNT}/${DAILY_RETENTION_COUNT} dumps em ${DEST} — aquecendo ou houve lacuna."
  echo "[backup-check]   mais recente: $(printf '%s\n' "${LIST}" | tail -1)"
  exit 0
else
  echo "[backup-check] ✓ OK: ${COUNT}/${DAILY_RETENTION_COUNT} dumps em ${DEST} (retenção estável)."
  echo "[backup-check]   mais recente: $(printf '%s\n' "${LIST}" | tail -1)"
  exit 0
fi
