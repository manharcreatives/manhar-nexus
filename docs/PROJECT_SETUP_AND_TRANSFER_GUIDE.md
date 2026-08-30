# Manhar Nexus — Project Setup & Transfer Guide

> **LIVING OPERATIONAL DOCUMENT.**
>
> This guide must be reviewed and updated whenever any of the following change:
> Node version · npm version · package scripts · ports · environment variables ·
> database technology · Redis · Docker · migrations · seed commands · deployment
> procedure · authentication · hardware dependencies · project structure.
>
> **Last verified:** 2026-08-30 against commit `cca2c15`

---

## 1. Purpose

If this machine is unavailable tomorrow and the Manhar Nexus repository is cloned
onto another authorized computer, this document allows a developer to understand,
install, configure, run, verify, and use the project **without access to any prior
Claude session or internal notes**.

This is not aspirational documentation. Every command in this guide has been
verified against the actual repository.

---

## 2. Product / Architecture Overview

**Manhar Nexus** is a **modular multi-business hospitality management platform**.

```
Core philosophy:   CORE + MODULES + CONFIGURATION
First vertical:    Restaurant (fully implemented)
Future verticals:  Café, Hotel, Resort, Banquet, Cloud Kitchen, QSR, ...
Pilot status:      PILOT READY WITH CONDITIONS (see §27)
```

### Technology stack

| Layer | Technology |
|---|---|
| API | NestJS (Node.js), TypeScript |
| Web | React 18, Vite, Tailwind CSS v4 |
| Database | PostgreSQL (Prisma ORM) |
| Auth | Argon2id passwords, HS256 JWT, rotating refresh sessions |
| Money | Integer minor-unit arithmetic (paise for INR) |
| Monorepo | npm workspaces |

### Multi-tenancy model

- Every client is a **Business** (tenant root)
- `businessId` always comes from the server-side JWT — never trusted from URL or request body
- Two identity realms: **PLATFORM** (Manhar staff, cross-business) and **BUSINESS** (client users, scoped to one business)
- Location isolation: operations can be further scoped to a `locationId` within a business

### Module engine

Modules have a DAG dependency manifest and lifecycle: `PENDING_SETUP → ACTIVE`.
Modules shipped: `restaurant`, `catalog`, `checkout`, `costs` (operating costs).

---

## 3. Repository Structure

```
manhar-nexus/
├── apps/
│   ├── api/              NestJS HTTP API
│   │   ├── prisma/       Schema, migrations, seed, demo-seed
│   │   ├── src/          Application source
│   │   │   ├── checkout/ Checkout & payments module
│   │   │   ├── commercial/  Commercial/add-on management
│   │   │   ├── common/   Shared domain errors, tenant scope, repository base
│   │   │   ├── config/   Zod-validated environment schema
│   │   │   ├── core/     Business, location, settings, audit, notifications
│   │   │   ├── costs/    Operating Costs module (Phase 16)
│   │   │   ├── health/   /health endpoint
│   │   │   ├── iam/      Auth, JWT, permissions, roles
│   │   │   ├── modules/  Module engine (activation, gating guard)
│   │   │   ├── onboarding/  Onboarding progress tracker
│   │   │   ├── printing/ Printing & hardware agent
│   │   │   ├── reports/  Reports, alerts, audit viewer
│   │   │   └── restaurant/  Restaurant vertical (catalog, dining, kitchen)
│   │   └── test/         E2E test suites (20 suites, 596 tests)
│   └── web/              React + Vite SPA
│       └── src/
│           ├── auth/     Auth context, API client, login screen
│           ├── costs/    Operating Costs frontend
│           ├── restaurant/  Tables, kitchen, checkout frontend
│           ├── shell/    AppShell (nav, header, routing)
│           └── ...       Reports, config, modules, notifications, i18n
├── packages/
│   └── shared/           Cross-cutting types and constants (@nexus/shared)
├── infra/
│   └── scripts/
│       ├── dev-postgres.ps1   Portable local PostgreSQL cluster (Windows)
│       ├── deploy.ps1         Production deployment script
│       ├── migrate.ps1        Migration runner
│       └── health-check.ps1  Post-deploy health verification
├── docs/
│   ├── MASTER_IMPLEMENTATION_ROADMAP.md   Living phase tracker
│   ├── DEVELOPER_SETUP.md                 Dev machine quickstart
│   ├── PROJECT_SETUP_AND_TRANSFER_GUIDE.md   (this file)
│   ├── pilot-acceptance-checklist.md      121-item pilot acceptance checklist
│   ├── adr/                               Architecture Decision Records (001–030)
│   ├── runbooks/                          Operational runbooks
│   └── spec-normalized/                   Canonical glossary, requirement register
├── .env.example            Environment variable template (copy to apps/api/.env)
├── .github/workflows/ci.yml  GitHub Actions CI pipeline
├── docker-compose.dev.yml    Optional Docker services (PostgreSQL, Redis, MinIO)
├── package.json              Root workspace manifest + scripts
└── README.md                 Repository overview
```

