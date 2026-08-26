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
docs/
  MASTER_IMPLEMENTATION_ROADMAP.md   Living phase tracker — start here
  DEVELOPER_SETUP.md                 Machine setup + daily workflow
  spec-normalized/                   Canonical glossary, requirement register
  adr/                               Architecture decision records (001–019)
```

## Getting started

```powershell
npm install && npm run db:init && npm run dev:api
```

See [docs/DEVELOPER_SETUP.md](docs/DEVELOPER_SETUP.md) for the full guide.

## Documentation map

- **Roadmap & status** — `docs/MASTER_IMPLEMENTATION_ROADMAP.md` (phases, gates,
  decisions, blockers; updated every phase).
- **Terminology** — `docs/spec-normalized/CANONICAL_GLOSSARY.md` (Service Request,
  Checkout, KOS, Sold-Out, Business Workspace…). Use these terms in code, UI and
  docs.
- **Decisions** — `docs/adr/` (ADR-001…ADR-019). Propose changes by adding a new
  ADR, never by editing accepted ones.
