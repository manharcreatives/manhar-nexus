# Deployment Readiness — Operator Checklist

**Updated:** 2026-10-27. **Status:** deployable from documentation. Every artifact that can be checked without a Docker host has been checked (see *Evidence*). The items under **PENDING — needs host** can only be closed on the target machine.

Detailed procedure: `docs/runbooks/deploy.md`. Backups: `backup-restore.md`. Rollback: `rollback.md`. Incidents: `incident-response.md`.

---

## 0. Blockers (all resolved)

| # | Blocker | Status |
|---|---|---|
| B1 | The migration chain failed on an empty database (an index was renamed before it was created). | **Resolved.** The squash is committed. The committed tree applies 17/17 migrations to an empty database and `migrate status` reports up to date (see *Evidence*). Databases that applied the old file keep a harmless extra `_prisma_migrations` row. |
| B2 | `.github/workflows/` was gitignored, so CI could not be committed. | **Resolved.** `.github/workflows/ci.yml` is tracked (`git ls-files .github`). |
| B3 | `apps/api/.env` (dev values) was tracked. | **Resolved.** It is untracked and ignored (`.gitignore:10 .env`); `.dockerignore` also keeps it out of images. |

Open follow-up (not a blocker): `schema.prisma` does not declare the DB-side defaults, 7 indexes and several constraint names that the SQL migrations create, so `migrate diff` is not empty (details in *Evidence*). Do not use `db push`.

## 1. Prerequisites

- [ ] Linux host, Docker Engine 24+, Compose v2.17+, 2 vCPU / 2 GB RAM
- [ ] DNS for `NEXUS_DOMAIN` → host; TCP 80 + 443 (and UDP 443) open
- [ ] Off-host backup storage; PostgreSQL client tools ≥ the server version (or use the in-container backup)
- [ ] Secret store holding `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `PLATFORM_BOOTSTRAP_PASSWORD`
- [x] Blockers B1–B3 resolved (section 0)
- [ ] CI green on the release commit

## 2. Environment

Two gitignored files. Compose forces `NODE_ENV=production`, `PORT=3000` and `TRUST_PROXY=1` for the API.

### `deploy/.env` (template `deploy/.env.example`): compose and Postgres

| Variable | Required | Value |
|---|---|---|
| `IMAGE_TAG` | yes | Immutable tag per release (git short SHA). It is the rollback handle. |
| `NEXUS_REGISTRY` | no | Image prefix (default `nexus`) |
| `NEXUS_DOMAIN` | yes | Public hostname, e.g. `app.example.com` |
| `ACME_EMAIL` | yes | Certificate expiry contact |
| `NEXUS_TLS` | no | `acme` (default, public certs) or `internal` (CI/staging only) |
| `VITE_BRAND_NAME`, `VITE_BRAND_ACCENT` | no | White-label build args (public) |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | yes | Postgres container bootstrap (first start only) |

### `deploy/api.env` (template `apps/api/.env.example`): API and seed

| Variable | Production rule (enforced at boot by `validateEnv`) |
|---|---|
| `DATABASE_URL` | required; `postgresql://…@postgres:5432/<db>`; dev default refused |
| `CORS_ORIGIN` | `https://<NEXUS_DOMAIN>`; bare origin; localhost/loopback and `http://` refused |
| `JWT_ACCESS_SECRET` | ≥ 64 chars; dev placeholder refused |
| `PLATFORM_BOOTSTRAP_EMAIL` | dev default `platform@manhar.local` refused |
| `PLATFORM_BOOTSTRAP_PASSWORD` | ≥ 16 chars; `ChangeMe!Dev12345` refused (the seed refuses it too) |
| `LOG_LEVEL` | `info` or `warn` |
| `JWT_ACCESS_TTL_SECONDS`, `REFRESH_TTL_DAYS`, `REFRESH_ABSOLUTE_TTL_DAYS`, `ARGON2_*`, `AUTH_*` | optional; defaults are production-safe |
| `REDIS_URL`/`REDIS_REQUIRED`, `STORAGE_HEALTH_URL`/`STORAGE_REQUIRED` | optional; not required yet (health reports `degraded`) |
| `NEXUS_DEMO_SEED` | **never set** |

Web build-time variables (`apps/web/.env.example`): `VITE_API_URL=/api` (set by compose), plus the optional `VITE_BRAND_*`.

