#!/usr/bin/env bash
# Post-deploy smoke test: health, login, authenticated reads. Same contract as
# scripts/smoke.ps1; configuration only from the environment:
#   NEXUS_BASE_URL         http://localhost:3000  |  https://app.example.com/api
#   NEXUS_SMOKE_EMAIL / NEXUS_SMOKE_PASSWORD   (dedicated smoke user in prod)
#   NEXUS_SMOKE_READ_PATH  optional extra GET, e.g. /admin/dining/tables
#   NEXUS_SMOKE_EXPECT_COOKIE_PATH optional, e.g. /api/auth behind Caddy
#   CURL_CA_BUNDLE         optional CA file (e.g. Caddy internal root.crt)
# Requires curl. Exit 0 = all checks passed, 1 = a check failed.
set -uo pipefail

failed=0
pass() { echo "[PASS] $1  ${2:-}"; }
fail() { echo "[FAIL] $1  ${2:-}"; failed=$((failed + 1)); }
for v in NEXUS_BASE_URL NEXUS_SMOKE_EMAIL NEXUS_SMOKE_PASSWORD; do
  [[ -n "${!v:-}" ]] || { echo "[FAIL] $v is not set"; exit 1; }
done
base="${NEXUS_BASE_URL%/}"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
echo "Smoke target: $base"

# json_field <file> <field>: first occurrence of a string field (top-level
# fields are serialized first in these responses).
json_field() { grep -o "\"$2\":\"[^\"]*\"" "$1" 2>/dev/null | head -1 | cut -d'"' -f4; }

# 1. Health
code="$(curl -sS -o "$tmp/health" -w '%{http_code}' --max-time 15 "$base/health" || echo 000)"
status="$(json_field "$tmp/health" status)"
if [[ "$code" == 200 && ( "$status" == ok || "$status" == degraded ) ]]; then pass "GET /health" "HTTP $code status=$status"
else fail "GET /health" "HTTP $code status=${status:-?}"; fi

# 2. Login (credentials go to curl via stdin, not argv)
body="$(printf '{"email":"%s","password":"%s"}' "$NEXUS_SMOKE_EMAIL" "$NEXUS_SMOKE_PASSWORD")"
code="$(printf '%s' "$body" | curl -sS -o "$tmp/login" -D "$tmp/login.h" -w '%{http_code}' --max-time 15 \
  -H 'content-type: application/json' --data-binary @- "$base/auth/login" || echo 000)"
token="$(json_field "$tmp/login" accessToken)"
if [[ "$code" == 200 && -n "$token" ]]; then pass "POST /auth/login" "HTTP $code"; else fail "POST /auth/login" "HTTP $code"; fi
cookie="$(grep -i '^set-cookie:' "$tmp/login.h" | head -1 | tr -d '\r')"
if [[ -n "$cookie" ]]; then
  attrs="$(printf '%s' "$cookie" | cut -d';' -f2- | sed 's/^ *//')"
  if grep -qi 'httponly' <<< "$cookie"; then pass "refresh cookie" "nexus_refresh=<redacted>; $attrs"
  else fail "refresh cookie" "not HttpOnly"; fi
  if [[ -n "${NEXUS_SMOKE_EXPECT_COOKIE_PATH:-}" ]]; then
    if grep -qi "path=${NEXUS_SMOKE_EXPECT_COOKIE_PATH};\|path=${NEXUS_SMOKE_EXPECT_COOKIE_PATH}\$" <<< "$cookie"; then
      pass "refresh cookie path" "$NEXUS_SMOKE_EXPECT_COOKIE_PATH"
    else fail "refresh cookie path" "expected Path=$NEXUS_SMOKE_EXPECT_COOKIE_PATH"; fi
  fi
elif [[ "$code" == 200 ]]; then fail "refresh cookie" "no Set-Cookie on login"; fi

# 3. Authenticated reads
if [[ -n "$token" ]]; then
  auth=(-H "authorization: Bearer $token")
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "${auth[@]}" "$base/auth/me" || echo 000)"
  [[ "$code" == 200 ]] && pass "GET /auth/me" "HTTP $code" || fail "GET /auth/me" "HTTP $code"
  if [[ -n "${NEXUS_SMOKE_READ_PATH:-}" ]]; then
    code="$(curl -sS -o "$tmp/read" -w '%{http_code}' --max-time 15 "${auth[@]}" "$base$NEXUS_SMOKE_READ_PATH" || echo 000)"
    [[ "$code" == 200 ]] && pass "GET $NEXUS_SMOKE_READ_PATH" "HTTP $code ($(wc -c < "$tmp/read" | tr -d ' ') bytes)" \
      || fail "GET $NEXUS_SMOKE_READ_PATH" "HTTP $code"
  fi
fi

echo
if (( failed == 0 )); then echo "Smoke test passed."; exit 0; fi
echo "$failed smoke check(s) failed."; exit 1
