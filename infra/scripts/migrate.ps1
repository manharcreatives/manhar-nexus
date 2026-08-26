<#
.SYNOPSIS
    Safe Prisma migration runner for Manhar Nexus.

.DESCRIPTION
    Runs `prisma migrate deploy` (production-safe: no reset, no dev-only features).
    Validates DATABASE_URL is set and refuses to run with dev default credentials
    unless -AllowDevCredentials is specified.

    Migration safety:
      - Uses `migrate deploy` (forward-only, schema-diff validated).
      - Refuses if DATABASE_URL is unset.
      - Warns on dev-mode credentials in non-dev environments.
      - Logs the result to stdout for CI capture.

.USAGE
    powershell -File migrate.ps1 [-Environment staging|production|development] [-AllowDevCredentials]

.EXIT CODES
    0 = migrations applied (or already up to date)
    1 = failure
#>
[CmdletBinding()]
param(
    [ValidateSet('development', 'staging', 'production')]
    [string]$Environment = ($env:NODE_ENV ?? 'development'),

    [switch]$AllowDevCredentials
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$apiDir   = Join-Path $repoRoot 'apps\api'

# ── Safety checks ─────────────────────────────────────────────────────────────
if (-not $env:DATABASE_URL) {
    Write-Error 'DATABASE_URL is not set. Cannot run migrations.'
    exit 1
}

$devPatterns = @('localhost', '127.0.0.1', 'dev-only', 'ChangeMe', 'nexus:nexus')
$isDevCreds  = $devPatterns | Where-Object { $env:DATABASE_URL -match [regex]::Escape($_) }

if ($isDevCreds -and $Environment -ne 'development' -and -not $AllowDevCredentials) {
    Write-Error "Refusing to run migrations against a dev-credential DATABASE_URL in environment '$Environment'. " +
                "Pass -AllowDevCredentials to override (CI staging only)."
    exit 1
}

Write-Host "[migrate] Environment : $Environment"
Write-Host "[migrate] API dir     : $apiDir"
Write-Host "[migrate] Running     : prisma migrate deploy"
Write-Host ''

Push-Location $apiDir
try {
    npx prisma migrate deploy
    if ($LASTEXITCODE -ne 0) {
        throw "prisma migrate deploy failed with exit code $LASTEXITCODE"
    }
    Write-Host ''
    Write-Host '[migrate] Migrations applied successfully.' -ForegroundColor Green
} finally {
    Pop-Location
}