**Authoritative sources (READ-ONLY — never modify):**
- `Manhar_Nexus_Master_Product_Architecture_v1.md` — product source of truth
- `Manhar_Nexus_Restaurant_Product_Architecture_v2_Original_Terminology.md` — restaurant vertical

---

## 4. Prerequisites

### Required

| Tool | Minimum version | Notes |
|---|---|---|
| **Git** | any recent | For cloning and working with the repository |
| **Node.js** | ≥ 20 (developed on v24) | `engines` field in package.json enforces ≥ 20 |
| **npm** | ≥ 10 | Ships with Node.js v20+; workspaces required |
| **PostgreSQL** | ≥ 13 | **Binaries only required** — the project manages its own portable cluster (no system service needed) |

> **PostgreSQL note:** The repo ships `infra/scripts/dev-postgres.ps1` which creates
> a project-local PostgreSQL cluster under `infra/.local/pgdata` using the PG binaries
> installed on the machine. You do NOT need to configure a PostgreSQL system service.
> If PostgreSQL is installed in a non-standard location, set `NEXUS_PG_BIN` to its `bin`
> directory before running db scripts.

### Optional

| Tool | When needed | Notes |
|---|---|---|
| **Docker Desktop** | Alternative to portable PG cluster; Redis; MinIO | `docker-compose.dev.yml` defines all three services |
| **VS Code** | Recommended IDE | Extensions below |
| **psql CLI** | Debugging, restore drills | Comes with PostgreSQL installation |

### Not required

- Redis is optional until Phase 8 realtime (API starts without it, `/health` reports it as degraded)
- MinIO is optional storage (API starts without it, `/health` reports it as degraded)
- Docker is NOT required if using the portable PostgreSQL cluster

---

## 5. Supported Development Environment

**Primary (developed and tested on):** Windows 11, PowerShell 5.1+

**Secondary (should work, not continuously verified):** macOS, Linux — the application code is cross-platform; the infrastructure scripts (`dev-postgres.ps1`, `deploy.ps1`) are PowerShell and require PowerShell on non-Windows machines.

**Shell:** Use PowerShell for running infrastructure scripts. npm/Node commands work in any terminal (PowerShell, Git Bash, Command Prompt, WSL2).

---

## 6. GitHub Clone

```powershell
# Clone the repository
git clone https://github.com/YOUR_ORG/manhar-nexus.git
cd manhar-nexus
```

> Replace `YOUR_ORG/manhar-nexus` with the actual GitHub repository path.

---

## 7. VS Code Setup

Open the repository in VS Code:

```powershell
code .
```

**Recommended extensions:**

| Extension | ID | Purpose |
|---|---|---|
| Prisma | `Prisma.prisma` | Prisma schema syntax, formatting |
| ESLint | `dbaeumer.vscode-eslint` | Inline lint errors |
| REST Client | `humao.rest-client` | Test API endpoints from `.http` files |
| GitLens | `eamodio.gitlens` | Enhanced git history |

The monorepo root contains `tsconfig.base.json`; each workspace has its own `tsconfig.json`.
VS Code uses the workspace TypeScript installations automatically.

---

## 8. Dependency Installation

```powershell
npm install
```

This single command:
1. Installs all workspace dependencies (`apps/api`, `apps/web`, `packages/shared`)
2. Builds `@nexus/shared` (TypeScript → `packages/shared/dist/`) via `postinstall`
3. Generates the Prisma client (`prisma generate`) via `postinstall`

> If the postinstall fails (e.g., PostgreSQL binaries missing for Prisma native), install
> Node.js dependencies first, then run `npm run prisma:generate -w @nexus/api` separately.

---

## 9. Environment Configuration

The environment template is at the repository root:

```powershell
# Windows PowerShell
Copy-Item .env.example apps\api\.env

# Bash / macOS / Linux
cp .env.example apps/api/.env
```

> The API reads `.env` from `apps/api/` (its working directory when started via npm workspaces).
> **Never commit `.env` files or real secrets to the repository.**

### Key variables in `.env`

