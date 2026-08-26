# Runbook: Incident Response

**Audience:** Manhar Creatives engineering team  
**Updated:** 2026-08-25

---

## Severity levels

| Level | Definition | Response time | Example |
|---|---|---|---|
| P0 Critical | All clients cannot transact | Immediate | API down, DB unreachable |
| P1 High | One client cannot transact | < 15 min | Auth failure, checkout broken |
| P2 Medium | Degraded experience | < 2 hours | Reports slow, print jobs queuing |
| P3 Low | Minor issue | Next business day | UI cosmetic issue |

---

## First response (P0/P1)

### 1. Establish the blast radius

```bash
# Is the API responding?
curl -s http://app.yourdomain.com/health

# Check structured logs (filter for 5xx errors)
# In PM2: pm2 logs nexus-api --lines 100
# In systemd: journalctl -u nexus-api --since "5 minutes ago"
```

### 2. Identify the request/business

Every API response includes a `X-Request-Id` header. If a client reports an error:

- Ask for the timestamp and action they were performing
- Search logs for that time window filtered by the business ID (never share raw logs externally)

### 3. Categorize: infrastructure vs. code vs. data

| Symptom | Likely cause |
|---|---|
| API returns 503 | Process crashed / DB unreachable |
| API returns 500 with Prisma error | Query or schema mismatch |
| API returns 500 with TypeError | Code bug (check recent deploy) |
| API returns 403 | Permission misconfiguration |
| API returns 409 | Duplicate key / concurrency issue |

---

## Common recovery steps

### API not responding (503)

```bash
# Check process
pm2 status nexus-api     # PM2
systemctl status nexus-api  # systemd

# Restart if crashed
pm2 restart nexus-api
```

### Database unreachable

1. Verify `DATABASE_URL` is correct in the running process environment
2. Check DB provider console for outages or maintenance windows
3. If using connection pooler, check pool exhaustion

### High error rate after deploy

1. Check logs for the specific error
2. If code regression: roll back (see `rollback.md`)
3. If data issue: do NOT rollback immediately — snapshot first, then diagnose

---

## Communication

- Notify affected clients within 10 minutes of P0/P1 detection
- Do NOT share stack traces or internal data with clients
- Use status page / email for updates every 30 minutes until resolved

---

## Post-incident requirements

After any P0 or P1 incident:

1. Root cause analysis (RCA) written within 48 hours
2. Fix or mitigation deployed within 5 business days
3. Regression test added to prevent recurrence
4. Incident log updated with: date, duration, blast radius, RCA, fix

---

## Useful diagnostic commands

```bash
# Last 50 API log lines (structured JSON)
pm2 logs nexus-api --lines 50 --nostream

# DB connection count
psql "$DATABASE_URL" -c "SELECT count(*) FROM pg_stat_activity WHERE datname='nexus';"

# Pending migrations
cd apps/api && npx prisma migrate status

# Active sessions count
psql "$DATABASE_URL" -c "SELECT count(*) FROM session WHERE revoked_at IS NULL AND expires_at > NOW();"
```
