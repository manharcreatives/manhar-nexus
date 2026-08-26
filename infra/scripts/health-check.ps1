<#
.SYNOPSIS
    Health check for Manhar Nexus — verifies database connectivity and API readiness.

.DESCRIPTION
    Verifies:
      1. PostgreSQL is reachable and the nexus database exists.
      2. All Prisma migrations are applied (no pending migrations).
      3. API /health endpoint responds 200 (if API is running).

.USAGE
    powershell -File health-check.ps1 [-ApiUrl http://localhost:3000] [-DatabaseUrl "postgresql://..."]

.EXIT CODES
    0 = all checks passed
    1 = one or more checks failed
#>
[CmdletBinding()]
param(
    [string]$ApiUrl      = $env:API_HEALTH_URL ?? 'http://localhost:3000',
    [string]$DatabaseUrl = $env:DATABASE_URL   ?? 'postgresql://nexus:nexus@localhost:15432/nexus?schema=public'
)

$ErrorActionPreference = 'Stop'
$failed = 0

function Write-Check([string]$name, [bool]$ok, [string]$detail = '') {
    $symbol = if ($ok) { '[PASS]' } else { '[FAIL]' }
    $color  = if ($ok) { 'Green'  } else { 'Red'   }
    Write-Host "$symbol $name" -ForegroundColor $color
    if ($detail) { Write-Host "       $detail" -ForegroundColor DarkGray }
}

# ── 1. Database connectivity ───────────────────────────────────────────────────
try {
    $psql = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue |
            Sort-Object { [version]($_.Directory.Parent.Name) } -Descending |
            Select-Object -First 1 -ExpandProperty FullName

    if (-not $psql) {
        # Try PATH
        $psql = (Get-Command psql.exe -ErrorAction SilentlyContinue)?.Source
    }
    if (-not $psql) { throw 'psql not found in PATH or C:\Program Files\PostgreSQL' }

    $result = & $psql $DatabaseUrl -tAc 'SELECT current_database()' 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Check 'Database connectivity' $true "Connected to: $($result.Trim())"
    } else {
        Write-Check 'Database connectivity' $false $result
        $failed++
    }
} catch {
    Write-Check 'Database connectivity' $false $_.Exception.Message
    $failed++
}

# ── 2. Pending migrations ──────────────────────────────────────────────────────
try {
    $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
    $apiDir   = Join-Path $repoRoot 'apps\api'

    Push-Location $apiDir
    $migrateOutput = npx prisma migrate status 2>&1 | Out-String
    Pop-Location

    if ($migrateOutput -match 'Database schema is up to date') {
        Write-Check 'Migrations up to date' $true
    } elseif ($migrateOutput -match 'not yet been applied') {
        Write-Check 'Migrations up to date' $false 'Pending migrations detected — run migrate.ps1 first'
        $failed++
    } else {
        # Could not determine
        Write-Check 'Migrations up to date' $false "Unexpected output: $($migrateOutput.Substring(0, [Math]::Min(200, $migrateOutput.Length)))"
        $failed++
    }
} catch {
    Write-Check 'Migrations up to date' $false $_.Exception.Message
    $failed++
}

# ── 3. API health endpoint ─────────────────────────────────────────────────────
try {
    $resp = Invoke-WebRequest -Uri "$ApiUrl/health" -UseBasicParsing -TimeoutSec 10 -ErrorAction Stop
    if ($resp.StatusCode -eq 200) {
        Write-Check 'API /health' $true "HTTP $($resp.StatusCode)"
    } else {
        Write-Check 'API /health' $false "HTTP $($resp.StatusCode)"
        $failed++
    }
} catch [System.Net.WebException] {
    Write-Check 'API /health' $false "Not reachable at $ApiUrl (API may not be running yet)"
    # Not fatal if API is not yet started during a fresh deploy
}

# ── Result ────────────────────────────────────────────────────────────────────
Write-Host ''
if ($failed -eq 0) {
    Write-Host 'All checks passed.' -ForegroundColor Green
    exit 0
} else {
    Write-Host "$failed check(s) failed." -ForegroundColor Red
    exit 1
}