| Variable | Default (dev) | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql://nexus:nexus@localhost:15432/nexus?schema=public` | PostgreSQL connection string (port 15432 = portable cluster) |
| `REDIS_URL` | `redis://localhost:16379` | Redis (optional in dev) |
| `REDIS_REQUIRED` | `false` | Set `true` to make Redis mandatory at startup |
| `JWT_ACCESS_SECRET` | dev placeholder | **MUST be overridden in production** (≥ 64 chars, non-placeholder) |
| `JWT_ACCESS_TTL_SECONDS` | `300` | Access token lifetime (5 minutes) |
| `REFRESH_TTL_DAYS` | `30` | Refresh token lifetime |
| `PLATFORM_BOOTSTRAP_EMAIL` | `platform@manhar.local` | First platform admin email |
| `PLATFORM_BOOTSTRAP_PASSWORD` | dev placeholder | **MUST be rotated before pilot go-live** |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed web origin (**must be exact frontend URL in production**) |
| `TRUST_PROXY` | `0` | Number of proxy hops to trust for real client IP |
| `PORT` | `3000` | API listen port |

### Production-only rules

The API **refuses to start in `NODE_ENV=production`** if:
- `JWT_ACCESS_SECRET` is the dev placeholder OR shorter than 64 characters
- `PLATFORM_BOOTSTRAP_PASSWORD` is the dev placeholder
- `PLATFORM_BOOTSTRAP_EMAIL` is `platform@manhar.local`

These checks are in `apps/api/src/config/configuration.ts` (Zod `superRefine`).

---

## 10. Database Setup

### Path A — Portable PostgreSQL cluster (recommended for Windows, no Docker)

The repo manages its own PostgreSQL cluster under `infra/.local/pgdata`.

```powershell
# First time: initialize the cluster + create the database
npm run db:init

# Subsequent: start the cluster (already initialized)
npm run db:start

# Stop the cluster when done
npm run db:stop
```

This uses whatever PostgreSQL version is installed on the machine. The cluster listens
on port **15432** (not the standard 5432) to avoid conflicts.

> If PostgreSQL is not in the default search path, set:
> `$env:NEXUS_PG_BIN = "C:\Program Files\PostgreSQL\18\bin"`

### Path B — Docker (alternative)

```powershell
docker compose -f docker-compose.dev.yml up -d postgres
```

This also starts Redis (port 16379) and MinIO (port 19000).

### Run migrations

After the database is running:

```powershell
npm run db:migrate
```

This runs `prisma migrate dev` in the API workspace, applying all pending migrations and generating the Prisma client.

### Seed reference data

```powershell
npx prisma db seed --schema apps/api/prisma/schema.prisma
# or from the api directory:
# (cd apps/api && npx prisma db seed)
```

The main seed (`prisma/seed.ts`) creates:
- Business types (restaurant, café, hotel, resort, banquet, QSR, cloud kitchen, …)
- System roles (platform-admin, owner, location-manager, checkout-associate, kitchen-team, service-team, host)
- First platform admin user (credentials from env: `PLATFORM_BOOTSTRAP_EMAIL` / `PLATFORM_BOOTSTRAP_PASSWORD`)

> The seed is idempotent — safe to re-run. It **does not reset or delete** existing data.

### Verify database

```powershell
curl http://localhost:3000/health
```

Expected: `{"status":"ok",...}` with `database: {status: "up"}`.

---

## 11. Redis / Supporting Services

Redis and MinIO are **optional** in development.

Without them, the API starts normally and `/health` reports them as `degraded` (not `error`
for database). This is expected behavior — they are not required for core restaurant operations.

When you need them (e.g., testing realtime features or file storage):

```powershell
docker compose -f docker-compose.dev.yml up -d redis minio
```

| Service | Port | Purpose |
|---|---|---|
| Redis | 16379 | Session cache, rate limiting, future realtime fanout |
| MinIO S3 | 19000 | Object storage (logos, receipts, attachments) |
| MinIO console | 19001 | MinIO admin UI |

> Docker is not installed on this machine (BLOCKER-B01). This does not block
> restaurant operations. Install Docker Desktop when you need Redis/MinIO live verification.

---

## 12. Migrations

### Development (applies migrations + generates client)

```powershell
npm run db:migrate
```

### CI / Production (forward-only, no auto-generation)

```powershell
cd apps/api
npx prisma migrate deploy
```

### Check migration status

```powershell
cd apps/api
npx prisma migrate status
```

### Add a new migration (development only)

```powershell
cd apps/api
npx prisma migrate dev --name your_migration_name
```

