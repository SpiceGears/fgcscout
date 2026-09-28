param(
    [string]$EnvFile = ""
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$resolvedEnvFile = if ($EnvFile) { (Resolve-Path -LiteralPath $EnvFile).Path } else { Join-Path $projectRoot ".env" }
$backupDirectory = Join-Path $projectRoot "backups"
New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
$fileName = "fgcscout-$((Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss')).archive.gz"
$dumpCommand = 'mongodump --quiet --username "$MONGO_APP_USERNAME" --password "$MONGO_APP_PASSWORD" --authenticationDatabase "$MONGO_APP_DATABASE" --db "$MONGO_APP_DATABASE" --archive="/backups/' + $fileName + '" --gzip'

docker compose --env-file $resolvedEnvFile -f (Join-Path $projectRoot "docker-compose.prod.yml") exec -T mongodb sh -c $dumpCommand
if ($LASTEXITCODE -ne 0) { throw "MongoDB backup failed." }

Write-Host "Backup created: $backupDirectory\$fileName"
