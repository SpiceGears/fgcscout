#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  printf 'Usage: %s backups/<file>.archive.gz\n' "$0" >&2
  exit 2
fi

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
env_file=${FGCSCOUT_ENV_FILE:-"$project_root/.env"}
backup_dir="$project_root/backups"
backup_file=$(CDPATH= cd -- "$(dirname -- "$1")" && pwd)/$(basename -- "$1")
case "$backup_file" in
  "$backup_dir"/*) ;;
  *) printf 'Backup must be inside %s\n' "$backup_dir" >&2; exit 2 ;;
esac

printf 'This replaces the current fgcscout database. Type RESTORE to continue: '
read -r confirmation
[ "$confirmation" = "RESTORE" ] || { printf 'Restore cancelled.\n'; exit 1; }

file_name=$(basename -- "$backup_file")
docker compose --env-file "$env_file" -f "$project_root/docker-compose.prod.yml" exec -T mongodb sh -c \
  'mongorestore --quiet --drop --username "$MONGO_APP_USERNAME" --password "$MONGO_APP_PASSWORD" --authenticationDatabase "$MONGO_APP_DATABASE" --nsInclude "$MONGO_APP_DATABASE.*" --archive="/backups/'"$file_name"'" --gzip'

printf 'Restore completed from %s\n' "$backup_file"
