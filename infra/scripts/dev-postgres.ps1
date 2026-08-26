<#
.SYNOPSIS
    Portable PostgreSQL lifecycle for local Manhar Nexus development.

.DESCRIPTION
    Manages a project-local PostgreSQL cluster under infra/.local/pgdata using the
    PostgreSQL binaries already installed on this machine (no Docker required).
    The cluster listens on the canonical Nexus dev port 15432 and never touches
    any system-managed PostgreSQL service (see roadmap KI-01).

.USAGE
    powershell -File dev-postgres.ps1 -Action init   # create + start cluster, create DB
    powershell -File dev-postgres.ps1 -Action start  # start existing cluster
    powershell -File dev-postgres.ps1 -Action stop   # stop cluster
    powershell -File dev-postgres.ps1 -Action status # report state
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('init', 'start', 'stop', 'status')]
    [string]$Action
)

$ErrorActionPreference = 'Stop'

# --- Locate repo root (script lives in infra/scripts) -------------------------
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$localDir = Join-Path $repoRoot 'infra\.local'
$dataDir = Join-Path $localDir 'pgdata'
$logFile = Join-Path $localDir 'pg.log'

$PgPort = '15432'
$PgUser = 'nexus'
$PgDb = 'nexus'

function Find-PgBin([string]$name) {
    if ($env:NEXUS_PG_BIN) {
        $candidate = Join-Path $env:NEXUS_PG_BIN $name
        if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
    foreach ($root in @('C:\Program Files\PostgreSQL', "$env:ProgramData\PostgreSQL")) {
        if (-not (Test-Path -LiteralPath $root)) { continue }
        $exe = Get-ChildItem -Path $root -Filter $name -Recurse -ErrorAction SilentlyContinue |
            Where-Object { $_.Directory.Name -eq 'bin' -and $_.Directory.Parent } |
            Sort-Object {
                $v = $null
                if (-not [version]::TryParse($_.Directory.Parent.Name, [ref]$v)) { $v = [version]'0.0' }
                $v
            } -Descending |
            Select-Object -First 1
        if ($exe) { return $exe.FullName }
    }
    throw "PostgreSQL binary '$name' not found. Install PostgreSQL or set NEXUS_PG_BIN to its bin folder."
}

switch ($Action) {
    'init' {
        New-Item -ItemType Directory -Force -Path $localDir | Out-Null
        if (Test-Path -LiteralPath (Join-Path $dataDir 'PG_VERSION')) {
            Write-Host "[dev-postgres] Cluster already initialized at $dataDir"
        } else {
            $initdb = Find-PgBin 'initdb.exe'
            & $initdb -D $dataDir -U $PgUser -A trust -E UTF8 --no-instructions | Out-Null
            if ($LASTEXITCODE -ne 0) { throw "initdb failed with exit code $LASTEXITCODE" }
            Write-Host "[dev-postgres] Initialized new cluster at $dataDir"
        }
        # Fall through to start by invoking self detached (own hidden console),
        # so the postmaster never inherits our stdout handles (which would
        # keep callers like npm alive until the DB stops).
        $selfProc = Start-Process -FilePath 'powershell.exe' `
            -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"", '-Action', 'start') `
            -Wait -PassThru -WindowStyle Hidden
        if ($selfProc.ExitCode -ne 0) { exit $selfProc.ExitCode }

        $psql = Find-PgBin 'psql.exe'
        $exists = & $psql -h localhost -p $PgPort -U $PgUser -d postgres -tAc `
            "SELECT 1 FROM pg_database WHERE datname='$PgDb'"
        if ("$exists".Trim() -ne '1') {
            & $psql -h localhost -p $PgPort -U $PgUser -d postgres -c "CREATE DATABASE $PgDb"
            if ($LASTEXITCODE -ne 0) { throw "createdb failed" }
            Write-Host "[dev-postgres] Created database '$PgDb'"
        } else {
            Write-Host "[dev-postgres] Database '$PgDb' already exists"
        }
        Write-Host "[dev-postgres] Ready: postgresql://$($PgUser)@localhost:$($PgPort)/$($PgDb)?schema=public"
    }
    'start' {
        if (-not (Test-Path -LiteralPath (Join-Path $dataDir 'PG_VERSION'))) {
            throw "No cluster at $dataDir. Run with -Action init first."
        }
        $pgctl = Find-PgBin 'pg_ctl.exe'
        $statusOutput = & $pgctl -D $dataDir status 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[dev-postgres] Already running (port $PgPort)"
            exit 0
        }
        # Launch detached: postmaster must not inherit this console's stdout,
        # otherwise parent processes (npm/CI) hang until the DB stops.
        # NOTE: Start-Process joins arguments verbatim — every argument that
        # can contain spaces (paths!) must carry its own embedded quotes.
        # We intentionally do NOT wait on pg_ctl: its internal wait mode can
        # wedge under a hidden console. Readiness is verified via psql below.
        $startArgs = @('-D', "`"$dataDir`"", '-l', "`"$logFile`"", '-o', "`"-p $PgPort`"",
            '-w', '-t', '15', 'start')
        Start-Process -FilePath $pgctl -ArgumentList $startArgs -WindowStyle Hidden | Out-Null
        # Wait until the server accepts connections (max ~30s)
        $psql = Find-PgBin 'psql.exe'
        $deadline = (Get-Date).AddSeconds(30)
        do {
            Start-Sleep -Milliseconds 500
            $ready = & $psql -h localhost -p $PgPort -U $PgUser -d postgres -tAc 'SELECT 1' 2>$null
        } while ("$ready".Trim() -ne '1' -and (Get-Date) -lt $deadline)
        if ("$ready".Trim() -eq '1') {
            Write-Host "[dev-postgres] Started on port $PgPort (data: $dataDir)"
        } else {
            throw "Server did not become ready in time; see $logFile"
        }
    }
    'stop' {
        if (-not (Test-Path -LiteralPath (Join-Path $dataDir 'PG_VERSION'))) {
            Write-Host '[dev-postgres] No cluster initialized; nothing to stop.'
            exit 0
        }
        $pgctl = Find-PgBin 'pg_ctl.exe'
        & $pgctl -D $dataDir stop -m fast
        if ($LASTEXITCODE -eq 0) { Write-Host '[dev-postgres] Stopped.' }
    }
    'status' {
        if (-not (Test-Path -LiteralPath (Join-Path $dataDir 'PG_VERSION'))) {
            Write-Host '[dev-postgres] Not initialized.'
            exit 1
        }
        $pgctl = Find-PgBin 'pg_ctl.exe'
        & $pgctl -D $dataDir status
        exit $LASTEXITCODE
    }
}
