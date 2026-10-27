# Runbook: Rollback Manhar Nexus

**Audience:** the operator running the compose stack (`docker-compose.prod.yml`).
**Updated:** 2026-10-25.

Rollback has two independent levers:

1. **Image tag.** Every deploy uses an immutable `IMAGE_TAG` (git short SHA) in `deploy/.env`. To roll back, set the previous tag and run `up -d`.
2. **Database restore point.** Step 4.1 of `deploy.md` takes a `scripts/backup.*` dump before every migration. Prisma has no down-migrations, so a bad schema change is undone by restoring that dump.

Before every deploy, record both: the **previous tag** and the **restore-point file name**.

---

## Decision: when to roll back

Roll back when:

- `/api/health` returns 503, or the smoke test fails after a deploy.
- 5xx responses appear on critical paths (auth, Tables, checkout, Bills).
- A migration caused schema errors or data corruption.
- The regression cannot be hot-fixed within 30 minutes.

Do not roll back for cosmetic frontend issues or for non-revenue features. Ship a fix instead.

---

## A. Code-only rollback (no migration in the release, or an additive one)

Additive migrations (new tables, or nullable or defaulted columns) are safe to leave in place. The previous image ignores them.

```bash
COMPOSE="docker compose -f docker-compose.prod.yml --env-file deploy/.env"
sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=<previous-tag>/" deploy/.env
$COMPOSE up -d --wait api web           # images for <previous-tag> must still exist locally or in the registry
# smoke: deploy.md §6
```

Open realtime streams drop when the containers restart and reconnect by themselves. If the rollback target sits behind a different proxy configuration, re-check the SSE requirements (`deploy.md`, "Realtime stream": no buffering, no compression, idle timeout of at least 60 s). The latest additive migration (`20261025120000_refund_idempotency`: one nullable column and a unique index) is safe to leave in place when rolling back one tag.

Keep at least the last three tags' images on the host (`docker image ls nexus/*`) or in the registry. `docker image prune` must not delete them.

## B. Rollback with a destructive or incompatible migration

1. **Stop writes.** Run `$COMPOSE stop api`. The edge keeps serving the SPA, and API calls return 502 for the duration.
2. **Snapshot the broken state** for later analysis: `scripts/backup.sh --out-dir /var/backups/nexus/incident-<date>`.
3. **Restore the pre-deploy point** over the live database:
   ```bash
   DATABASE_URL='<prod url>' scripts/restore.sh --file /var/backups/nexus/<restore-point>.dump \
     --confirm-database nexus --clean
   ```
   The restore runs in a single transaction: if it fails, the database is left as it was. Confirm that every table matches the manifest.
4. **Previous image:** set `IMAGE_TAG=<previous-tag>` in `deploy/.env`.
5. **Schema check:** `$COMPOSE run --rm migrate` must report *no pending migrations*. The restored `_prisma_migrations` matches the previous code.
6. **Start the API and edge:** `$COMPOSE up -d --wait api web`, then run the smoke test.
7. **Data written between the deploy and the stop is lost** unless it is re-entered. Use the incident snapshot from step 2 to identify those rows, and tell affected clients.

Prefer restoring into a **new** database (`--create-database`) and switching `DATABASE_URL` when time allows. The broken database then stays intact for forensics.

## C. Failed release step (migrate job failed)

- `prisma migrate deploy` applies each migration in a transaction and stops at the first failure. The API was never rolled (it is started only after `migrate` succeeds), so the old image is still serving.
- Inspect the failure with `$COMPOSE run --rm migrate` output and `npx prisma migrate status`. If the failed migration left partial changes, restore the pre-deploy point (B.3), then mark it with `prisma migrate resolve --rolled-back <name>` before retrying with a fixed migration.
- The seed is idempotent. If only the seed failed, fix the env (for example the bootstrap credentials) and re-run `migrate`.

---

## Rollback checklist

- [ ] Previous tag and restore point were recorded before the deploy
- [ ] Root cause identified, or at least the failing component
- [ ] Clients notified if service was degraded for more than 5 minutes
- [ ] Health and smoke pass after the rollback
- [ ] Incident documented (what failed, why, what was rolled back, data-loss window)
- [ ] Follow-up task to fix forward

## PENDING — needs a host

The rollback drill (deploy tag N+1 with a migration, roll back to tag N plus restore, smoke) has not been run against a real Docker host. Run it on staging before the first client go-live and record the timings here.