## 3. First deploy

```bash
cp deploy/.env.example deploy/.env && cp apps/api/.env.example deploy/api.env   # edit both; chmod 600
COMPOSE="docker compose -f docker-compose.prod.yml --env-file deploy/.env"
$COMPOSE build && $COMPOSE --profile release build migrate
$COMPOSE up -d postgres
$COMPOSE run --rm migrate          # prisma migrate deploy + reference seed (explicit release step)
$COMPOSE up -d --wait api web
```

- [ ] `migrate` printed "All migrations have been successfully applied" and "Seed complete"
- [ ] `$COMPOSE ps` shows `api` and `web` as healthy
- [ ] Logged in as the bootstrap admin and **rotated its password**; created a dedicated smoke user

## 4. Migrations

- [ ] Only `prisma migrate deploy`, via `$COMPOSE run --rm migrate`. It never runs on API start, so a failed migration never reaches traffic.
- [ ] A backup was taken immediately before every migrate (`scripts/backup.sh`)
- [ ] Never `migrate dev`, `db push` or `migrate reset` against shared databases
- [ ] **Never run the demo seed in production.** It is guarded by `NEXUS_DEMO_SEED=true` and refuses `NODE_ENV=production`.

## 5. TLS and edge

- [ ] `https://<domain>` serves a valid public certificate; `http://` redirects with 308
- [ ] Response headers include `Strict-Transport-Security`, `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`
- [ ] `/assets/*` has `Cache-Control: public, max-age=31536000, immutable`; `index.html` and deep links have `no-cache`; a missing asset returns 404, not HTML
- [ ] The `caddy_data` volume is preserved (certificates)
- [ ] Browser console shows no CSP violations (login, Tables, Reports + print, Bills)

## 6. Smoke

```bash
NEXUS_BASE_URL=https://<domain>/api NEXUS_SMOKE_EMAIL=<smoke user> NEXUS_SMOKE_PASSWORD=<…> \
NEXUS_SMOKE_EXPECT_COOKIE_PATH=/api/auth NEXUS_SMOKE_READ_PATH=/admin/dining/tables scripts/smoke.sh
```
- [ ] All checks pass (health, login + httpOnly cookie at `/api/auth`, `/auth/me`, a business read)
- [ ] Realtime: a business-user token on `GET /api/admin/realtime/stream` prints `event: hello` immediately (not after a delay) and the browser shows the "Live" badge
- [ ] An uptime monitor is configured on `https://<domain>/api/health`; logs are shipped; alerts are set for `level>=50` (`deploy.md` §7)

## 7. Backups and rollback

- [ ] Daily `scripts/backup.sh --retention-days 14` is scheduled and copied off-host
- [ ] For every release, the **previous `IMAGE_TAG`** and the **pre-deploy dump** are recorded
- [ ] Rollback = previous `IMAGE_TAG` + `up -d` (code only), plus `scripts/restore.sh --clean` of the pre-deploy dump when the migration was destructive (`rollback.md`)

---

## PENDING — needs host

These cannot be closed on the development machine (no Docker daemon, no public DNS). Each needs the target host or a CI run.

| Item | Why pending | Closed by |
|---|---|---|
| Build and run the three images; container healthchecks go green | Docker is not installed locally. The Dockerfiles and compose file were reviewed and their commands run natively, not as containers. | First CI run of the `images` job (builds, boots compose, smoke through Caddy), then the first host deploy |
| Public TLS issuance and renewal; HTTP to HTTPS on 80/443 | Needs a domain and open ports. The drill used Caddy's internal CA on port 8443. | First deploy (section 5) |
| Rollback drill (tag N+1 with a migration, back to tag N plus restore, smoke) | Needs a host with two image tags | Staging drill; record timings in `rollback.md` |
| Restore drill on production-shaped storage and RTO measurement | The local drill used the dev cluster | Staging drill (`backup-restore.md`) |
| SSE through the real edge (cloud load balancer or CDN, if any) | Verified only through Caddy on localhost; intermediaries may add buffering or idle timeouts | Smoke the stream after the first deploy (`deploy.md`, "Realtime stream") |
| Realtime with more than one API replica | The bus is in-process | Redis pub/sub adapter before scaling out (ADR-032) |
| Monitoring wiring (uptime, log shipping, error tracking DSN) | Provider not chosen | Operator choice (`deploy.md` section 7) |
| Physical ESC/POS printer validation, card-payment decision | Unchanged roadmap conditions | Pilot preparation |

