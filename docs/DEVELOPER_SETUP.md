# Developer Setup — Manhar Nexus

Target audience: engineers setting up a fresh machine for Nexus development.

## Prerequisites

| Tool         | Version | Notes                                              |
| ------------ | ------- | -------------------------------------------------- |
| Node.js      | >= 20   | Developed against v24; `engines` enforces >= 20.    |
| npm          | >= 10   | Workspaces via npm.                                |
| PostgreSQL   | any     | **Binaries only** — see Portable Database below.    |
| Docker       | optional| Only needed for Redis/MinIO live verification (B01).|

## Quickstart

```powershell
npm install          # installs workspaces + builds @nexus/shared (postinstall)
npm run db:init      # creates + starts portable PG cluster on :15432, creates db "nexus"
npm run dev:api      # NestJS on http://localhost:3000
npm run dev:web      # Vite dev server on http://localhost:5173 (proxies /api -> 3000)
```

Health check:

```powershell
curl http://localhost:3000/health
```

Expected body shape:

```json
{
  "status": "ok",
  "components": [{ "name": "database", "status": "up", "required": true }]
}
```

HTTP semantics — `200` when `ok` or `degraded`, `503` when `error`
(any required dependency down). Storage (MinIO) is **optional** by default
(`STORAGE_REQUIRED=false`), so its outage alone yields `degraded`.

## Ports (canonical dev topology)

| Service        | Port  | Source                     |
| -------------- | ----- | -------------------------- |
| API            | 3000  | `apps/api/.env.example` / defaults  |
| Web            | 5173  | Vite default               |
| PostgreSQL     | 15432 | docker-compose + pg script |
| Redis          | 16379 | docker-compose             |
| MinIO S3       | 19000 | docker-compose             |

Nonstandard ports are deliberate: they avoid colliding with system services,
and they sit **below the Windows ephemeral port range** (typically 49152+),
which Windows NAT carves into reserved exclusions that change per boot — a
port like 54329 can silently become unbindable (KI-01 lesson, 2026-08-23).

## Portable PostgreSQL (no Docker)

The repo ships `infra/scripts/dev-postgres.ps1`, which manages a **project-local**
cluster under `infra/.local/pgdata` using the PostgreSQL binaries already
installed on Windows (`C:\Program Files\PostgreSQL\*`). It never touches the
Windows service instance and uses `-A trust` auth bound to localhost.

```powershell
npm run db:init     # initdb + start + create database "nexus"
npm run db:start    # start existing cluster
npm run db:stop     # stop cluster
```

Connection string used by the API by default:
`postgresql://nexus@localhost:15432/nexus?schema=public`

If PostgreSQL is installed somewhere unusual, set `NEXUS_PG_BIN` to its `bin`
directory before running the script.

### Redis / MinIO locally

`docker-compose.dev.yml` defines both, but Docker is not yet available on this
machine (roadmap BLOCKER-B01). Until then the API boots fine without them:
`/health` will honestly report them as down (`error`) — that is expected
behavior, not a bug. Install Docker Desktop later and run:

```powershell
docker compose -f docker-compose.dev.yml up -d
```

## Your First Test Restaurant

After the API and web are running, populate a full synthetic restaurant in one command:

```powershell
$env:NEXUS_DEMO_SEED = "true"
npm run demo:seed
```

This creates **"The Pilot Kitchen"** with:
- 4 users: owner / cashier / kitchen-team / waiter (credentials printed at end of script)
- Restaurant, Catalog, Checkout, and Operating Costs modules activated
- Tax categories, 12 menu items across 4 categories, 6 tables across 2 dining areas
- 4 expense categories

Log in at http://localhost:5173 with `demo.owner@pilot.nexus` / `PilotOwner@2024`.

> The seed is fully idempotent — safe to re-run. It is **blocked in production** (`NODE_ENV=production` check in the script).

For a real pilot restaurant, see `docs/runbooks/pilot-setup.md` (Path B — Manual API Setup).

## Environment

Copy `apps/api/.env.example` to `apps/api/.env` if you need non-defaults.
Every variable has a working development default; invalid values fail fast at
boot via zod validation.

## Quality gates

```powershell
npm run lint        # eslint (flat config)
npm run typecheck   # tsc across all workspaces
npm test            # unit tests (Jest API / Vitest web)
npm run test:e2e    # supertest e2e against the real AppModule (no infra needed)
```

E2e tests require no running infrastructure: dependency probes are overridden,
plus one offline-boot regression test that proves the app starts and reports
truthful health even with every dependency down.

## Troubleshooting

- **Port 15432 in use** — another process grabbed it; stop it or change `PgPort`
  in `dev-postgres.ps1` plus `DATABASE_URL`.
- **initdb locale errors** — pass `-E UTF8` is already handled; ensure the
  PostgreSQL version is >= 13.
- **`@nexus/shared` not found** — run `npm install` again (postinstall builds it).
