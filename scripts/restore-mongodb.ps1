param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile,
    [string]$EnvFile = ""
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
$resolvedEnvFile = if ($EnvFile) { (Resolve-Path -LiteralPath $EnvFile).Path } else { Join-Path $projectRoot ".env" }
$resolvedBackup = (Resolve-Path -LiteralPath $BackupFile).Path
$backupDirectory = Join-Path $projectRoot "backups"
if (-not $resolvedBackup.StartsWith($backupDirectory, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "The backup must be located inside $backupDirectory"
}

$confirmation = Read-Host "This replaces the current fgcscout database. Type RESTORE to continue"
if ($confirmation -cne "RESTORE") { throw "Restore cancelled." }

$fileName = Split-Path -Leaf $resolvedBackup
$restoreCommand = 'mongorestore --quiet --drop --username "$MONGO_APP_USERNAME" --password "$MONGO_APP_PASSWORD" --authenticationDatabase "$MONGO_APP_DATABASE" --nsInclude "$MONGO_APP_DATABASE.*" --archive="/backups/' + $fileName + '" --gzip'
docker compose --env-file $resolvedEnvFile -f (Join-Path $projectRoot "docker-compose.prod.yml") exec -T mongodb sh -c $restoreCommand
if ($LASTEXITCODE -ne 0) { throw "MongoDB restore failed." }

Write-Host "Restore completed from $resolvedBackup"