> **Production rule:** Migrations are forward-only. Never use `prisma migrate reset`
> or `prisma migrate dev` in production (ADR-019). Always use `prisma migrate deploy`.

### Migration history

17 migrations exist (`apps/api/prisma/migrations/`), covering Phases 0–16.
Latest: `20260825160000_phase16_operating_costs`.

---

## 13. Client / ORM Generation

Prisma client is auto-generated during `npm install` (via `postinstall` in `apps/api/package.json`).

To regenerate manually (e.g., after editing `schema.prisma`):

```powershell
npm run prisma:generate -w @nexus/api
```

---

## 14. Demo / Seed Setup

For a fully configured restaurant with test users, catalog, tables, and all modules active:

```powershell
# Windows PowerShell
$env:NEXUS_DEMO_SEED = "true"
npm run demo:seed

# Bash / macOS / Linux
NEXUS_DEMO_SEED=true npm run demo:seed
```

### What this creates

| Item | Detail |
|---|---|
| Business | "The Pilot Kitchen" (restaurant type) |
| Location | "Main Location" (Asia/Kolkata timezone) |
| Modules | restaurant, catalog, checkout, costs — all ACTIVE |
| Users | 4 demo accounts (see below) |
| Catalog | 3 tax categories, 4 menu categories, 12 menu items |
| Dining | 2 areas (Main Hall, Outdoor Terrace), 6 tables (T1–T6) |
| Expenses | 4 expense categories (Rent, Utilities, Wages, Supplies) |

### Demo credentials — DEVELOPMENT / DEMO ONLY

| Email | Password | Role |
|---|---|---|
| `demo.owner@pilot.nexus` | `PilotOwner@2024` | Owner (full access) |
| `demo.cashier@pilot.nexus` | `PilotCash@2024` | Checkout Associate |
| `demo.kitchen@pilot.nexus` | `PilotKitchen@2024` | Kitchen Team |
| `demo.waiter@pilot.nexus` | `PilotWaiter@2024` | Service Team |

> **NEVER use these credentials in a production environment or with real business data.**
> These passwords are publicly documented.

### Reset / reseed

The demo seed is idempotent. Re-running it is safe and will skip already-existing records.
To start completely fresh, reset the database first (development only):

```powershell
cd apps/api
npx prisma migrate reset   # WARNING: destroys all data
npm run db:migrate
$env:NEXUS_DEMO_SEED = "true"
npm run demo:seed
```

---

## 15. Backend Startup

```powershell
npm run dev:api
```

This runs `nest start --watch` in `apps/api/` with hot-reload.

**API base URL:** `http://localhost:3000`

**Key endpoints:**

| Path | Description |
|---|---|
| `GET /health` | Health check (database, Redis, storage) |
| `POST /auth/login` | Login (returns access token + sets httpOnly refresh cookie) |
| `POST /auth/refresh` | Refresh tokens (httpOnly cookie path for browsers) |
| `GET /auth/me` | Current user profile |
| `GET /admin/*` | Business-realm endpoints (require BUSINESS-realm JWT) |
| `GET /internal/*` | Platform-realm endpoints (require PLATFORM-realm JWT) |

Expected startup output includes:
```
Manhar Nexus API listening on http://localhost:3000
```

---

## 16. Frontend Startup

```powershell
npm run dev:web
```

This runs Vite dev server in `apps/web/`.

**Web URL:** `http://localhost:5173`

The web app communicates with the API directly at `http://localhost:3000`.
CORS is pre-configured in development: the API allows `http://localhost:5173`.

> To use a different API URL, set `VITE_API_URL` in an `apps/web/.env.local` file:
> `VITE_API_URL=http://localhost:3000`

---

## 17. Health Checks

### API health

```powershell
curl http://localhost:3000/health
```

Expected response structure:
```json
{
  "status": "ok",
  "version": "0.1.0",
  "uptimeSeconds": 42,
  "components": [
    { "name": "api", "status": "up", "required": true },
    { "name": "database", "status": "up", "required": true },
    { "name": "redis", "status": "error", "required": false },
    { "name": "storage", "status": "error", "required": false }
  ]
}
```

- `status: "ok"` — all required components up (Redis/storage degraded is acceptable in dev)
- `status: "degraded"` — non-required component down
- `status: "error"` — a required component (database) is down → HTTP 503

### Database health (direct)

```powershell
# Using health-check script
powershell -File infra/scripts/health-check.ps1
```

---

## 18. Login / First Use

After starting both API and web, navigate to `http://localhost:5173`.

With demo seed:
1. Enter `demo.owner@pilot.nexus` / `PilotOwner@2024`
2. Click Sign In
3. You'll see the AppShell with nav: Home, Modules, Config, Reports, Activity, Tables & Sessions, Kitchen Display, Operating Costs

