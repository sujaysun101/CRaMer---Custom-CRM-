# One-command script to launch Cloudflare Tunnel for CRaMer CRM
$ErrorActionPreference = "Stop"

$cloudflared = Join-Path $PSScriptRoot "bin\cloudflared.exe"

if (-not (Test-Path $cloudflared)) {
    Write-Host "cloudflared.exe not found. Downloading..." -ForegroundColor Yellow
    $toolsDir = Join-Path $PSScriptRoot "bin"
    if (-not (Test-Path $toolsDir)) { New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null }
    Invoke-WebRequest -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" -OutFile $cloudflared
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Launching Cloudflare Tunnel for CRaMer" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Connecting http://localhost:3000 to public HTTPS..." -ForegroundColor Green

& $cloudflared tunnel --url http://localhost:3000
