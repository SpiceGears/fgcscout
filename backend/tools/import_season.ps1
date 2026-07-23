param(
    [string]$FilePath = "C:\Users\kulik\Downloads\fgcdata.json",
    [string]$BaseUrl = "https://localhost:7186"
)

if (-not (Test-Path $FilePath)) {
    Write-Error "File not found: $FilePath"
    exit 1
}

$body = Get-Content -Path $FilePath -Raw

$uri = "$BaseUrl/api/admin/importSeason"

try {
    $res = Invoke-RestMethod -Uri $uri -Method Post -Body $body -ContentType "application/json" -SkipCertificateCheck
    Write-Output "Import result:`n$res"
} catch {
    Write-Error "Request failed: $_"
    exit 2
}