---

## Evidence (2026-10-27, development machine, commit `db0c51f`)

Everything below ran on the Windows dev box with no Docker. Throwaway secrets were generated per drill; all scratch databases, processes and dumps were removed afterwards. Screenshots: `docs/ui/screens/deploy/`.

### Migrations from an empty database (committed tree)

- `git archive HEAD apps/api/prisma` into a temp folder, then `prisma migrate deploy` against a new empty database: `17 migrations found`, all applied, ending with `All migrations have been successfully applied.` This includes `20261025120000_refund_idempotency` (`refund_businessId_idempotencyKey_key` exists).
- `NODE_ENV=production` with generated `PLATFORM_BOOTSTRAP_*`: `ts-node prisma/seed.ts` printed `Seed complete: 10 business types, 9 system roles, 1 user(s).` A second run (`prisma db seed`) printed `Platform admin already exists ...; leaving password untouched.` (idempotent).
- `prisma migrate status`: `Database schema is up to date!`.
- Drift check (`migrate diff --from-migrations ... --to-schema-datamodel ... --exit-code`, shadow DB created and dropped): **exit 2, pre-existing and cosmetic; nothing from the refund migration or the realtime work.** The 455-line script contains only: (a) `ALTER COLUMN ... DROP DEFAULT` for `gen_random_uuid()` and `now()` defaults that the SQL migrations set in the database but `schema.prisma` does not declare (70 columns); (b) renamed indexes, unique constraints and foreign keys (hand-written names versus Prisma's default names; FKs are dropped and re-added with the same rules); (c) 7 indexes that exist in the migrations but not in the schema (`invoice` paidAt/voidedAt, `payment` capturedAt, `audit_event` action/resourceType, and two `alert_notification` indexes that exist under other names). **Consequence:** never use `db push` or accept a generated `migrate dev` migration against production; they would drop those reporting indexes and the DB-side defaults. Fix-forward task: declare the defaults and `@@index` entries in `schema.prisma` (or `map:` the names) so the diff is empty.

### Production-mode stack (no Docker)

Setup: `npm run build` (web built with `VITE_API_URL=/api`). The dev DB was copied with `scripts/backup.ps1` + `scripts/restore.ps1` (sha256 OK, 58 tables) into a scratch DB; the refund migration was then rolled back on that copy and `prisma migrate deploy` re-applied it on populated data (upgrade path). The API ran from `dist` with `NODE_ENV=production`, `TRUST_PROXY=1`, a generated 64-char JWT secret and `CORS_ORIGIN=https://nexus-drill.localhost:8443` (production refuses `localhost` itself). Caddy 2.10.2 used the repo `deploy/Caddyfile` unchanged except one drill-only global option (`skip_install_trust`, so Caddy does not touch the Windows trust store), with `NEXUS_DOMAIN=nexus-drill.localhost:8443`, `NEXUS_TLS=internal`, `API_UPSTREAM` and `SITE_ROOT` through the placeholders the file already supports.

| Check | Result |
|---|---|
| `caddy validate` | `Valid configuration` |
| `/` and deep link `/tables` | 200, `Cache-Control: no-cache`, HSTS, CSP, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, COOP; SPA shell served for `/tables` |
| Hashed asset | `Cache-Control: public, max-age=31536000, immutable`, gzip when requested |
| Missing asset `/assets/nope-123.js` | 404 (no SPA fallback) |
| Container health endpoint `127.0.0.1:8081/healthz` | `ok`, 200 |
| Login via `/api/auth/login` | 200, `Cache-Control: no-store`, `Set-Cookie: nexus_refresh=...; Path=/api/auth; HttpOnly; Secure; SameSite=Strict` |
| `POST /api/auth/refresh` with only that cookie (body `{}`) | 200 with a new access token and rotated cookie; without the cookie 401 |
| `scripts/smoke.sh` through the proxy | 6 PASS including `refresh cookie path /api/auth` and `GET /admin/dining/tables`; exit 0 |
| `scripts/smoke.ps1` through the proxy | 6 PASS including `GET /admin/dining/tables  HTTP 200 (13 items)`; exit 0 |
| SSE `GET /api/admin/realtime/stream` through Caddy | `Content-Type: text/event-stream`; `event: hello` 56 ms after connect (not buffered); an expense created through the proxy produced `event: change` (topic `expenses`) 36 ms later; `: ping` at 20 s; no `Content-Encoding` even with `Accept-Encoding: gzip, zstd, br` (a normal JSON response is gzipped) |
| Realtime auth gate | no token 401; platform-admin token 403 |
| Headless Edge over HTTPS, two contexts (demo.waiter, demo.kitchen) | The waiter opened a free table, added an item and pressed Send. The ticket appeared on the kitchen display with no reload **268 ms and 232 ms** after the click (two runs). Zero console errors or warnings, zero failed requests, zero HTTP 4xx/5xx, zero CSP violations (a `securitypolicyviolation` listener was installed). The shipped CSP (`connect-src 'self'`) already covers the same-origin stream. |

Notes from the drill:

- Building the web bundle from Git Bash on Windows rewrites `VITE_API_URL=/api` into `C:/Program Files/Git/api` (MSYS path conversion) and the browser then blocks every request with a CSP error. Use `MSYS_NO_PATHCONV=1` or build from PowerShell or CI. The Docker build is unaffected.
- `curl` on Windows (schannel) needs `--ssl-no-revoke` for Caddy's local CA (no OCSP/CRL); Linux curl does not.
- No production bug was found: `deploy/Caddyfile`, the API config and the Dockerfiles needed no change.

### Static artifact review

- `Dockerfile.api`: the build stage runs `npm ci` (root postinstall builds `@nexus/shared` and generates the Prisma client). `runtime` copies prod-only dependencies, `node_modules/.prisma`, `packages/shared/dist` and `apps/api/dist`, runs as `node`, and has a healthcheck on `GET /health` at `$PORT`. The `migrate` target runs `prisma migrate deploy` then `prisma db seed` (both commands verified locally on an empty and a populated DB). The realtime stream uses the API port; no extra port is needed.
- `Dockerfile.web`: Caddy 2.10 as a non-root user with `cap_net_bind_service`, `/data` and `/config` owned by `caddy`, healthcheck on `127.0.0.1:8081/healthz` (verified locally).
- `docker-compose.prod.yml`: parses with js-yaml. `api` is on `backend` (internal) and `edge`; `web` is only on `edge` and reaches `api:3000`; `migrate` is in the `release` profile; env names match `validateEnv`.
- `.github/workflows/ci.yml`: parses with js-yaml. The `verify` job runs `prisma migrate deploy` and `prisma db seed` before `test:e2e`, with `DATABASE_URL`, `CORS_ORIGIN`, `PLATFORM_BOOTSTRAP_EMAIL` and `PLATFORM_BOOTSTRAP_PASSWORD` (the names the API validates). The `images` job now also checks through Caddy that `/api/admin/realtime/stream` answers 401 anonymously and 403 to the platform admin (verified against the drill stack). CI has no business user, so the event flow itself is covered by this local drill only.

### Earlier evidence (2026-10-25, still valid)

- Config validator: Jest tests in `apps/api/src/config/configuration.spec.ts` (production refuses the dev JWT secret, `ChangeMe!Dev12345`, localhost or http CORS, short secrets).
- Backup/restore drill: source and restored counts identical for all tables (`backup-restore.md`).
- Vite preview served `/tables` and `/reports/daily` with `text/html`.

## Web notes (unchanged)

- SPA fallback is required (real URLs such as `/tables` and `/reports`). Caddy, `vite dev` and `vite preview` all provide it.
- Fonts are bundled in `dist/assets`; there are no external requests at runtime.
- The CSP allows `style-src 'unsafe-inline'` only because the Reports page renders an inline `<style>` for print CSS. Moving that CSS into the stylesheet bundle would allow `style-src 'self'`. `script-src` is strict `'self'`.
- `robots.txt` disallows indexing. There is no OG image yet.
- Before the first real client: validate a physical ESC/POS printer, decide the card-payment strategy, close the open items in `SECURITY_REVIEW.md` (server-side modifier validation), and clear the "A Manhar Creatives product" tagline for white-label clients (`auth.heroFootnote`).
- Local demo set-up (dev cluster + `NEXUS_DEMO_SEED=true npm run demo:seed`) is described in `docs/PROJECT_SETUP_AND_TRANSFER_GUIDE.md` and `DEMO_SCRIPT.md`. It never applies to production.
