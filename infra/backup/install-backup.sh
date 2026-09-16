#!/usr/bin/env bash
# infra/backup/install-backup.sh — ATIVA o backup Nível 1 no host de DATA.
#
# Idempotente. Roda como root NO host de DATA (via `make backup-setup` do laptop):
#   1) checa pré-requisitos (docker, age, rclone, curl, systemctl)
#   2) valida /etc/pombo/backup.env (copie do backup.env.example e preencha)
#   3) instala os scripts em /opt/pombo/
#   4) instala + habilita os systemd timers (backup 2x/dia + promote weekly/monthly)
#
# NÃO gera a chave age nem configura o rclone — isso é setup de SEGREDO, manual
# (ver infra/backup/README.md). Este script só liga a automação.

set -euo pipefail

SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE=/etc/pombo/backup.env
BIN_DIR=/opt/pombo
UNIT_DIR=/etc/systemd/system

log() { printf '\033[36m[install-backup]\033[0m %s\n' "$*"; }
die() { printf '\033[31m[install-backup] ERRO:\033[0m %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "rode como root (no host de DATA)."

# 1) pré-requisitos
log "checando pré-requisitos…"
for bin in docker age rclone curl systemctl; do
  command -v "$bin" >/dev/null 2>&1 || die "falta '$bin' — instale antes (ver README)."
done

# 2) config + segredos já configurados
[ -f "$ENV_FILE" ] || die "$ENV_FILE não existe. Copie infra/backup/backup.env.example → $ENV_FILE, preencha e chmod 600."
# shellcheck disable=SC1090
. "$ENV_FILE"
: "${AGE_RECIPIENT:?defina AGE_RECIPIENT em $ENV_FILE}"
: "${HC_PING_URL:?defina HC_PING_URL em $ENV_FILE}"
: "${RCLONE_REMOTE:=r2}"
: "${RCLONE_BUCKET:=pombo-backups}"
# Valida acessando o BUCKET (lsf), não a conta (lsd) — um token R2 escopado por
# bucket (least-privilege) não pode listar a conta e daria 403 no lsd.
rclone lsf "${RCLONE_REMOTE}:${RCLONE_BUCKET}/" >/dev/null 2>&1 \
  || die "remote/bucket rclone '${RCLONE_REMOTE}:${RCLONE_BUCKET}' não responde — rode 'rclone config' (Cloudflare R2) e confira o bucket + 'no_check_bucket = true'."
docker inspect "${PG_CONTAINER:-pombo-db}" >/dev/null 2>&1 \
  || die "container '${PG_CONTAINER:-pombo-db}' não existe aqui — este script roda no host de DATA."
log "config OK (recipient age · remote ${RCLONE_REMOTE}:${RCLONE_BUCKET} · dead-man switch)."

# 3) scripts
log "instalando scripts em $BIN_DIR…"
install -d "$BIN_DIR"
for s in backup-db.sh backup-promote.sh restore-drill.sh backup-check.sh; do
  install -m 0755 "$SRC_DIR/$s" "$BIN_DIR/$s"
done

# 4) systemd units
log "instalando systemd timers…"

cat > "$UNIT_DIR/pombo-backup.service" <<'UNIT'
[Unit]
Description=Pombo — dump 2x/dia criptografado do Postgres -> R2 (backup Nível 1)
Wants=network-online.target docker.service
After=network-online.target docker.service

[Service]
Type=oneshot
EnvironmentFile=/etc/pombo/backup.env
ExecStart=/opt/pombo/backup-db.sh
Nice=10
UNIT

cat > "$UNIT_DIR/pombo-backup.timer" <<'UNIT'
[Unit]
Description=Pombo — agenda o backup do Postgres 2x/dia (03:30 e 15:30)

[Timer]
# Duas execuções por dia apontando para o MESMO pombo-backup.service.
OnCalendar=*-*-* 03:30:00
OnCalendar=*-*-* 15:30:00
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target
UNIT

# Promote (GFS) — service templado; %i = weekly|monthly.
cat > "$UNIT_DIR/pombo-backup-promote@.service" <<'UNIT'
[Unit]
Description=Pombo — promove backup diário -> %i (retenção GFS)
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
EnvironmentFile=/etc/pombo/backup.env
ExecStart=/opt/pombo/backup-promote.sh %i
UNIT

cat > "$UNIT_DIR/pombo-backup-promote@weekly.timer" <<'UNIT'
[Unit]
Description=Pombo — agenda a promoção semanal (domingo 04:00)

[Timer]
OnCalendar=Sun *-*-* 04:00:00
Persistent=true
Unit=pombo-backup-promote@weekly.service

[Install]
WantedBy=timers.target
UNIT

cat > "$UNIT_DIR/pombo-backup-promote@monthly.timer" <<'UNIT'
[Unit]
Description=Pombo — agenda a promoção mensal (dia 1, 05:00)

[Timer]
OnCalendar=*-*-01 05:00:00
Persistent=true
Unit=pombo-backup-promote@monthly.service

[Install]
WantedBy=timers.target
UNIT

systemctl daemon-reload
systemctl enable --now pombo-backup.timer
systemctl enable --now pombo-backup-promote@weekly.timer
systemctl enable --now pombo-backup-promote@monthly.timer

log "timers ativos:"
systemctl list-timers 'pombo-backup*' --no-pager || true
echo
log "PRONTO — backup Nível 1 ativo (2x/dia: 03:30 e 15:30 · retenção: ${DAILY_RETENTION_COUNT:-5} dumps mais recentes)."
log "Rode um agora:   systemctl start pombo-backup.service && journalctl -u pombo-backup.service -n 25 --no-pager"
log "Confira a retenção:  /opt/pombo/backup-check.sh"
log "⚠️  Backup só 'existe' depois de um restore-drill testado:  make restore-drill AGE_KEY=<chave privada>"
