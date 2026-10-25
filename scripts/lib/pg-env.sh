#!/usr/bin/env bash
# Shared helpers for scripts/backup.sh and scripts/restore.sh (sourced).
# Turns a Prisma-style DATABASE_URL into libpq PG* variables so the password
# never appears on a command line or in output.

pg_urldecode() { local s="${1//+/ }"; printf '%b' "${s//%/\\x}"; }

# Usage: pg_env_from_url "$DATABASE_URL"  → exports PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE [PGSSLMODE]
pg_env_from_url() {
  local url="$1"
  if [[ -z "$url" ]]; then echo "DATABASE_URL is not set." >&2; return 1; fi
  local re='^postgres(ql)?://(([^:@/]*)(:([^@/]*))?@)?(\[[^]]+\]|[^:/?]+)(:([0-9]+))?/([^?]+)(\?(.*))?$'
  if [[ ! "$url" =~ $re ]]; then
    echo "DATABASE_URL is not a postgresql:// URL of the form postgresql://user:pass@host:port/db" >&2
    return 1
  fi
  PGUSER="$(pg_urldecode "${BASH_REMATCH[3]}")"
  PGPASSWORD="$(pg_urldecode "${BASH_REMATCH[5]}")"
  PGHOST="${BASH_REMATCH[6]}"; PGHOST="${PGHOST#[}"; PGHOST="${PGHOST%]}"
  PGPORT="${BASH_REMATCH[8]:-5432}"
  PGDATABASE="$(pg_urldecode "${BASH_REMATCH[9]}")"
  local query="${BASH_REMATCH[11]}" pair
  unset PGSSLMODE
  IFS='&' read -r -a _pairs <<< "$query"
  for pair in "${_pairs[@]}"; do
    [[ "$pair" == sslmode=* ]] && PGSSLMODE="$(pg_urldecode "${pair#sslmode=}")" && export PGSSLMODE
  done
  export PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE
}

pg_target() { echo "${PGDATABASE} on ${PGHOST}:${PGPORT} as ${PGUSER}"; }

pg_tool() {
  local name="$1"
  if [[ -n "${PG_BIN:-}" && -x "${PG_BIN}/${name}" ]]; then echo "${PG_BIN}/${name}"; return; fi
  if command -v "$name" >/dev/null 2>&1; then command -v "$name"; return; fi
  echo "$name not found. Install the PostgreSQL client tools or set PG_BIN." >&2
  return 1
}

PG_COUNT_SQL="SELECT table_name || chr(9) || (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;"

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1
  else shasum -a 256 "$1" | cut -d' ' -f1; fi
}
