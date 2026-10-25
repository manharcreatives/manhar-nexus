#!/usr/bin/env bash
# Logical backup of the Manhar Nexus database (pg_dump custom format).
# Connection comes ONLY from $DATABASE_URL; the password is passed via
# PGPASSWORD and never printed. Same outputs as scripts/backup.ps1:
#   nexus-<db>-<yyyyMMdd-HHmmss>.dump / .dump.sha256 / .counts.tsv
#
# Usage: DATABASE_URL=... scripts/backup.sh [--out-dir DIR] [--retention-days N]
# Exit 0 = backup written and verified; non-zero = failure.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/pg-env.sh
source "$here/lib/pg-env.sh"

out_dir="$(pwd)/backups"
retention_days=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --out-dir) out_dir="$2"; shift 2 ;;
    --retention-days) retention_days="$2"; shift 2 ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done
[[ "$retention_days" =~ ^[0-9]+$ ]] || { echo "--retention-days must be a number" >&2; exit 2; }

fail() { echo "[backup] FAILED : $*" >&2; exit 1; }

pg_env_from_url "${DATABASE_URL:-}" || fail "invalid DATABASE_URL"
pg_dump="$(pg_tool pg_dump)" || fail "pg_dump missing"
pg_restore="$(pg_tool pg_restore)" || fail "pg_restore missing"
psql="$(pg_tool psql)" || fail "psql missing"

mkdir -p "$out_dir"
out_dir="$(cd "$out_dir" && pwd)"
stamp="$(date +%Y%m%d-%H%M%S)"
safe_db="$(printf '%s' "$PGDATABASE" | tr -c 'A-Za-z0-9_.-' '_')"
base="$out_dir/nexus-$safe_db-$stamp"
dump="$base.dump"

echo "[backup] source : $(pg_target)"
echo "[backup] output : $dump"
start=$(date +%s)
"$pg_dump" --format=custom --compress=6 --no-password --file="$dump" || fail "pg_dump failed"
"$psql" --no-password --no-psqlrc -X -q -t -A -v ON_ERROR_STOP=1 -c "$PG_COUNT_SQL" | sed '/^$/d' > "$base.counts.tsv" \
  || fail "row count query failed"
"$pg_restore" --list "$dump" > /dev/null || fail "pg_restore --list could not read the archive"
hash="$(sha256_of "$dump")"
echo "$hash  $(basename "$dump")" > "$dump.sha256"
size_kb=$(( $(wc -c < "$dump") / 1024 ))
echo "[backup] OK     : ${size_kb} KB, $(wc -l < "$base.counts.tsv" | tr -d ' ') tables, $(( $(date +%s) - start ))s, sha256 ${hash:0:16}..."

if (( retention_days > 0 )); then
  find "$out_dir" -maxdepth 1 -name 'nexus-*.dump' -type f -mtime "+$retention_days" -print0 |
    while IFS= read -r -d '' f; do
      rm -f -- "$f" "$f.sha256" "${f%.dump}.counts.tsv"
      echo "[backup] pruned : $(basename "$f") (older than $retention_days days)"
    done
fi