Without demo seed (fresh database after main seed only):
1. Log in as the platform admin (credentials from `PLATFORM_BOOTSTRAP_EMAIL` / `PLATFORM_BOOTSTRAP_PASSWORD`)
2. Follow `docs/runbooks/pilot-setup.md` Path B to configure a restaurant

### Navigation by role

| Role | Available Nav |
|---|---|
| Owner / Location Manager | Full access (all nav items) |
| Checkout Associate | Tables & Sessions, Checkout |
| Kitchen Team | Kitchen Display only |
| Service Team | Tables & Sessions, Kitchen Display |
| Platform Admin | Platform section (Commercial, Onboarding) + all |

---

## 19. Main Development Workflow

```powershell
# 1. Pull latest changes
git pull origin main

# 2. Install any new dependencies (also rebuilds shared + regenerates Prisma)
npm install

# 3. Apply any new migrations
npm run db:migrate

# 4. Start infrastructure (if not already running)
npm run db:start

# 5. Start API (terminal 1)
npm run dev:api

# 6. Start web (terminal 2)
npm run dev:web

# 7. Verify
curl http://localhost:3000/health
# Open http://localhost:5173 in browser
```

---

## 20. Testing

Run all quality gates in order:

### TypeScript check

```powershell
npm run typecheck
```

Runs `tsc --noEmit` across all workspaces (shared → api → web). Expected: no output, exit 0.

### Lint

```powershell
npm run lint
```

ESLint with flat config. Expected: no errors.

### Unit tests

```powershell
npm test
```

- API: Jest, 27 tests (health, audit hash, settings registry, permission registry, token service)
- Web: Vitest, 2 tests (auth gate render)
- Expected: **27 unit + 2 web = 29 tests, all green**

### E2E tests

```powershell
npm run test:e2e
```

Runs all 20 E2E suites against a real PostgreSQL database (no running API process needed — tests bootstrap `AppModule` internally).

- Expected: **596/596 tests, 20 suites, all green**
- Duration: ~3–4 minutes

> E2E tests require the database to be running and migrated. They use a test-specific schema
> that is isolated from your development data.

### Build verification

```powershell
npm run build
```

Builds all workspaces: shared → api (NestJS) → web (Vite). Check for TypeScript errors and
bundle size warnings.

Expected web build output: ~320 kB JS / ~28 kB CSS (gzipped: much smaller).

### All gates in sequence

```powershell
npm run typecheck && npm run lint && npm test && npm run test:e2e && npm run build
```

This is equivalent to the CI pipeline.

---

## 21. Build Verification

```powershell
npm run build
```

The shared package builds first (required by api and web). The API build produces `apps/api/dist/`.
The web build produces `apps/web/dist/`.

To preview the web production build locally:

```powershell
npm run preview -w @nexus/web
```

---

## 22. Troubleshooting

### Node version mismatch

**Symptom:** `npm install` errors about engine requirements  
**Cause:** Node.js < 20 installed  
**Fix:** Install Node.js ≥ 20 from nodejs.org (LTS). Verify: `node --version`

---

### `@nexus/shared` not found

**Symptom:** Import errors for `@nexus/shared` in api or web  
**Cause:** Shared package not built  
**Fix:** `npm install` (postinstall builds it), or manually: `npm run build -w @nexus/shared`

---

### Prisma client not generated

**Symptom:** `@prisma/client` import errors or "PrismaClient is not a constructor"  
**Cause:** Prisma client not generated after schema change  
**Fix:** `npm run prisma:generate -w @nexus/api`

---

### Port 15432 already in use

**Symptom:** `npm run db:init` or `npm run db:start` fails with "address already in use"  
**Cause:** Another process (system PostgreSQL or another project) is using port 15432  
**Fix:** Find and stop the conflicting process. On Windows: `netstat -ano | findstr 15432`

---

### PostgreSQL binaries not found

**Symptom:** `dev-postgres.ps1` error "PostgreSQL binary not found"  
**Cause:** PostgreSQL not installed, or installed in a non-standard path  
**Fix:** Install PostgreSQL from postgresql.org. If installed in a non-standard path:
```powershell
$env:NEXUS_PG_BIN = "D:\PostgreSQL\18\bin"
npm run db:init
```

---

### API fails to start: "Invalid environment configuration"

**Symptom:** NestJS exits at startup with Zod validation error  
**Cause:** Missing or invalid environment variables in `apps/api/.env`  
**Fix:** Ensure `apps/api/.env` exists (copy from `.env.example`). Check the error message for which variable is invalid.

