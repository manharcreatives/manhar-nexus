<#
.SYNOPSIS
    Post-deploy smoke test: health, login, authenticated reads.

.DESCRIPTION
    Configuration comes only from the environment (nothing secret on the
    command line, nothing secret printed):
      NEXUS_BASE_URL        API base URL as the browser sees it.
                            Direct:      http://localhost:3000
                            Behind Caddy: https://app.example.com/api
      NEXUS_SMOKE_EMAIL     account to log in with (use a dedicated smoke user
      NEXUS_SMOKE_PASSWORD  in production, never the bootstrap admin)
      NEXUS_SMOKE_READ_PATH optional extra authenticated GET, e.g.
                            /admin/dining/tables (needs a business user)
      NEXUS_SMOKE_EXPECT_COOKIE_PATH optional, e.g. /api/auth behind Caddy
    Checks:
      1. GET  /health          200 and status ok|degraded
      2. POST /auth/login      200, access token, httpOnly refresh cookie
      3. GET  /auth/me         200 with the bearer token
      4. GET  $NEXUS_SMOKE_READ_PATH (if set) 200

.NOTES
    Exit 0 = all checks passed, 1 = a check failed. Windows PowerShell 5.1+.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$failed = 0

function Check([string]$Name, [bool]$Ok, [string]$Detail = '') {
    if ($Ok) { Write-Host "[PASS] $Name  $Detail" -ForegroundColor Green }
    else { Write-Host "[FAIL] $Name  $Detail" -ForegroundColor Red; $script:failed++ }
}

function Invoke-Api([string]$Method, [string]$Path, $Body = $null, [string]$Token = $null) {
    $headers = @{ 'x-request-id' = "smoke-$([guid]::NewGuid().ToString('N').Substring(0, 12))" }
    if ($Token) { $headers['Authorization'] = "Bearer $Token" }
    $params = @{ Uri = "$script:base$Path"; Method = $Method; Headers = $headers; UseBasicParsing = $true; TimeoutSec = 15 }
    if ($null -ne $Body) { $params['Body'] = ($Body | ConvertTo-Json -Compress); $params['ContentType'] = 'application/json' }
    try {
        $r = Invoke-WebRequest @params
        return [pscustomobject]@{ Status = [int]$r.StatusCode; Content = $r.Content; Headers = $r.Headers }
    } catch [System.Net.WebException] {
        $resp = $_.Exception.Response
        if ($null -eq $resp) { return [pscustomobject]@{ Status = 0; Content = $_.Exception.Message; Headers = @{} } }
        return [pscustomobject]@{ Status = [int]$resp.StatusCode; Content = ''; Headers = @{} }
    }
}

foreach ($v in 'NEXUS_BASE_URL', 'NEXUS_SMOKE_EMAIL', 'NEXUS_SMOKE_PASSWORD') {
    if (-not [Environment]::GetEnvironmentVariable($v)) { Write-Host "[FAIL] $v is not set" -ForegroundColor Red; exit 1 }
}
$script:base = $env:NEXUS_BASE_URL.TrimEnd('/')
Write-Host "Smoke target: $script:base"

# 1. Health
$h = Invoke-Api 'GET' '/health'
$healthStatus = ''
if ($h.Status -eq 200) { $healthStatus = ($h.Content | ConvertFrom-Json).status }
Check 'GET /health' ($h.Status -eq 200 -and ($healthStatus -eq 'ok' -or $healthStatus -eq 'degraded')) "HTTP $($h.Status) status=$healthStatus"

# 2. Login
$login = Invoke-Api 'POST' '/auth/login' @{ email = $env:NEXUS_SMOKE_EMAIL; password = $env:NEXUS_SMOKE_PASSWORD }
$token = $null
if ($login.Status -eq 200) { $token = ($login.Content | ConvertFrom-Json).accessToken }
Check 'POST /auth/login' ($login.Status -eq 200 -and [bool]$token) "HTTP $($login.Status)"
$cookie = [string]$login.Headers['Set-Cookie']
if ($cookie) {
    # Print attributes only, never the token value.
    $attrs = ($cookie -split ';' | Select-Object -Skip 1 | ForEach-Object { $_.Trim() }) -join '; '
    Check 'refresh cookie' ($cookie -match 'HttpOnly') "nexus_refresh=<redacted>; $attrs"
    if ($env:NEXUS_SMOKE_EXPECT_COOKIE_PATH) {
        $expected = [regex]::Escape($env:NEXUS_SMOKE_EXPECT_COOKIE_PATH)
        Check 'refresh cookie path' ($cookie -match "(?i)path=$expected(;|$)") "expected Path=$($env:NEXUS_SMOKE_EXPECT_COOKIE_PATH)"
    }
} elseif ($login.Status -eq 200) {
    Check 'refresh cookie' $false 'no Set-Cookie on login'
}

# 3. Authenticated reads
if ($token) {
    $me = Invoke-Api 'GET' '/auth/me' $null $token
    Check 'GET /auth/me' ($me.Status -eq 200) "HTTP $($me.Status)"
    if ($env:NEXUS_SMOKE_READ_PATH) {
        $read = Invoke-Api 'GET' $env:NEXUS_SMOKE_READ_PATH $null $token
        $detail = "HTTP $($read.Status)"
        if ($read.Status -eq 200) {
            $json = $read.Content | ConvertFrom-Json
            if ($json -is [array]) { $detail += " ($($json.Count) items)" }
        }
        Check "GET $($env:NEXUS_SMOKE_READ_PATH)" ($read.Status -eq 200) $detail
    }
}

Write-Host ''
if ($failed -eq 0) { Write-Host 'Smoke test passed.' -ForegroundColor Green; exit 0 }
Write-Host "$failed smoke check(s) failed." -ForegroundColor Red
exit 1
