#!/usr/bin/env bash
# Backup do Postgres (pg_dump) para deploy/oracle/backups/, com retenção.
# Agende no cron da VM, ex. (diário 03:15):
#   15 3 * * *  /caminho/deploy/oracle/backup.sh >> /var/log/monitor-backup.log 2>&1
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Carrega POSTGRES_USER/DB do .env.
[ -f .env ] && set -a && . ./.env && set +a

RETENTION_DAYS="${RETENTION_DAYS:-14}"
OUT="$DIR/backups"
mkdir -p "$OUT"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$OUT/${POSTGRES_DB}-${STAMP}.sql.gz"

# pg_dump dentro do container do postgres; comprime no host.
docker compose -f "$DIR/docker-compose.yml" exec -T postgres \
	pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$FILE"

echo "backup: $FILE ($(du -h "$FILE" | cut -f1))"

# Retenção: apaga backups mais velhos que RETENTION_DAYS.
find "$OUT" -name "${POSTGRES_DB}-*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
