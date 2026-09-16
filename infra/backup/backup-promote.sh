#!/usr/bin/env bash
# infra/backup/backup-promote.sh — retenção GFS (Grandfather-Father-Son).
#
# Copia o dump diário mais recente para weekly/ ou monthly/ e poda o tier.
# Mantém 4 semanais (28d) e 12 mensais (365d). O daily/ é podado pelo próprio
# backup-db.sh (os DAILY_RETENTION_COUNT dumps mais recentes).
#
# Agenda: os systemd timers do install-backup.sh (domingo 04:00 · dia 1 05:00).
# Alternativa por cron (host de DATA):
#   semanal:  0 4 * * 0  . /etc/pombo/backup.env && /opt/pombo/backup-promote.sh weekly  >> /var/log/pombo-backup.log 2>&1
#   mensal:   0 5 1 * *  . /etc/pombo/backup.env && /opt/pombo/backup-promote.sh monthly >> /var/log/pombo-backup.log 2>&1

set -euo pipefail

: "${RCLONE_REMOTE:=r2}"
: "${RCLONE_BUCKET:=pombo-backups}"
TIER="${1:?uso: backup-promote.sh <weekly|monthly>}"

case "${TIER}" in
  weekly)  RETENTION="28d" ;;
  monthly) RETENTION="365d" ;;
  *) echo "tier invalido: ${TIER} (use weekly|monthly)"; exit 1 ;;
esac

# Dump diário mais recente (nomes são ordenáveis: pombo-YYYYMMDD-HHMM.dump.age).
# Mesmo filtro do backup-db.sh/backup-check.sh: só promove os NOSSOS dumps.
DUMP_RE='^pombo-[0-9]{8}-[0-9]{4}\.dump\.age$'
LATEST="$(rclone lsf "${RCLONE_REMOTE}:${RCLONE_BUCKET}/daily/" --files-only | grep -E "${DUMP_RE}" | sort | tail -1 || true)"
[ -n "${LATEST}" ] || { echo "nenhum dump em daily/ para promover"; exit 1; }

rclone copyto "${RCLONE_REMOTE}:${RCLONE_BUCKET}/daily/${LATEST}" \
              "${RCLONE_REMOTE}:${RCLONE_BUCKET}/${TIER}/${LATEST}"
rclone delete "${RCLONE_REMOTE}:${RCLONE_BUCKET}/${TIER}/" --min-age "${RETENTION}"

echo "[backup-promote] ${LATEST} -> ${TIER}/ (retencao ${RETENTION})"
