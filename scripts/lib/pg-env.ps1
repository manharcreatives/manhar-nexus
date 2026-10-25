<#
  Shared helpers for scripts/backup.ps1 and scripts/restore.ps1.
  Turns a Prisma-style DATABASE_URL into libpq PG* environment variables so
  the password never appears on a command line or in output.
  Windows PowerShell 5.1 compatible.
#>

function Find-PgTool([string]$Name) {
    if ($env:PG_BIN) {
        $candidate = Join-Path $env:PG_BIN "$Name.exe"
        if (Test-Path $candidate) { return $candidate }
        $candidate = Join-Path $env:PG_BIN $Name
        if (Test-Path $candidate) { return $candidate }
    }
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $installed = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\$Name.exe" -ErrorAction SilentlyContinue |
        Sort-Object { [int]($_.Directory.Parent.Name -replace '\D', '') } -Descending |
        Select-Object -First 1
    if ($installed) { return $installed.FullName }
    throw "$Name not found. Install the PostgreSQL client tools or set PG_BIN to their bin directory."
}

function ConvertFrom-DatabaseUrl([string]$Url) {
    if (-not $Url) { throw 'DATABASE_URL is not set.' }
    $m = [regex]::Match($Url, '^postgres(?:ql)?://(?:(?<user>[^:@/]*)(?::(?<pass>[^@/]*))?@)?(?<host>\[[^\]]+\]|[^:/?]+)(?::(?<port>\d+))?/(?<db>[^?]+)(?:\?(?<query>.*))?$')
    if (-not $m.Success) { throw 'DATABASE_URL is not a postgresql:// URL of the form postgresql://user:pass@host:port/db' }
    $query = @{}
    if ($m.Groups['query'].Success) {
        foreach ($pair in $m.Groups['query'].Value.Split('&')) {
            if (-not $pair) { continue }
            $kv = $pair.Split('=', 2)
            $value = ''
            if ($kv.Length -gt 1) { $value = [uri]::UnescapeDataString($kv[1]) }
            $query[$kv[0]] = $value
        }
    }
    $port = '5432'
    if ($m.Groups['port'].Success) { $port = $m.Groups['port'].Value }
    return [pscustomobject]@{
        User     = [uri]::UnescapeDataString($m.Groups['user'].Value)
        Password = [uri]::UnescapeDataString($m.Groups['pass'].Value)
        Host     = $m.Groups['host'].Value.Trim('[', ']')
        Port     = $port
        Database = [uri]::UnescapeDataString($m.Groups['db'].Value)
        SslMode  = $query['sslmode']
    }
}

# Sets PG* variables for child processes; returns the previous values so the
# caller can restore them (Restore-PgEnv) in a finally block.
function Set-PgEnv($conn, [string]$DatabaseOverride) {
    $names = 'PGHOST', 'PGPORT', 'PGUSER', 'PGPASSWORD', 'PGDATABASE', 'PGSSLMODE'
    $saved = @{}
    foreach ($n in $names) { $saved[$n] = [Environment]::GetEnvironmentVariable($n, 'Process') }
    $db = $conn.Database
    if ($DatabaseOverride) { $db = $DatabaseOverride }
    $env:PGHOST = $conn.Host
    $env:PGPORT = $conn.Port
    $env:PGUSER = $conn.User
    $env:PGPASSWORD = $conn.Password
    $env:PGDATABASE = $db
    if ($conn.SslMode) { $env:PGSSLMODE = $conn.SslMode } else { Remove-Item Env:PGSSLMODE -ErrorAction SilentlyContinue }
    return $saved
}

function Restore-PgEnv($saved) {
    foreach ($k in $saved.Keys) {
        [Environment]::SetEnvironmentVariable($k, $saved[$k], 'Process')
    }
}

function Format-PgTarget($conn) {
    return "$($conn.Database) on $($conn.Host):$($conn.Port) as $($conn.User)"
}
