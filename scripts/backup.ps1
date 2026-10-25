<#
.SYNOPSIS
    Logical backup of the Manhar Nexus database (pg_dump custom format).

.DESCRIPTION
    Reads the connection ONLY from the DATABASE_URL environment variable (the
    same value the API uses; Prisma-only query params such as ?schema= are
    ignored). The password is handed to pg_dump via PGPASSWORD, never on the
    command line, and is never printed.

    Writes, in -OutDir:
      nexus-<db>-<yyyyMMdd-HHmmss>.dump          pg_dump -Fc archive
      nexus-<db>-<yyyyMMdd-HHmmss>.dump.sha256   checksum
      nexus-<db>-<yyyyMMdd-HHmmss>.counts.tsv    exact row count per table
    then verifies the archive is readable (pg_restore --list).

.PARAMETER OutDir
    Destination directory (default: ./backups). Ship it off-host afterwards.

.PARAMETER RetentionDays
    Delete nexus-*.dump (+ sidecars) in OutDir older than N days. 0 = keep all.

.EXAMPLE
    $env:DATABASE_URL = '<from your secret store>'
    powershell -File scripts/backup.ps1 -OutDir D:\backups\nexus -RetentionDays 14

.NOTES
    Exit 0 = backup written and verified; 1 = failure. Windows PowerShell 5.1+.
#>
[CmdletBinding()]
param(
    [string]$OutDir = (Join-Path (Get-Location) 'backups'),
    [ValidateRange(0, 3650)]
    [int]$RetentionDays = 0
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\pg-env.ps1')

$countSql = @"
SELECT table_name || chr(9) || (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
"@

try {
    $conn = ConvertFrom-DatabaseUrl $env:DATABASE_URL
    $pgDump = Find-PgTool 'pg_dump'
    $pgRestore = Find-PgTool 'pg_restore'
    $psql = Find-PgTool 'psql'

    New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
    $OutDir = (Resolve-Path $OutDir).Path
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $safeDb = $conn.Database -replace '[^A-Za-z0-9_.-]', '_'
    $base = Join-Path $OutDir "nexus-$safeDb-$stamp"
    $dumpFile = "$base.dump"

    Write-Host "[backup] source : $(Format-PgTarget $conn)"
    Write-Host "[backup] output : $dumpFile"

    $saved = Set-PgEnv $conn
    try {
        $sw = [Diagnostics.Stopwatch]::StartNew()
        & $pgDump --format=custom --compress=6 --no-password --file="$dumpFile"
        if ($LASTEXITCODE -ne 0) { throw "pg_dump failed (exit $LASTEXITCODE)" }
        $sw.Stop()

        $counts = & $psql --no-password --no-psqlrc -X -q -t -A -v ON_ERROR_STOP=1 -c $countSql
        if ($LASTEXITCODE -ne 0) { throw "row count query failed (exit $LASTEXITCODE)" }
        $counts | Where-Object { $_ } | Set-Content -Encoding ascii -Path "$base.counts.tsv"
    } finally {
        Restore-PgEnv $saved
    }

    & $pgRestore --list "$dumpFile" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "pg_restore --list could not read the archive (exit $LASTEXITCODE)" }

    $hash = (Get-FileHash -Algorithm SHA256 -Path $dumpFile).Hash.ToLowerInvariant()
    "$hash  $(Split-Path -Leaf $dumpFile)" | Set-Content -Encoding ascii -Path "$dumpFile.sha256"

    $sizeKb = [math]::Round((Get-Item $dumpFile).Length / 1KB, 1)
    $tables = (Get-Content "$base.counts.tsv").Count
    Write-Host "[backup] OK     : $sizeKb KB, $tables tables, $([math]::Round($sw.Elapsed.TotalSeconds, 1))s, sha256 $($hash.Substring(0, 16))..." -ForegroundColor Green

    if ($RetentionDays -gt 0) {
        $cutoff = (Get-Date).AddDays(-$RetentionDays)
        $old = Get-ChildItem -Path $OutDir -Filter 'nexus-*.dump' | Where-Object { $_.LastWriteTime -lt $cutoff }
        foreach ($f in $old) {
            $stem = $f.FullName.Substring(0, $f.FullName.Length - '.dump'.Length)
            Remove-Item -Force -ErrorAction SilentlyContinue $f.FullName, "$($f.FullName).sha256", "$stem.counts.tsv"
            Write-Host "[backup] pruned : $($f.Name) (older than $RetentionDays days)"
        }
    }
    exit 0
} catch {
    Write-Host "[backup] FAILED : $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
