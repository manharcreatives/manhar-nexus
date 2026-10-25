# Runbook: Deploy Manhar Nexus

**Audience:** the operator deploying Manhar Nexus to a single Linux host with Docker.
**Updated:** 2026-10-25. Matches `Dockerfile.api`, `Dockerfile.web`, `docker-compose.prod.yml`, `deploy/Caddyfile`, `scripts/*`.

The short operator checklist is `docs/ui/DEPLOYMENT_READINESS.md`. This runbook holds the full procedure and the reasons behind it.

---

## 1. What gets deployed

| Artifact | Purpose |
|---|---|
| `Dockerfile.api` → `nexus-api:<tag>` (target `runtime`) | NestJS API on Node 22, non-root, production deps only, `HEALTHCHECK` on `GET /health`. It does **not** run migrations. |
| `Dockerfile.api` → `nexus-migrate:<tag>` (target `migrate`) | One-shot release job: `prisma migrate deploy` followed by the idempotent reference seed (`prisma db seed`). |
| `Dockerfile.web` → `nexus-web:<tag>` | Vite static build served by Caddy. Caddy is also the public edge: TLS, HTTP→HTTPS, security headers, SPA fallback, `/api/*` proxy. |
| `docker-compose.prod.yml` | `postgres` (volume + healthcheck), `migrate` (profile `release`), `api`, `web`. |
| `deploy/Caddyfile` | Edge configuration (baked into `nexus-web`). |
| `deploy/.env` (from `deploy/.env.example`) | Compose settings: domain, image tag, Postgres container credentials. Gitignored. |
| `deploy/api.env` (from `apps/api/.env.example`) | API secrets and settings. Gitignored. |
| `scripts/backup.*`, `scripts/restore.*`, `scripts/smoke.*` | Backup, restore and post-deploy smoke test (PowerShell and bash). |

### Topology: same origin

```
browser ──https──▶ web (Caddy :443) ──┬── /assets/*, /, /tables … → static SPA (/srv)
                                      └── /api/*  ── strip /api ──▶ api:3000 ──▶ postgres:5432
```

- The web bundle is built with `VITE_API_URL=/api`. The API has no global prefix, so Caddy strips `/api` (`handle_path`).
- The refresh token is an httpOnly cookie (`nexus_refresh`) set by the API with `Path=/auth; SameSite=Strict; HttpOnly`, plus `Secure` when `NODE_ENV=production` (`apps/api/src/iam/auth.controller.ts`). Through the proxy the browser path is `/api/auth/*`, so Caddy rewrites `Path=/auth` to `Path=/api/auth` (`header_down Set-Cookie`). Without that rewrite the browser never sends the cookie back, and every user is logged out when the 5-minute access token expires or the page reloads. This was verified locally with Caddy 2.10.2: login set `Path=/api/auth`, and `POST /api/auth/refresh` with only the cookie returned 200.
- CORS does not apply to same-origin requests. `CORS_ORIGIN` must still be set to the public origin (`https://<NEXUS_DOMAIN>`), because the validator requires it and it is the only origin allowed if a cross-origin client is added later.
- `TRUST_PROXY=1` (set in compose) makes `req.ip` the real client IP behind Caddy, which rate limiting and login telemetry depend on.

### Alternative: cross-origin (not the default)

If the API must live on its own hostname (for example `api.example.com` while the app is on `app.example.com`):

- Build the web image with `VITE_API_URL=https://api.example.com` and set `CORS_ORIGIN=https://app.example.com` (exact origin, no trailing slash).
- Both hosts must share a registrable domain. The cookie is `SameSite=Strict`, and `app.` → `api.` counts as same-site, so it is still sent. A different domain (for example `*.vercel.app` → `api.example.com`) breaks refresh.
- Remove the `header_down Set-Cookie` rewrite, because the API is then served from `/` and `Path=/auth` is already correct.

---

## 2. Prerequisites

