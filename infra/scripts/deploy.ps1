<#
.SYNOPSIS
    Reproducible deployment script for Manhar Nexus.

.DESCRIPTION
    Orchestrates a safe deployment in the correct order:
      1. Environment validation (required vars present)
      2. Database migration (forward-only)
      3. Database seed (idempotent — safe to re-run)
      4. Health check (DB connectivity + migration status)

    This script does NOT start/restart the API process; process management
    is handled by the host environment (PM2, systemd, Windows Service, etc.).
    Run this script BEFORE starting or hot-reloading the API.

.USAGE
    powershell -File deploy.ps1 [-Environment staging|production] [-SkipSeed] [-DryRun]

.EXIT CODES
    0 = deployment steps succeeded
    1 = failure (deployment aborted)
#>
[CmdletBinding()]
param(
    [ValidateSet('development', 'staging', 'production')]
    [string]$Environment = ($env:NODE_ENV ?? 'development'),

    [switch]$SkipSeed,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$apiDir   = Join-Path $repoRoot 'apps\api'
$scripts  = $PSScriptRoot

Write-Host '╔══════════════════════════════════════════╗'
Write-Host '║  Manhar Nexus — Deployment               ║'
Write-Host '╚══════════════════════════════════════════╝'
Write-Host "Environment : $Environment"
Write-Host "Dry run     : $DryRun"
Write-Host "Skip seed   : $SkipSeed"
Write-Host ''

# ── Step 1: Environment validation ────────────────────────────────────────────
Write-Host '── Step 1: Environment validation ──────────'
$required = @('DATABASE_URL', 'JWT_ACCESS_SECRET', 'NODE_ENV')
$missing  = $required | Where-Object { -not (Get-Item "Env:$_" -ErrorAction SilentlyContinue) }
if ($missing) {
    Write-Error "Missing required environment variables: $($missing -join ', ')"
    exit 1
}

# Refuse dev secrets in production
if ($Environment -eq 'production') {
    $jwtSecret = $env:JWT_ACCESS_SECRET
    if ($jwtSecret -eq 'dev-only-jwt-access-secret-change-in-production-0001' -or
        $jwtSecret.Length -lt 64) {
        Write-Error 'JWT_ACCESS_SECRET is a dev placeholder or too short for production. Minimum 64 characters required.'
        exit 1
    }
}

Write-Host '[PASS] Environment variables validated.' -ForegroundColor Green
Write-Host ''

if ($DryRun) {
    Write-Host '[DryRun] Skipping migration, seed, and health check.' -ForegroundColor Yellow
    exit 0
}

# ── Step 2: Run migrations ─────────────────────────────────────────────────────
Write-Host '── Step 2: Database migrations ─────────────'
$migrateArgs = @('-File', "$scripts\migrate.ps1", '-Environment', $Environment)
if ($Environment -eq 'staging') { $migrateArgs += '-AllowDevCredentials' }

$proc = Start-Process -FilePath 'powershell.exe' `
    -ArgumentList ($migrateArgs | ForEach-Object { $_ }) `
    -Wait -PassThru -NoNewWindow
if ($proc.ExitCode -ne 0) {
    Write-Error 'Migration step failed. Aborting deployment.'
    exit 1
}
Write-Host ''

# ── Step 3: Seed (idempotent) ─────────────────────────────────────────────────
if (-not $SkipSeed) {
    Write-Host '── Step 3: Database seed (idempotent) ──────'
    Push-Location $apiDir
    try {
        npx ts-node -P tsconfig.json -r tsconfig-paths/register prisma/seed.ts
        if ($LASTEXITCODE -ne 0) { throw "Seed failed with exit code $LASTEXITCODE" }
        Write-Host '[PASS] Seed completed.' -ForegroundColor Green
    } finally {
        Pop-Location
    }
} else {
    Write-Host '── Step 3: Seed skipped (--SkipSeed) ──────'
}
Write-Host ''

# ── Step 4: Health check ──────────────────────────────────────────────────────
Write-Host '── Step 4: Health check ───────────────────'
$hcProc = Start-Process -FilePath 'powershell.exe' `
    -ArgumentList @('-File', "$scripts\health-check.ps1") `
    -Wait -PassThru -NoNewWindow
if ($hcProc.ExitCode -ne 0) {
    Write-Error 'Health check failed after deployment. Investigate before starting the API.'
    exit 1
}
Write-Host ''

Write-Host '╔══════════════════════════════════════════╗' -ForegroundColor Green
Write-Host '║  Deployment steps completed successfully ║' -ForegroundColor Green
Write-Host '╚══════════════════════════════════════════╝' -ForegroundColor Green
Write-Host 'Next: start or reload the API process (PM2 / systemd / Windows Service).'
exit 0
