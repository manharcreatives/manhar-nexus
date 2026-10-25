# Deployment Readiness — Operator Checklist

**Updated:** 2026-10-25. **Status:** deployable from documentation. Every artifact that can be checked without a Docker host has been checked (see *Evidence*). The items under **PENDING — needs host** can only be closed on the target machine.

Detailed procedure: `docs/runbooks/deploy.md`. Backups: `backup-restore.md`. Rollback: `rollback.md`. Incidents: `incident-response.md`.

---

## 0. Blockers to clear before the first deploy

| # | Blocker | Owner action |
|---|---|---|
| B1 | **The committed migration chain fails on an empty database.** `20260824122126_npm_run_dev_api` renames `module_activation_status_idx`, but that index is created by `20260824130000_module_engine`, which sorts *later*. `prisma migrate deploy` stops with P3018 / 42P01. The owner's uncommitted working-tree edits fix this: they delete that migration and create the index under its final name in `module_engine`. With them, all 17 migrations apply cleanly to an empty DB. | Commit the two migration edits. CI's `verify` job fails until you do. Databases that already applied the old file keep a harmless extra `_prisma_migrations` row. |
| B2 | `.gitignore` contains `.github/workflows/` ("temporarily not tracked"), so `.github/workflows/ci.yml` cannot be committed. | Remove those two lines when you want CI enabled. |
| B3 | `apps/api/.env` (development values) is tracked by git. It holds dev-only credentials and is excluded from images by `.dockerignore`. | Optionally `git rm --cached apps/api/.env`. `.env` is now gitignored for new files. |

## 1. Prerequisites

- [ ] Linux host, Docker Engine 24+, Compose v2.17+, 2 vCPU / 2 GB RAM
- [ ] DNS for `NEXUS_DOMAIN` → host; TCP 80 + 443 (and UDP 443) open
- [ ] Off-host backup storage; PostgreSQL client tools ≥ the server version (or use the in-container backup)
- [ ] Secret store holding `POSTGRES_PASSWORD`, `JWT_ACCESS_SECRET`, `PLATFORM_BOOTSTRAP_PASSWORD`
- [ ] Blockers B1–B3 resolved; CI green on the release commit

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
- [ ] An uptime monitor is configured on `https://<domain>/api/health`; logs are shipped; alerts are set for `level>=50` (`deploy.md` §7)

## 7. Backups and rollback

- [ ] Daily `scripts/backup.sh --retention-days 14` is scheduled and copied off-host
- [ ] For every release, the **previous `IMAGE_TAG`** and the **pre-deploy dump** are recorded
- [ ] Rollback = previous `IMAGE_TAG` + `up -d` (code only), plus `scripts/restore.sh --clean` of the pre-deploy dump when the migration was destructive (`rollback.md`)

---

## PENDING — needs host

These cannot be done on the development machine (no Docker, no public DNS). Each needs the target host or a CI run.

| Item | Why pending | Closed by |
|---|---|---|
| Build and run the three images; healthchecks go green | Docker not installed locally | First CI run of the `images` job (builds, boots compose, smoke through Caddy), then the first host deploy |
| Public TLS issuance and renewal; HTTP→HTTPS on 80/443 | Needs a domain and open ports | First deploy (§5) |
| Rollback drill (tag N+1 with migration → tag N + restore → smoke) | Needs a host with two image tags | Staging drill; record timings in `rollback.md` |
| Restore drill on production-shaped storage and RTO measurement | Local drill done on dev cluster only | Staging drill (`backup-restore.md`) |
| Browser CSP pass on the real domain | Headers verified with curl only | Manual pass after first deploy |
| Monitoring wiring (uptime, log shipping, error tracking DSN) | Provider not chosen | Operator choice (`deploy.md` §7) |
| Physical ESC/POS printer validation, card-payment decision | Unchanged roadmap conditions | Pilot preparation |

---

## Evidence (2026-10-25, development machine)

- **Config validator:** 19 Jest tests (`apps/api/src/config/configuration.spec.ts`). The built API with `NODE_ENV=production` exits 1 with a named list for each of these: nothing set; the `.env.example` dev JWT secret, `ChangeMe!Dev12345` and `http://localhost:5173`; a 32-char secret and an `http://` origin. It boots with generated secrets.
- **Runtime image layout:** `npm ci --omit=dev --ignore-scripts --workspace @nexus/api` + `dist` + the generated Prisma client (exactly the `runtime` stage) started on :3100 against a restored DB in production mode. Health, login, `/admin/dining/tables` and both smoke scripts passed.
- **Backup/restore drill:** source and restored DB counts are identical for all 58 tables (`backup-restore.md`). The drill DB was dropped.
- **Migrations from empty:** committed `HEAD` fails (B1); the working-tree chain applies 17/17, and `prisma db seed` in production mode refuses dev credentials and accepts generated ones.
- **Caddy 2.10.2 (checksum-verified binary, run locally):** `caddy validate` and `caddy fmt` are clean. In front of the dev API it served `/tables` → index.html (no-cache, zstd), hashed JS → immutable, a missing asset → 404, `/api/health` → API (no-store). Login cookie rewritten to `Path=/api/auth`, and `POST /api/auth/refresh` with only that cookie returned 200 (401 without it).
- **Vite preview** (`--port 4174`): `/tables` and `/reports/daily` → 200 `text/html`; the hashed asset → 200 `text/javascript`.
- **YAML:** `ci.yml` and `docker-compose.prod.yml` parse with js-yaml and PyYAML.
- **Suite:** `npm run typecheck`, `npm run lint`, `npm run test -w @nexus/api`, `npm run test:e2e -w @nexus/api` and `npm run build` are all green.

## Web notes (unchanged)

- SPA fallback is required (real URLs such as `/tables` and `/reports`). Caddy, `vite dev` and `vite preview` all provide it.
- Fonts are bundled in `dist/assets`; there are no external requests at runtime.
- The CSP allows `style-src 'unsafe-inline'` only because the Reports page renders an inline `<style>` for print CSS. Moving that CSS into the stylesheet bundle would allow `style-src 'self'`. `script-src` is strict `'self'`.
- `robots.txt` disallows indexing. There is no OG image yet.
- Before the first real client: validate a physical ESC/POS printer, decide the card-payment strategy, close the open items in `SECURITY_REVIEW.md` (server-side modifier validation), and clear the "A Manhar Creatives product" tagline for white-label clients (`auth.heroFootnote`).
- Local demo set-up (dev cluster + `NEXUS_DEMO_SEED=true npm run demo:seed`) is described in `docs/PROJECT_SETUP_AND_TRANSFER_GUIDE.md` and `DEMO_SCRIPT.md`. It never applies to production.