---

### API fails to start in production: JWT_ACCESS_SECRET too short

**Symptom:** `JWT_ACCESS_SECRET must be at least 64 characters in production`  
**Cause:** Production safety check in `configuration.ts`  
**Fix:** Generate a secure secret of ≥ 64 characters. Example:
```powershell
# PowerShell — generates a 64-char random hex string
-join ((1..32) | ForEach-Object { '{0:X2}' -f (Get-Random -Max 256) })
```

---

### E2E tests fail: database connection refused

**Symptom:** E2E tests fail with `ECONNREFUSED` on port 15432  
**Cause:** Portable PostgreSQL cluster is not running  
**Fix:** `npm run db:start` before running E2E tests

---

### E2E tests fail: relation does not exist

**Symptom:** Prisma errors about missing tables  
**Cause:** Migrations not applied  
**Fix:** `npm run db:migrate`

---

### Demo seed aborts: "NEXUS_DEMO_SEED must be true"

**Symptom:** Demo seed exits immediately with that message  
**Cause:** The NEXUS_DEMO_SEED guard is intentional — prevents accidental execution  
**Fix:**
```powershell
$env:NEXUS_DEMO_SEED = "true"
npm run demo:seed
```

---

### Demo seed fails: "restaurant BusinessType not found"

**Symptom:** Demo seed fails looking for the "restaurant" business type  
**Cause:** Main seed (`prisma/seed.ts`) has not been run  
**Fix:** Run the main seed first: `cd apps/api && npx prisma db seed`

---

### Frontend shows blank / can't reach API

**Symptom:** Browser shows blank page or network errors  
**Cause:** API not running, or wrong port  
**Fix:**
1. Verify API is running: `curl http://localhost:3000/health`
2. Verify web is running: `npm run dev:web`
3. Check that `CORS_ORIGIN=http://localhost:5173` is set in `apps/api/.env`

---

### PowerShell execution policy error

