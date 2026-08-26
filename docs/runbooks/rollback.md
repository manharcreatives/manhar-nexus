# Runbook: Rollback Manhar Nexus

**Audience:** Manhar Creatives engineering team  
**Updated:** 2026-08-25

---

## Decision: when to roll back

Roll back if:
- API is returning 5xx on critical paths (health, auth, checkout)
- A migration caused schema errors or data corruption
- A new deployment introduced a regression that cannot be hotfixed in <30 minutes

Do NOT roll back for:
- Cosmetic frontend issues (push a hotfix instead)
- Non-critical feature regressions not affecting revenue

---

## Code rollback (no schema change)

If the deployment introduced only code changes (no new migrations):

```bash
git revert HEAD --no-edit
git push origin master
# Re-run deploy script
powershell -File infra/scripts/deploy.ps1 -Environment production -SkipSeed
```

Or deploy the previous known-good commit directly:

```bash
git checkout <previous-commit>
npm ci
powershell -File infra/scripts/deploy.ps1 -Environment production -SkipSeed
```

---

## Database migration rollback

**Prisma does not support automatic down-migrations.** Rollback requires a
restore from backup if the migration was destructive.

### If the migration is additive (new columns/tables with defaults)

Additive migrations are safe to leave in place. Roll back the code only —
the extra columns are harmless. No restore needed.

### If the migration was destructive (dropped columns, altered data)

1. **Stop the API immediately** to prevent further data writes.
2. Restore from the pre-deployment snapshot (see `backup-restore.md`).
3. Deploy the previous version of the code.
4. Verify health check passes.
5. Document the incident in the incident log.

---

## Partial deploy state

If the deploy script failed mid-way (e.g., migration succeeded but seed failed):

- The database is in the new schema state
- Only the seed/code step failed
- **Do not restore** — fix the failure and re-run `deploy.ps1`
- Seed is idempotent; re-running is safe

---

## Rollback checklist

- [ ] Identified the root cause before rolling back
- [ ] Notified affected clients if service was degraded > 5 minutes
- [ ] Verified health check passes after rollback
- [ ] Documented the incident (what failed, why, what was rolled back)
- [ ] Created a post-incident task to fix the root cause
