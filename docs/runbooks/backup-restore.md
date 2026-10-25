# Runbook: Backup and Restore

**Audience:** the operator running Manhar Nexus.
**Updated:** 2026-10-25. Matches `scripts/backup.{ps1,sh}` and `scripts/restore.{ps1,sh}`.

---

## Responsibility and strategy

| Tier | Retention | Method | Owner |
|---|---|---|---|
| Continuous WAL / PITR | 7 days | Managed provider PITR, if the database is managed (Neon, Supabase, RDS…) | DB provider |
| Daily logical backup | 14 days | `scripts/backup.sh --retention-days 14` from cron or a systemd timer, copied off-host | Operator |
| Pre-deploy restore point | until the next successful deploy | `scripts/backup.*` as step 4.1 of `deploy.md` | Operator running the deploy |

The compose stack's self-hosted `postgres` container has no PITR, so the daily logical backup **is** the backup. Ship every dump off the host (object storage with versioning, or another machine). A backup that lives only on the API host does not count.

---

## The scripts

Both variants share one contract:

- **Connection only from `DATABASE_URL`** (the same Prisma-style URL the API uses; `?schema=` and other Prisma-only parameters are ignored, while `sslmode` is honoured). The password goes to libpq through `PGPASSWORD` and never appears on a command line or in output.
- **Tools:** `pg_dump`, `pg_restore` and `psql` from `PATH`, from `PG_BIN`, or (Windows) from `C:\Program Files\PostgreSQL\<n>\bin`. The client major version must be **≥ the server version**.
- **Output** of a backup, timestamped:

  | File | Content |
  |---|---|
  | `nexus-<db>-<yyyyMMdd-HHmmss>.dump` | `pg_dump --format=custom --compress=6` |
  | `….dump.sha256` | checksum, verified by restore |
  | `….counts.tsv` | exact row count of every `public` table at backup time |

  After writing the archive, the backup confirms it is readable (`pg_restore --list`).
- **Restore safety rails:**
  1. The target comes only from `DATABASE_URL`.
  2. An explicit confirm flag must repeat the target database name.
  3. A non-empty target is refused unless you pass `--clean`/`-Clean`.
  4. The checksum must match.
  5. The restore runs as `--single-transaction --exit-on-error`, so a failed restore leaves the target unchanged. `--no-owner --no-privileges` makes the dump portable across roles.
  6. Afterwards, row counts are compared with the `.counts.tsv` manifest.

### Backup

```bash
# Linux / macOS
DATABASE_URL='<from secret store>' scripts/backup.sh --out-dir /var/backups/nexus --retention-days 14
```
```powershell
# Windows (PowerShell 5.1+)
$env:DATABASE_URL = '<from secret store>'
powershell -ExecutionPolicy Bypass -File scripts\backup.ps1 -OutDir D:\backups\nexus -RetentionDays 14
```

`--retention-days N` / `-RetentionDays N` deletes `nexus-*.dump` files (and their sidecars) older than N days in that directory. 0 keeps everything.

**Compose stack** (Postgres is not published to the host): run the script inside a throwaway container on the backend network that has matching client tools.

```bash
docker compose -f docker-compose.prod.yml --env-file deploy/.env run --rm --no-deps \
  -v "$PWD/scripts:/scripts:ro" -v /var/backups/nexus:/backups \
  -e DATABASE_URL='postgresql://nexus_app:<pw>@postgres:5432/nexus' \
  --entrypoint bash postgres /scripts/backup.sh --out-dir /backups --retention-days 14
```

Example cron entry (daily 02:30, with the URL taken from a root-only file):

```
30 2 * * * cd /opt/nexus && DATABASE_URL="$(cat /root/.nexus_db_url)" scripts/backup.sh --out-dir /var/backups/nexus --retention-days 14 >> /var/log/nexus-backup.log 2>&1 && rclone copy /var/backups/nexus remote:nexus-backups
```

### Restore

