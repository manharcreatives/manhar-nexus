#!/usr/bin/env bash
# Restore a scripts/backup.sh archive into the database named by $DATABASE_URL.
# DESTRUCTIVE with --clean. Same safety rails as scripts/restore.ps1:
#   --confirm-database <name> must equal the target db name; a non-empty target
#   needs --clean; the .sha256 sidecar must match; single transaction +
#   --exit-on-error; row counts are compared with the .counts.tsv manifest.
#
# Usage: DATABASE_URL=... scripts/restore.sh --file X.dump --confirm-database NAME [--create-database] [--clean]
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/pg-env.sh
source "$here/lib/pg-env.sh"

file=""; confirm=""; create=0; clean=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --file) file="$2"; shift 2 ;;
    --confirm-database) confirm="$2"; shift 2 ;;
    --create-database) create=1; shift ;;
    --clean) clean=1; shift ;;
    -h|--help) sed -n '2,8p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

fail() { echo "[restore] FAILED  : $*" >&2; exit 1; }

[[ -n "$file" && -f "$file" ]] || fail "backup file not found: ${file:-<none>} (use --file)"
pg_env_from_url "${DATABASE_URL:-}" || fail "invalid DATABASE_URL"
target="$PGDATABASE"
echo "[restore] archive : $file"
echo "[restore] target  : $(pg_target)"
[[ "$confirm" == "$target" ]] || fail "refusing to restore: pass --confirm-database $target to confirm the target database."
[[ "$target" != *\"* && "$target" != *\'* ]] || fail "database names containing quotes are not supported"

pg_restore="$(pg_tool pg_restore)" || fail "pg_restore missing"
psql="$(pg_tool psql)" || fail "psql missing"
q() { "$psql" --no-password --no-psqlrc -X -q -t -A -v ON_ERROR_STOP=1 -c "$1"; }

if [[ -f "$file.sha256" ]]; then
  [[ "$(cut -d' ' -f1 < "$file.sha256")" == "$(sha256_of "$file")" ]] || fail "checksum mismatch: archive is corrupt or was modified"
  echo "[restore] sha256  : OK"
else
  echo "[restore] sha256  : no sidecar, skipped"
fi

if (( create )); then
  if [[ -z "$(PGDATABASE=postgres q "SELECT 1 FROM pg_database WHERE datname = '$target'")" ]]; then
    PGDATABASE=postgres q "CREATE DATABASE \"$target\"" > /dev/null
    echo "[restore] created : database $target"
  fi
fi

tables_before="$(q "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")"
if (( tables_before > 0 && ! clean )); then
  fail "target database $target already has $tables_before table(s). Re-run with --clean to overwrite."
fi

args=(--no-password --no-owner --no-privileges --exit-on-error --single-transaction "--dbname=$target")
(( clean )) && args+=(--clean --if-exists)
start=$(date +%s)
"$pg_restore" "${args[@]}" "$file" || fail "pg_restore failed; the target was left unchanged"
echo "[restore] restored in $(( $(date +%s) - start ))s"

manifest="${file%.dump}.counts.tsv"
after="$(q "$PG_COUNT_SQL")"
if [[ -f "$manifest" ]]; then
  mismatch=0; checked=0
  while IFS=$'\t' read -r table count; do
    [[ -z "$table" ]] && continue
    checked=$((checked + 1))
    restored="$(printf '%s\n' "$after" | awk -F'\t' -v t="$table" '$1 == t { print $2 }')"
    if [[ "$restored" != "$count" ]]; then
      mismatch=$((mismatch + 1))
      printf '[restore] count   : %-40s backup=%s restored=%s\n' "$table" "$count" "${restored:-missing}"
    fi
  done < "$manifest"
  if (( mismatch == 0 )); then
    echo "[restore] counts  : all $checked tables match the backup manifest"
  else
    echo "[restore] counts  : $mismatch of $checked tables differ (expected only if the source was written to during backup)"
  fi
else
  echo "[restore] counts  : no manifest; $(printf '%s\n' "$after" | sed '/^$/d' | wc -l | tr -d ' ') tables restored"
fi