- [ ] Linux host with Docker Engine 24+ and the Compose v2 plugin (`docker compose version` ≥ 2.17 for `--wait`). 2 vCPU and 2 GB RAM are enough for a pilot.
- [ ] DNS `A`/`AAAA` record for `NEXUS_DOMAIN` pointing at the host. Inbound TCP 80 and 443 (and UDP 443 for HTTP/3) are open. Caddy needs port 80 for the ACME HTTP challenge and the redirect.
- [ ] PostgreSQL client tools 16+ on the machine that takes backups. Alternatively, run the backup script inside the `postgres` container (see `backup-restore.md`).
- [ ] The migration chain is committed and applies cleanly to an empty database. CI's `verify` job proves this on every push.
- [ ] Off-host storage for backups.

---

## 3. First deploy

```bash
git clone <repo> nexus && cd nexus
git checkout <release-commit>             # the commit CI passed
export TAG="$(git rev-parse --short HEAD)"

# 3.1 Configuration (both files are gitignored)
cp deploy/.env.example deploy/.env
cp apps/api/.env.example deploy/api.env
```

Edit `deploy/.env`: set `IMAGE_TAG=$TAG`, `NEXUS_DOMAIN`, `ACME_EMAIL`, `POSTGRES_PASSWORD` (long and random), and keep `NEXUS_TLS=acme`.

Edit `deploy/api.env` and replace every value marked `[PROD]`:

| Variable | Production value |
|---|---|
| `DATABASE_URL` | `postgresql://nexus_app:<POSTGRES_PASSWORD url-encoded>@postgres:5432/nexus?schema=public` |
| `CORS_ORIGIN` | `https://<NEXUS_DOMAIN>` |
| `JWT_ACCESS_SECRET` | ≥ 64 random chars: `openssl rand -base64 64 \| tr -d '\n'` |
| `PLATFORM_BOOTSTRAP_EMAIL` | a real operator mailbox (not `platform@manhar.local`) |
| `PLATFORM_BOOTSTRAP_PASSWORD` | ≥ 16 chars, unique; rotate in the app after first login |
| `LOG_LEVEL` | `info` (or `warn`) |

Compose forces `NODE_ENV=production`, `PORT=3000` and `TRUST_PROXY=1`. Do not set `NEXUS_DEMO_SEED`.

```bash
chmod 600 deploy/.env deploy/api.env
COMPOSE="docker compose -f docker-compose.prod.yml --env-file deploy/.env"

# 3.2 Build the images (or `$COMPOSE pull` if a registry holds them)
$COMPOSE build
$COMPOSE --profile release build migrate

# 3.3 Database
$COMPOSE up -d postgres

# 3.4 Release step: apply migrations, then the reference/bootstrap seed
$COMPOSE run --rm migrate

# 3.5 API + edge
$COMPOSE up -d --wait api web

# 3.6 Smoke (section 6)
```

The API refuses to start if the production config is unsafe. It exits with code 1 and lists each variable by name, never by value. For example:

```
[nexus-api] Invalid environment configuration (NODE_ENV=production). Fix the following and restart:
  - JWT_ACCESS_SECRET must be overridden in production (development default detected)
  - PLATFORM_BOOTSTRAP_PASSWORD must be overridden in production (development default detected)
  - JWT_ACCESS_SECRET must be at least 64 characters in production (ADR-028)
  - CORS_ORIGIN must not be a localhost/loopback origin in production
```

Run `$COMPOSE logs api` to see it. The rules live in `apps/api/src/config/configuration.ts`, and the seed also refuses development bootstrap credentials when `NODE_ENV=production`.

---

## 4. Subsequent deploys (release procedure)

