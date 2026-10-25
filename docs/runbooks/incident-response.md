# Runbook: Incident Response

**Audience:** the operator / on-call engineer.
**Updated:** 2026-10-25. Commands assume the compose stack.
Set `COMPOSE="docker compose -f docker-compose.prod.yml --env-file deploy/.env"`.

---

## Severity levels

| Level | Definition | Response time | Example |
|---|---|---|---|
| P0 Critical | No client can transact | Immediate | API down, DB unreachable, TLS expired |
| P1 High | One client cannot transact | < 15 min | Auth failure, checkout broken |
| P2 Medium | Degraded experience | < 2 hours | Reports slow, print jobs queuing |
| P3 Low | Minor issue | Next business day | UI cosmetic issue |

Alerts come from the monitoring set-up in `deploy.md` §7: uptime on `/api/health`, container health, `level>=50` log lines, certificate expiry and backup age.

---

## First response (P0/P1)

### 1. Establish the blast radius

```bash
curl -sS -o /dev/null -w '%{http_code}\n' https://<domain>/            # edge + SPA
curl -sS https://<domain>/api/health                                    # API + DB
$COMPOSE ps                                                             # healthy / unhealthy / restarting
$COMPOSE logs --since 15m api | grep -E '"level":"(error|fatal)"' | tail -50
$COMPOSE logs --since 15m web | tail -50                                # Caddy: TLS / upstream errors
```

| Symptom | Likely cause | Go to |
|---|---|---|
| Edge unreachable / TLS error | `web` down, cert not issued or renewed, DNS, or ports 80/443 closed | "Edge / TLS" |
| 502 on `/api/*`, SPA loads | `api` down or restarting | "API not responding" |
| `/api/health` 503 | Database unreachable | "Database unreachable" |
| 500 with `INTERNAL` code | Code bug or schema mismatch (check the recent deploy) | Logs by `requestId`, then `rollback.md` |
| 401 loops / users logged out every few minutes | Refresh cookie not sent back (wrong `Path`, not HTTPS, origin mismatch) | "Auth" |
| 403 | Permission or module gating configuration | Config Center |
| 409 | Optimistic-concurrency or duplicate conflict (usually user-retryable) | Logs |
| 429 on `/auth/*` | Per-IP rate limit. If every user hits it, `TRUST_PROXY` is wrong (all traffic appears to come from Caddy) | `deploy/api.env` |

### 2. Identify the request and the business

Every response carries `X-Request-Id`. Ask the client for the time and the action they took, then:

```bash
$COMPOSE logs --since 2h api | grep '"requestId":"<id>"'
```

Never share raw logs or stack traces externally.

---

## Recovery procedures

### API not responding

```bash
$COMPOSE ps api
$COMPOSE logs --tail 100 api
```

- **Exit at start-up with `Invalid environment configuration`:** the config validator refused `deploy/api.env`. The message lists each variable by name. Fix the file and run `$COMPOSE up -d api`.
- **Crash loop after a deploy:** roll back the image (`rollback.md` A).
- **Healthy but slow:** check DB connections (below) and host resources (`docker stats`).
- A plain restart is safe: `$COMPOSE restart api`. Shutdown hooks close the DB pool cleanly on SIGTERM.

### Database unreachable

1. `$COMPOSE ps postgres` and `$COMPOSE logs --tail 100 postgres`. Check disk space with `df -h` and `docker system df`.
2. Confirm `DATABASE_URL` in `deploy/api.env` matches `POSTGRES_*` in `deploy/.env`. The host must be `postgres`.
3. Managed database: check the provider status page and maintenance windows.
4. Data loss or corruption: **stop writes first** (`$COMPOSE stop api`), take a snapshot (`scripts/backup.sh`), then follow `backup-restore.md`.

### Edge / TLS

- Run `$COMPOSE logs web | grep -i -E 'acme|tls|certificate'`. Common causes are DNS not pointing at the host, port 80 blocked (HTTP-01 challenge) and ACME rate limits.
- Never delete the `caddy_data` volume. It holds the certificates and the ACME account.
- Run `$COMPOSE restart web` after fixing DNS or firewall rules. Caddy retries issuance automatically.

### Auth: users repeatedly logged out

- The refresh cookie must be `Path=/api/auth; HttpOnly; Secure; SameSite=Strict` as the browser sees it. Check with `scripts/smoke.sh` and `NEXUS_SMOKE_EXPECT_COOKIE_PATH=/api/auth`.
- The site must be served over HTTPS (the cookie is `Secure` in production).
- In a cross-origin set-up, `CORS_ORIGIN` must equal the web origin exactly and both hosts must be same-site (`deploy.md` §1).

### High error rate after a deploy

1. Find the failing route in the logs (`statusCode` ≥ 500).
2. If it is a code regression, roll back (`rollback.md`).
3. If it is a data issue, do **not** roll back immediately. Snapshot first, then diagnose.

---

## Communication

- Notify affected clients within 10 minutes of P0/P1 detection.
- Do not share stack traces or internal data.
- Send updates every 30 minutes until resolved.

## Post-incident requirements (P0/P1)

1. Root cause analysis within 48 h.
2. Fix or mitigation deployed within 5 business days.
3. Regression test added.
4. Incident log updated: date, duration, blast radius, RCA, fix, and the data-loss window if a restore was involved.

---

## Useful diagnostic commands

```bash
# Last 50 API log lines (JSON)
$COMPOSE logs --tail 50 --no-log-prefix api

# Errors only, pretty-printed (requires jq)
$COMPOSE logs --since 1h --no-log-prefix api | jq -c 'select(.level=="error" or .level=="fatal")'

# DB connections
$COMPOSE exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select count(*) from pg_stat_activity"'

# Migration status
$COMPOSE run --rm --entrypoint "npx --no-install prisma migrate status" migrate

# Active sessions
$COMPOSE exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select count(*) from session where \"revokedAt\" is null and \"expiresAt\" > now()"'
```
