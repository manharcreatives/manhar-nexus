<#
.SYNOPSIS
    Restore a scripts/backup.ps1 archive into the database named by DATABASE_URL.

.DESCRIPTION
    DESTRUCTIVE when -Clean is used. Safety rails:
      * The target comes ONLY from the DATABASE_URL environment variable.
      * -ConfirmDatabase <name> must equal the target database name, or nothing
        happens.
      * A non-empty target is refused unless -Clean is given (drops and
        recreates the archived objects).
      * The .sha256 sidecar, when present, must match.
      * Runs pg_restore in a single transaction with --exit-on-error: a failed
        restore leaves the target unchanged.
    After restoring, exact row counts are compared with the .counts.tsv
    manifest written by backup.ps1.

    Stop the API (or point it elsewhere) before restoring over a live database.

.PARAMETER File
    Path to the .dump archive.

.PARAMETER ConfirmDatabase
    Must equal the database name in DATABASE_URL (explicit confirmation).

.PARAMETER CreateDatabase
    Create the target database first if it does not exist (connects to the
    "postgres" maintenance database with the same credentials).

.PARAMETER Clean
    Allow restoring over a non-empty database (pg_restore --clean --if-exists).

.EXAMPLE
    $env:DATABASE_URL = 'postgresql://user:***@host:5432/nexus_restore_drill'
    powershell -File scripts/restore.ps1 -File backups\nexus-nexus-20261025-120000.dump `
        -ConfirmDatabase nexus_restore_drill -CreateDatabase
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$File,
    [string]$ConfirmDatabase,
    [switch]$CreateDatabase,
    [switch]$Clean
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\pg-env.ps1')

$countSql = @"
SELECT table_name || chr(9) || (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
"@

function Invoke-Psql([string]$Sql) {
    $out = & $script:psql --no-password --no-psqlrc -X -q -t -A -v ON_ERROR_STOP=1 -c $Sql
    if ($LASTEXITCODE -ne 0) { throw "psql failed (exit $LASTEXITCODE)" }
    return $out
}

try {
    if (-not (Test-Path $File)) { throw "Backup file not found: $File" }
    $File = (Resolve-Path $File).Path
    $conn = ConvertFrom-DatabaseUrl $env:DATABASE_URL
    $target = $conn.Database

    Write-Host "[restore] archive : $File"
    Write-Host "[restore] target  : $(Format-PgTarget $conn)"

    if ($ConfirmDatabase -ne $target) {
        throw "Refusing to restore: pass -ConfirmDatabase $target to confirm the target database."
    }
    if ($target -match "[`"']") { throw 'Database names containing quotes are not supported.' }

    $pgRestore = Find-PgTool 'pg_restore'
    $script:psql = Find-PgTool 'psql'

    $sidecar = "$File.sha256"
    if (Test-Path $sidecar) {
        $expected = ((Get-Content $sidecar -TotalCount 1) -split '\s+')[0].ToLowerInvariant()
        $actual = (Get-FileHash -Algorithm SHA256 -Path $File).Hash.ToLowerInvariant()
        if ($expected -ne $actual) { throw 'Checksum mismatch: archive is corrupt or was modified.' }
        Write-Host '[restore] sha256  : OK'
    } else {
        Write-Host '[restore] sha256  : no sidecar, skipped' -ForegroundColor Yellow
    }

    if ($CreateDatabase) {
        $saved = Set-PgEnv $conn 'postgres'
        try {
            $exists = Invoke-Psql "SELECT 1 FROM pg_database WHERE datname = '$target'"
            if (-not $exists) {
                Invoke-Psql "CREATE DATABASE `"$target`"" | Out-Null
                Write-Host "[restore] created : database $target"
            }
        } finally { Restore-PgEnv $saved }
    }

    $saved = Set-PgEnv $conn
    try {
        $tablesBefore = [int](Invoke-Psql "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")
        if ($tablesBefore -gt 0 -and -not $Clean) {
            throw "Target database $target already has $tablesBefore table(s). Re-run with -Clean to overwrite."
        }

        $restoreArgs = @('--no-password', '--no-owner', '--no-privileges', '--exit-on-error', '--single-transaction', "--dbname=$target")
        if ($Clean) { $restoreArgs += @('--clean', '--if-exists') }
        $sw = [Diagnostics.Stopwatch]::StartNew()
        & $pgRestore @restoreArgs "$File"
        if ($LASTEXITCODE -ne 0) { throw "pg_restore failed (exit $LASTEXITCODE); the target was left unchanged" }
        $sw.Stop()
        Write-Host "[restore] restored in $([math]::Round($sw.Elapsed.TotalSeconds, 1))s" -ForegroundColor Green

        $after = @{}
        foreach ($line in (Invoke-Psql $countSql)) {
            if (-not $line) { continue }
            $parts = $line.Split("`t")
            $after[$parts[0]] = [long]$parts[1]
        }
    } finally { Restore-PgEnv $saved }

    $manifest = $File -replace '\.dump$', '.counts.tsv'
    if (Test-Path $manifest) {
        $mismatch = 0; $checked = 0
        foreach ($line in (Get-Content $manifest)) {
            if (-not $line) { continue }
            $parts = $line.Split("`t")
            $checked++
            $restored = $after[$parts[0]]
            if ($null -eq $restored -or $restored -ne [long]$parts[1]) {
                $mismatch++
                Write-Host ("[restore] count   : {0,-40} backup={1} restored={2}" -f $parts[0], $parts[1], $restored) -ForegroundColor Yellow
            }
        }
        if ($mismatch -eq 0) {
            Write-Host "[restore] counts  : all $checked tables match the backup manifest" -ForegroundColor Green
        } else {
            Write-Host "[restore] counts  : $mismatch of $checked tables differ (expected only if the source was written to during backup)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "[restore] counts  : no manifest; $($after.Count) tables restored"
    }
    exit 0
} catch {
    Write-Host "[restore] FAILED  : $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
