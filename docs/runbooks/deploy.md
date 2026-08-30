# Runbook: Deploy Manhar Nexus

**Audience:** Manhar Creatives engineering team  
**Updated:** 2026-08-25

---

## Pre-conditions

- [ ] All migrations are committed to `master` (or the target branch)
- [ ] `.env` (or equivalent secrets manager export) is configured for the target environment
- [ ] `CORS_ORIGIN` is set to the **exact** frontend domain (e.g. `https://app.yourrestaurant.com`). Missing or wrong value → browser blocks all API calls from the web app.
- [ ] `PLATFORM_BOOTSTRAP_PASSWORD` has been rotated from any placeholder/default value (ADR-028).
- [ ] `JWT_ACCESS_SECRET` is at least 64 characters and is NOT a dev placeholder — `deploy.ps1` enforces this, but verify manually before the first deploy.
- [ ] Database is reachable from the deploy host
- [ ] A backup/snapshot of the database has been taken (see `backup-restore.md`)
- [ ] Phase 13 deployment checklist for the relevant client is complete (if a client go-live)

---

## Step-by-step procedure

### 1. Pull latest code

```bash
git pull origin master
```

Verify the commit hash matches what was approved:

```bash
git log --oneline -3
```

### 2. Install dependencies

```bash
npm ci
```

### 3. Run the deployment script

```powershell
powershell -File infra/scripts/deploy.ps1 -Environment production
```

The script will:
1. Validate required environment variables
2. Refuse dev-credential secrets in production
3. Run `prisma migrate deploy` (forward-only, safe)
4. Run seed (idempotent — safe to re-run)
5. Run health check (DB connectivity + migration status)

### 4. (Re)start the API

The deploy script does **not** restart the API process. Use your process manager:

**PM2:**
```bash
pm2 reload nexus-api
```

**systemd:**
```bash
sudo systemctl reload nexus-api
```

### 5. Verify

```bash
curl -s http://localhost:3000/health | jq .
```

Expected response includes `"status": "ok"`.

---

## Rollback

If anything goes wrong: see `rollback.md`.

---

## Client go-live checklist

When deploying a new client:

1. Confirm `ActivationRequest` is in ACTIVE status (Phase 12)
2. Confirm all items in the `DeploymentChecklist` are marked complete
3. Advance onboarding progress to `COMPLETED` step
4. Update `commercialStatus` to `ACTIVE`
5. Brief client owner on login credentials and reset procedure
6. Monitor first 24h of logs for errors

---

## Security notes

- Never log or print `DATABASE_URL`, `JWT_ACCESS_SECRET`, or passwords
- Rotate `PLATFORM_BOOTSTRAP_PASSWORD` after first login
- Verify CORS_ORIGIN matches the actual frontend domain
- Use HTTPS in staging and production (TLS terminated at load balancer)
