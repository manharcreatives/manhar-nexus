# ADR-003: Technology Stack — TypeScript / NestJS / React-Vite

- **Status:** ACCEPTED
- **Date:** 2026-08-23

## Context
Platform needs: modular backend matching the registry concept, tablet-first frontline UI, realtime, strong typing for financial correctness, single-language team efficiency.

## Decision
- Backend: **NestJS (TypeScript)** — its module system maps naturally onto the Nexus module engine; strict TS everywhere.
- Frontend: **React + Vite SPA** (tablet-first PWA-capable), focused full-screen bundles for Service Console/KOS/Checkout.
- Realtime: WebSocket rooms per business/location + snapshot-on-reconnect.
- Node.js ≥ 20 LTS line (dev machine currently v24).

## Consequences
- One language across API/web/shared package.
- NestJS guards/interceptors provide natural enforcement points for module gating, permissions, logging, request-id.
- Alternatives considered (Laravel, .NET) recorded here for history; rejected on typing + module-model fit.
