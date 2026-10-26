# One-command script to launch self-hosted PostgreSQL and CRaMer CRM
$ErrorActionPreference = "Stop"

$pgBin = "C:\Program Files\PostgreSQL\18\bin"
$dataDir = Join-Path $PSScriptRoot "pg_local_data"
$port = 5433

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  CRaMer Self-Hosted CRM Launcher" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Initialize PostgreSQL cluster if not already present
if (-not (Test-Path $dataDir)) {
    Write-Host "[1/3] Initializing local PostgreSQL cluster..." -ForegroundColor Yellow
    & "$pgBin\initdb.exe" -D $dataDir -U cramer --auth=trust -E UTF8
}

# 2. Check if PostgreSQL server is running, if not start it
$tcpConn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if (-not $tcpConn) {
    Write-Host "[2/3] Starting local PostgreSQL on port $port..." -ForegroundColor Yellow
    Start-Process -FilePath "$pgBin\postgres.exe" -ArgumentList "-D `"$dataDir`" -p $port" -WindowStyle Hidden
    Start-Sleep -Seconds 2
} else {
    Write-Host "[2/3] Local PostgreSQL is already running on port $port." -ForegroundColor Green
}

# 3. Start Next.js CRM Application
Write-Host "[3/3] Starting CRaMer Web Application on http://localhost:3000..." -ForegroundColor Green
$env:DATABASE_URL = "postgresql://cramer@127.0.0.1:$port/cramer_db"
npm start