**Symptom:** "cannot be loaded because running scripts is disabled on this system"  
**Cause:** Windows execution policy restricts script execution  
**Fix:**
```powershell
# Run this once as Administrator
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
Or run individual scripts with the bypass flag:
```powershell
powershell -ExecutionPolicy Bypass -File infra/scripts/dev-postgres.ps1 -Action init
```

---

### Lint: pre-existing failures in test files

**Symptom:** `npm run lint` reports errors in `apps/api/test/*.e2e-spec.ts`  
**Cause:** Pre-existing lint issues in security/notifications/concurrency E2E test files (non-blocking)  
**Fix:** These are deferred lint issues. Application source code is clean. Do not suppress them.

---

## 23. Windows / PowerShell Notes

### Running multiple services

Use separate terminal windows or tabs. Recommended layout:

| Terminal | Command | What it does |
|---|---|---|
| 1 | `npm run dev:api` | NestJS API with hot-reload |
| 2 | `npm run dev:web` | Vite dev server with HMR |
| 3 | (optional) `npm run test:e2e` | E2E suite |

### Stopping services

- **Vite / NestJS:** `Ctrl+C` in the terminal
- **PostgreSQL cluster:** `npm run db:stop`

### Checking what is on a port

```powershell
netstat -ano | findstr :3000
netstat -ano | findstr :5173
netstat -ano | findstr :15432
```

### Setting environment variables in PowerShell

```powershell
$env:NEXUS_DEMO_SEED = "true"
$env:NODE_ENV = "production"
```

These apply to the current PowerShell session only.

### Line endings

The repository uses LF line endings (`.gitattributes`). Git for Windows handles this via
`core.autocrlf`. No action required.

---

## 24. Git Workflow

```powershell
# Clone
git clone https://github.com/YOUR_ORG/manhar-nexus.git
cd manhar-nexus

# Status
git status
git log --oneline -10

# Create a feature branch
git checkout -b feature/your-feature

# After making changes — run quality gates first
npm run typecheck && npm run lint && npm test && npm run test:e2e

# Stage and commit
git add -p    # review changes interactively
git commit -m "type(scope): description"

# Push
git push origin feature/your-feature
```

### Commit message convention

```
type(scope): short description

Types: feat | fix | test | docs | refactor | chore
```

### Before committing

Always run the full quality gate:
```powershell
npm run typecheck && npm run lint && npm test && npm run test:e2e
```

Never commit:
- `.env` files or any file containing real secrets
- Database dumps from production
- Generated files (`dist/`, `prisma/generated/`)
- Personal configuration files

---

## 25. Backup / Restore

See `docs/runbooks/backup-restore.md` for the full procedure.

### Local database backup

```powershell
pg_dump "postgresql://nexus:nexus@localhost:15432/nexus" `
  --format=custom `
  --file="backup-$(Get-Date -Format 'yyyyMMdd-HHmmss').pgdump"
```

### Local database restore

```powershell
# Stop API first
# Restore to a test database (never restore directly to the running dev database)
pg_restore `
  --dbname "postgresql://nexus:nexus@localhost:15432/nexus_test" `
  --clean --if-exists --no-owner --no-privileges `
  backup-YYYYMMDD-HHMMSS.pgdump
```

### Status of restore drills

| Environment | Status | Notes |
|---|---|---|
| Local dev | ✅ COMPLETED 2026-08-30 | pg_dump→restore→verify counts match exactly |
| Staging | 🔴 BLOCKED | Requires actual staging infrastructure |
| Production | 🔴 BLOCKED | Handled by managed DB provider (PITR) |

**Never run destructive restore commands against production without:**
1. A confirmed backup
2. Explicit authorization
3. API stopped
4. Verified that you are targeting the correct database URL

---

## 26. Hardware / Printer

### Software state

The printing subsystem is fully implemented:

| Component | Status |
|---|---|
| Cloud print job engine | ✅ Implemented (QUEUED→SENT→PRINTED state machine) |
| Print agent authentication | ✅ Implemented (hashed token, never plaintext in DB) |
| Agent–cloud protocol | ✅ Implemented |
| Receipt template engine | ✅ Implemented |
| KOT template engine | ✅ Implemented |
| Retry / backoff | ✅ Implemented |
| Reprint as new job | ✅ Implemented |
| E2E tests | ✅ 56 tests passing |

### Hardware state

| Check | Status | Notes |
|---|---|---|
| Physical ESC/POS printer available | 🔴 NOT AVAILABLE | No physical device in dev environment |
| ESC/POS printer validated | 🔴 BLOCKED | Cannot validate without hardware |
| Specific printer models certified | ⏳ PENDING | To be done during actual pilot setup |

**The printing software is correct and tested. Physical hardware validation is an external pilot condition.**

---

## 27. Security Rules for New Developers

### NEVER

- Commit `.env` files, production credentials, or JWT secrets to the repository
- Use production credentials in a local or staging environment
- Expose production data to local environments
- Disable multi-tenant isolation (the `scoped()` / `assertOwned()` pattern in every service)
- Bypass authorization guards or permission checks
- Weaken test assertions to make tests pass
- Put secrets into log messages or error responses
- Trust `businessId` from URL parameters or request bodies — always use `scopeFromPrincipal()`
- Run `prisma migrate reset` or destructive commands against staging or production databases
- Run the demo seed against production (`NODE_ENV=production` is enforced as a guard)

### ALWAYS

- Use `TenantScopedRepository.scoped()` when querying any tenant-scoped table
- Use `assertOwned()` as defense-in-depth after fetching a row
- Use `scopeFromPrincipal()` to build `TenantScope` — never construct it from URL params
- Verify test gate (typecheck + lint + unit + E2E) before committing code
- Rotate `PLATFORM_BOOTSTRAP_PASSWORD` and `JWT_ACCESS_SECRET` before any client goes live
- Keep audit trail records immutable — use reversal-only corrections for financial records

### Architecture invariants (do not violate)

| Invariant | Where enforced |
|---|---|
| businessId always from JWT | `scopeFromPrincipal()` in all controllers |
| No cross-business data access | `TenantScopedRepository.scoped()` + `assertOwned()` |
| Money as integer minor units | Schema + DTO validators (no floating point) |
| Audit trail append-only + hash-chained | `AuditService` — never update/delete audit rows |
| Module gating | `ModuleGatingGuard` — not bypassable |
| Production JWT ≥ 64 chars | `configuration.ts` superRefine + `deploy.ps1` |

---

## 28. Development vs Staging vs Production

| Concern | Development | Staging | Production |
|---|---|---|---|
| Database | Local portable PG cluster (port 15432) | Managed DB provider (separate URL) | Managed DB provider (separate URL) |
| Redis | Optional (Docker) | Optional | Optional (required for realtime Phase 8) |
| JWT secret | Short dev placeholder (OK) | Must be ≥ 32 chars | Must be ≥ 64 chars, non-placeholder |
| CORS origin | `http://localhost:5173` | Staging frontend URL | Production frontend URL (exact) |
| Bootstrap credentials | Default dev values (OK) | Must be rotated | **MUST be rotated before go-live** |
| Demo seed | Allowed (NEXUS_DEMO_SEED=true required) | Allowed for test data | **BLOCKED** (NODE_ENV=production guard) |
| Migrations | `prisma migrate dev` | `prisma migrate deploy` | `prisma migrate deploy` |
| Backups | Manual pg_dump | Managed PITR | Managed PITR + pre-deploy manual dump |
| API start | `npm run dev:api` (hot-reload) | `npm run start` | `npm run start` (via PM2/systemd) |

### Deployment to staging / production

Use `infra/scripts/deploy.ps1`:

```powershell
# Set environment variables (DATABASE_URL, JWT_ACCESS_SECRET, etc.)
powershell -File infra/scripts/deploy.ps1 -Environment production
```

The script: validates env → runs migrations → runs seed → health check.
It does NOT restart the API process (use PM2 or systemd for that).

See `docs/runbooks/deploy.md` for the complete pre-deployment checklist.

---

## 29. Fresh PC Checklist

```
[ ] Install Git (git-scm.com)
[ ] Install Node.js ≥ 20 LTS (nodejs.org)
[ ] Verify: node --version, npm --version
[ ] Install PostgreSQL ≥ 13 (postgresql.org — for portable cluster binaries)
[ ] Install VS Code (optional but recommended)
[ ] Clone repository: git clone https://github.com/YOUR_ORG/manhar-nexus.git
[ ] Open repository in VS Code: code .
[ ] Install dependencies: npm install
[ ] Create env file: Copy-Item .env.example apps\api\.env
[ ] Initialize database: npm run db:init
[ ] Apply migrations: npm run db:migrate
[ ] Start API (terminal 1): npm run dev:api
[ ] Verify API: curl http://localhost:3000/health
[ ] Seed demo data:
    $env:NEXUS_DEMO_SEED = "true"
    npm run demo:seed
[ ] Start web (terminal 2): npm run dev:web
[ ] Open http://localhost:5173 in browser
[ ] Login: demo.owner@pilot.nexus / PilotOwner@2024
[ ] Verify: Tables & Sessions visible
[ ] Run unit tests: npm test (expect 29 passing)
[ ] Run E2E tests: npm run test:e2e (expect 596 passing, ~3-4 min)
[ ] Run typecheck: npm run typecheck (expect no errors)
[ ] Run lint: npm run lint (expect no errors)
[ ] Run build: npm run build (expect clean build)
```

---

## 30. Zero-to-Running Quick Start (Experienced Developer)

**Prerequisites installed:** Node.js ≥ 20, npm ≥ 10, Git, PostgreSQL binaries on PATH

```powershell
# 1. Clone and install
git clone https://github.com/YOUR_ORG/manhar-nexus.git
cd manhar-nexus
npm install

# 2. Configure environment
Copy-Item .env.example apps\api\.env
# (Edit apps/api/.env if you need non-default settings)

# 3. Database
npm run db:init          # Creates portable PG cluster on port 15432
npm run db:migrate       # Applies all 17 migrations + generates Prisma client
                         # (Main seed runs automatically after migrate dev)

# 4. Demo data
$env:NEXUS_DEMO_SEED = "true"
npm run demo:seed

# 5. Start services (two terminals)
npm run dev:api          # Terminal 1 → http://localhost:3000
npm run dev:web          # Terminal 2 → http://localhost:5173

# 6. Verify
curl http://localhost:3000/health
# Open http://localhost:5173 → login: demo.owner@pilot.nexus / PilotOwner@2024

# 7. Test suite (optional but recommended)
npm run typecheck && npm run lint && npm test && npm run test:e2e
```

Total time to running: **~10–15 minutes** (mostly npm install + E2E suite duration).

---

## 31. Maintenance of This Guide

This guide must be updated whenever any of the following change in the repository:

| Change | Section(s) to update |
|---|---|
| Node.js or npm version requirement | §4, §29, §30 |
| New npm workspace scripts | §19, §20, §30 |
| Port changes | §15, §16, §17, §22, §23 |
| New or changed environment variables | §9 |
| Database technology change | §10, §25, §28 |
| Redis becomes required | §11, §28 |
| New migrations added | §12 |
| Demo seed data changes | §14 |
| New module activated | §2, §18 |
| New ADRs | §3 (docs/ listing) |
| Deployment procedure changes | §28 |
| Hardware dependencies | §26 |
| Security invariants added | §27 |
| Project structure changes | §3 |

**When updating:** Test every command you document. Remove instructions for things
that no longer exist. Date the "Last verified" timestamp at the top of this file.
