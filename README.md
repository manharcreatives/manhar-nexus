# Manhar Nexus

> One Platform. Configure It Your Way.

Modular multi-business operations platform (Core + Modules + Configuration),
built as a modular monolith: NestJS API, React web app, PostgreSQL via Prisma.

## Repository layout

```
apps/
  api/      NestJS HTTP API (health, config, logging, Prisma)
  web/      React + Vite SPA shell (i18n-ready, Tailwind v4)
packages/
  shared/   Cross-cutting contracts (ports, health semantics, request ids)
infra/
  scripts/  Portable local infrastructure (PostgreSQL without Docker)
deploy/     Caddyfile (public edge) + compose env template
scripts/    backup / restore / smoke (PowerShell + bash); scripts/qa/ = dev-only per-role browser sweep (see scripts/qa/README.md)
Dockerfile.api, Dockerfile.web, docker-compose.prod.yml   Production images + stack
docs/
  MASTER_IMPLEMENTATION_ROADMAP.md   Living phase tracker — start here
  DEVELOPER_SETUP.md                 Machine setup + daily workflow
  spec-normalized/                   Canonical glossary, requirement register
  adr/                               Architecture decision records (001–030)
  PROJECT_SETUP_AND_TRANSFER_GUIDE.md   New-machine setup & transfer guide
```

## Getting started

```powershell
# Install dependencies (builds @nexus/shared + generates Prisma client)
npm install

# Initialize local PostgreSQL cluster + apply migrations
npm run db:init && npm run db:migrate

# Start API (terminal 1) and web (terminal 2)
npm run dev:api
npm run dev:web
```

API: `http://localhost:3000/health` · Web: `http://localhost:5173`

For a complete new-machine setup (clone → running in minutes), see:
[docs/PROJECT_SETUP_AND_TRANSFER_GUIDE.md](docs/PROJECT_SETUP_AND_TRANSFER_GUIDE.md)

See [docs/DEVELOPER_SETUP.md](docs/DEVELOPER_SETUP.md) for the daily development workflow.

## Documentation map

- **Roadmap & status** — `docs/MASTER_IMPLEMENTATION_ROADMAP.md` (phases, gates,
  decisions, blockers; updated every phase).
- **Transfer guide** — `docs/PROJECT_SETUP_AND_TRANSFER_GUIDE.md` (new-machine setup,
  prerequisites, all commands, troubleshooting; verified against the actual repository).
- **Terminology** — `docs/spec-normalized/CANONICAL_GLOSSARY.md` (Service Request,
  Checkout, KOS, Sold-Out, Business Workspace…). Use these terms in code, UI and
  docs.
- **Deploying** — `docs/ui/DEPLOYMENT_READINESS.md` (operator checklist) and
  `docs/runbooks/` (deploy, backup-restore, rollback, incident-response).
- **Decisions** — `docs/adr/` (ADR-001…ADR-030). Propose changes by adding a new
  ADR, never by editing accepted ones.