```bash
cd nexus && git fetch && git checkout <release-commit>
NEW_TAG="$(git rev-parse --short HEAD)"
COMPOSE="docker compose -f docker-compose.prod.yml --env-file deploy/.env"

# 4.1 Restore point BEFORE anything touches the schema
DATABASE_URL='<from secret store>' scripts/backup.sh --out-dir /var/backups/nexus --retention-days 14
#   record: backup file name + current IMAGE_TAG (the rollback target)

# 4.2 New images under the new tag
sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$NEW_TAG/" deploy/.env
$COMPOSE build && $COMPOSE --profile release build migrate

# 4.3 Migrate (forward-only), then roll the API and edge
$COMPOSE run --rm migrate
$COMPOSE up -d --wait api web

# 4.4 Smoke, then watch logs for 15 minutes
```

If you deploy with no new migrations, `migrate` reports "No pending migrations to apply" and leaves the database untouched.

---

## 5. Migrations policy

- Only `prisma migrate deploy` runs against shared databases. It is forward-only, never resets, and never generates SQL. `prisma migrate dev`, `db push` and `migrate reset` are development-only.
- Migrations run as an **explicit** release step (`$COMPOSE run --rm migrate`), never as part of API start-up. This is why:
  1. A failed migration stops the release before new code serves traffic.
  2. Several API replicas never race to migrate.
  3. The operator always has a fresh backup first (step 4.1).
- Committed migration files are immutable. Fix a bad migration with a new one.
- Prefer additive migrations (expand, then contract) so the previous image keeps working against the new schema, which is what makes image-only rollback possible.
- **Never run the demo seed in production.** `prisma/demo-seed.ts` requires `NEXUS_DEMO_SEED=true` and refuses `NODE_ENV=production`. The migrate image runs only the reference seed (`prisma/seed.ts`: business types, system roles, first platform admin). That seed is idempotent and never resets an existing password.

---

## 6. Verify (smoke)

```bash
NEXUS_BASE_URL="https://$NEXUS_DOMAIN/api" \
NEXUS_SMOKE_EMAIL='<smoke user>' NEXUS_SMOKE_PASSWORD='<from secret store>' \
NEXUS_SMOKE_EXPECT_COOKIE_PATH=/api/auth \
NEXUS_SMOKE_READ_PATH=/admin/dining/tables \
  scripts/smoke.sh                     # Windows: powershell -File scripts/smoke.ps1
```

The smoke test checks `GET /health` (200, `ok` or `degraded`), `POST /auth/login` (token plus an httpOnly refresh cookie, with its path checked), `GET /auth/me`, and an optional business read. Use a dedicated low-privilege smoke account, not the bootstrap admin. `NEXUS_SMOKE_READ_PATH` needs a business-realm user.

Then check by hand:

- `curl -I https://$NEXUS_DOMAIN/tables` returns 200 `text/html` with `Cache-Control: no-cache`, `Strict-Transport-Security` and `Content-Security-Policy`.
- `curl -I http://$NEXUS_DOMAIN/` returns a 308 redirect to `https://`.
- The browser console shows no CSP violations on login, Tables, Reports (including print preview) and Bills.

`/health` semantics: `200 ok` means every component is up. `200 degraded` means an optional component (Redis or storage, which are not required yet) is down. `503 error` means a required component (the database) is down.

---

## 7. Monitoring (provider-agnostic)

