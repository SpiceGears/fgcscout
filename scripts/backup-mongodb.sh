#!/usr/bin/env sh
set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
env_file=${FGCSCOUT_ENV_FILE:-"$project_root/.env"}
mkdir -p "$project_root/backups"
file_name="fgcscout-$(date -u +%Y%m%d-%H%M%S).archive.gz"

docker compose --env-file "$env_file" -f "$project_root/docker-compose.prod.yml" exec -T mongodb sh -c \
  'mongodump --quiet --username "$MONGO_APP_USERNAME" --password "$MONGO_APP_PASSWORD" --authenticationDatabase "$MONGO_APP_DATABASE" --db "$MONGO_APP_DATABASE" --archive="/backups/'"$file_name"'" --gzip'

printf 'Backup created: %s\n' "$project_root/backups/$file_name"