```bash
# Into a NEW database (preferred: verify there first, then switch)
DATABASE_URL='postgresql://user:<pw>@host:5432/nexus_restored' \
  scripts/restore.sh --file nexus-nexus-20261025-191535.dump \
  --confirm-database nexus_restored --create-database

# Over the live database (DESTRUCTIVE): stop the API first
docker compose -f docker-compose.prod.yml --env-file deploy/.env stop api
DATABASE_URL='postgresql://user:<pw>@host:5432/nexus' \
  scripts/restore.sh --file <dump> --confirm-database nexus --clean
```
```powershell
$env:DATABASE_URL = 'postgresql://user:<pw>@host:5432/nexus_restored'
powershell -File scripts\restore.ps1 -File <dump> -ConfirmDatabase nexus_restored -CreateDatabase   # add -Clean to overwrite
```

`--create-database` connects to the `postgres` maintenance database with the same credentials, so the role needs `CREATEDB`. After restoring:

1. Point `DATABASE_URL` at the restored database if it is a new one.
2. Run `$COMPOSE run --rm migrate`. It must report no pending migrations, unless you restored a pre-deploy point and are rolling code back (see `rollback.md`).
3. Start the API and run `scripts/smoke.sh`.

### Managed PITR

1. In the provider console, restore to a timestamp before the incident, into a **new** database or branch.
2. Verify it with `scripts/smoke.sh` against an API instance pointed at it, or with the row-count query below.
3. Switch `DATABASE_URL` in `deploy/api.env` and run `$COMPOSE up -d api`.

---

## Restore drill

Cadence: before each pilot launch, once per quarter, and after any destructive migration. Record the date, the duration and who ran it.

### Local drill — 2026-10-25 (executed)

Dev cluster on PostgreSQL 18 (`localhost:15432`), client tools 18. The commands were run from the repo root, and the `DATABASE_URL` values came from `apps/api/.env` and were never printed.

| Step | Command | Result |
|---|---|---|
| Backup (PS 5.1) | `scripts\backup.ps1 -OutDir <scratch>\backups -RetentionDays 14` | ✅ 1354.7 KB, 58 tables, 0.8 s, sha256 + counts written |
| Refusal: no confirm | `scripts\restore.ps1 -File <dump>` | ✅ exit 1, "pass -ConfirmDatabase nexus_restore_drill" |
| Refusal: wrong name | `… -ConfirmDatabase nexus` | ✅ exit 1 |
| Restore | `… -ConfirmDatabase nexus_restore_drill -CreateDatabase` | ✅ DB created, restored in 1.4 s, **all 58 tables match the manifest** |
| Refusal: non-empty | same again without `-Clean` | ✅ exit 1, "already has 58 table(s)" |
| Restore over existing | `… -Clean` | ✅ 2 s, all 58 tables match |
| Bash variant | `backup.sh` → `restore.sh --create-database` → refusal → `--clean` (into `nexus_restore_drill_sh`) | ✅ identical results, DB dropped |
| Independent check | `psql` on source vs restored | ✅ business 228=228, app_user 226=226, audit_event 2504=2504, dining_table 128=128, service_request 900=900, invoice 682=682, payment 662=662, refund 29=29, _prisma_migrations 17=17 (latest `20261025120000_refund_idempotency`), last audit hash `afea7701…` identical |
| App on restored DB | API built (`npm run build -w @nexus/api`), runtime image layout reproduced (`npm ci --omit=dev --ignore-scripts --workspace @nexus/api` + dist + generated client), started on :3100 with `NODE_ENV=production` and throwaway generated secrets | ✅ booted; `/health` 200 degraded (DB up; Redis/storage optional and down); login `demo.owner@pilot.nexus` 200 with an `HttpOnly; Secure; SameSite=Strict` cookie; `GET /admin/dining/tables` 200 (13 tables); `scripts/smoke.ps1` and `smoke.sh` passed |
| Cleanup | instance stopped; `DROP DATABASE nexus_restore_drill` | ✅ |

### Row-count query (manual verification)

```sql
SELECT table_name,
       (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint AS rows
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

### PENDING — needs a host

- Drill against the production-shaped stack (compose `postgres` container, backup run in-container, restore, `migrate`, smoke).
- Measure the end-to-end restore time (RTO) at production data size.
- Verify off-host copy, retention and encryption at rest of the backup bucket.

---

## Not yet in scope

- WAL archiving / PITR for the self-hosted Postgres container (use a managed database, or add pgBackRest/WAL-G).
- Cross-region replication.
- Alerting on missed backups (the monitoring table in `deploy.md` describes the check).
