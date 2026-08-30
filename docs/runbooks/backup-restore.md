# Runbook: Backup and Restore

**Audience:** Manhar Creatives engineering team  
**Updated:** 2026-08-30

---

## Current backup responsibility

> **IMPORTANT:** Automated production backups are NOT implemented in Phase 13.
>
> Backup responsibility belongs to the **managed database provider** (Neon, Supabase, AWS RDS, etc.)
> configured in production. This document defines the expectations and restore procedure.

---

## Backup strategy (Phase 13 requirements)

| Tier              | Retention | Method                        | Owner         |
|---|---|---|---|
| Continuous WAL    | 7 days    | Managed PITR (provider)       | DB provider   |
| Daily snapshot    | 14 days   | Provider automated snapshot   | DB provider   |
| Pre-deploy manual | 48h       | Manual pg_dump before each deploy | Engineer  |

### Before every production deployment

Take a manual snapshot before running `deploy.ps1`:

```bash
# Replace connection string with actual production DATABASE_URL
pg_dump "postgresql://nexus_prod:SECRET@db-prod.internal:5432/nexus" \
  --format=custom \
  --file="backup-$(date +%Y%m%d-%H%M%S).pgdump"
```

Store the dump in a secured location (S3 bucket, off-host) — **never on the API server**.

---

## Restore procedure (Point-in-Time)

### From managed PITR (provider)

1. Log into database provider console (Neon / Supabase / RDS)
2. Navigate to the project → Backups / PITR
3. Select a recovery point (timestamp) before the incident
4. Follow provider restore wizard to a **new database** first
5. Verify data integrity on the restored database
6. Update `DATABASE_URL` to point to restored database
7. Run `infra/scripts/health-check.ps1` to confirm connectivity
8. Restart API

### From manual pg_dump

```bash
# Stop API first to prevent writes during restore
pg_restore \
  --dbname "postgresql://nexus_prod:SECRET@db-prod.internal:5432/nexus" \
  --clean --if-exists \
  --no-owner --no-privileges \
  backup-20260825-140000.pgdump
```

---

## Restore drill

A restore drill should be performed:
- Before every Phase 14 pilot launch
- Once per quarter in production
- After any major schema change (destructive migration)

### Local drill — COMPLETED 2026-08-30

Executed against the portable dev cluster (PostgreSQL 18, port 15432):

| Step | Result |
|---|---|
| `pg_dump -Fc nexus` | ✅ 2025.9 KB dump in 1s |
| `CREATE DATABASE nexus_drill` | ✅ |
| `pg_restore --no-owner nexus_drill` | ✅ exit 0 in 3s |
| Business count match | ✅ 1207 = 1207 |
| User count match | ✅ 927 = 927 |
| Audit event count match | ✅ 9327 = 9327 |
| Migration count match | ✅ 17 = 17 — latest: `20260825160000_phase16_operating_costs` |
| Audit chain hashes | ✅ last 5 events all hash IS NOT NULL |
| Cleanup | ✅ `DROP DATABASE nexus_drill` |

Local restore drill is complete. A **staging** restore drill (restoring to the production DB provider's staging environment) should be run before the first live pilot transaction.

**Drill procedure (staging):**
1. Restore the latest daily snapshot to a **staging database**
2. Run health check against the staging database
3. Verify critical records exist (business count, user count, recent audit events)
4. Document the time taken for future SLA estimation

---

## What is NOT in scope (Phase 13)

- Automated backup scheduling (scheduled via cron — deferred to Phase 14)
- Cross-region backup replication
- Backup encryption (provider-managed; verify before pilot)
- Backup monitoring / alerting on missed backups