| Signal | How | Alert when |
|---|---|---|
| **Uptime** | Any external HTTP monitor (Uptime Kuma, Better Stack, UptimeRobot, Pingdom…) on `GET https://<domain>/api/health` every 1 min, plus `GET https://<domain>/` for the edge. | Non-200 twice in a row, or latency over 2 s. A 503 means the database is unreachable. |
| **Container health** | `docker compose ps` shows `healthy`/`unhealthy` from the image HEALTHCHECKs. `restart: unless-stopped` restarts crashed containers. | Any service unhealthy for more than 2 min, or a restart loop (`docker events --filter event=die`). |
| **Logs** | The API writes one JSON object per line to stdout (pino): `level`, `time`, `app`, `version`, `requestId`, `http.method/url/statusCode`, `durationMs`, `msg`. Request bodies, passwords and tokens are never logged. Caddy access logs are also JSON on stdout. Docker keeps them (`json-file`, 5×20 MB per service). Ship them with any collector that tails Docker JSON logs (Vector, Fluent Bit, Promtail/Loki, Datadog agent, CloudWatch agent) and index on `requestId`. | `level` is `error` or `fatal` (pino 50/60) at a rate above zero; the 5xx share is over 1% for 5 min; repeated `auth` 401/429 bursts. |
| **Error tracking** | Hook points, in order of value: (1) `apps/api/src/common/domain-exception.filter.ts`, where the `statusCode >= 500` branch is the single place every unhandled request error passes through; (2) `fatal()` in `apps/api/src/main.ts` for start-up crashes and unhandled rejections; (3) the web app's top-level error boundary for client errors. Add a Sentry, GlitchTip or OpenTelemetry SDK call there, behind an env-provided DSN (add it to `configuration.ts` and `.env.example` when chosen). Until then, alert on `level>=50` log lines. | Any new error fingerprint in production. |
| **TLS** | Caddy renews automatically. Monitor certificate expiry externally, since most uptime tools offer it. Keep the `caddy_data` volume, because losing it forces re-issuance and can hit rate limits. | Expiry under 14 days. |
| **Backups** | The backup job's exit code plus the newest dump's age in off-host storage. | No successful backup in 26 h. |
| **Database** | `docker compose exec postgres psql -U nexus_app -d nexus -c "select count(*) from pg_stat_activity"`, disk usage of the `pgdata` volume. | Disk over 80%, connections near `max_connections`. |

Each response carries `X-Request-Id`. Pass your own value (for example from the edge) to correlate across Caddy, API logs and client reports.

---

## 8. Security notes

- Never print or log `DATABASE_URL`, `JWT_ACCESS_SECRET` or passwords. The scripts pass DB passwords to libpq via `PGPASSWORD`, never on the command line.
- `deploy/.env` and `deploy/api.env` are `chmod 600` and gitignored. Keep master copies in a secret manager.
- Rotating `JWT_ACCESS_SECRET` invalidates all access tokens within 5 minutes; refresh tokens remain valid.
- `apps/api/.env` is a **development** file and is currently tracked by git. `.dockerignore` keeps it out of images, but never put real credentials in it.
- Postgres is on an internal Docker network and is not published.

---

## 9. Without Docker (legacy path)

`infra/scripts/deploy.ps1`, `migrate.ps1` and `health-check.ps1` still exist for a bare host with a process manager (PM2, systemd or a Windows service). They need **PowerShell 7+** (`pwsh`) because they use `??`. The equivalent manual sequence is:

```bash
npm ci && npm run build
cd apps/api && npx prisma migrate deploy && npx prisma db seed
NODE_ENV=production node dist/main.js     # with the deploy/api.env variables exported
```

Serve `apps/web/dist` from any static host that applies the `deploy/Caddyfile` rules: SPA fallback, `/assets/*` immutable, `index.html` no-cache, and the headers.

**Windows build note:** in Git Bash, `VITE_API_URL=/api npm run build` is silently rewritten to `C:/Program Files/Git/api` by MSYS path conversion. Build from PowerShell (`$env:VITE_API_URL='/api'`), or prefix with `MSYS_NO_PATHCONV=1`. Linux and Docker builds are unaffected.

---

## Client go-live checklist

1. Confirm the `ActivationRequest` is ACTIVE (Phase 12).
2. Confirm every `DeploymentChecklist` item is complete.
3. Advance onboarding progress to `COMPLETED`.
4. Set `commercialStatus` to `ACTIVE`.
5. Brief the client owner on login credentials and the reset procedure.
6. Watch the first 24 h of logs and alerts.

Rollback: `rollback.md`. Backups: `backup-restore.md`. Incidents: `incident-response.md`.
