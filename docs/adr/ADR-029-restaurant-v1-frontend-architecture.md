# ADR-029 — Restaurant V1 Frontend Architecture

**Date:** 2026-08-25  
**Status:** Accepted  
**Phase:** 15

---

## Context

Phase 15 gap analysis (Phase 15, first action) identified two critical gaps preventing pilot readiness:

1. **No restaurant frontend** — `AppShell` contained zero navigation items for restaurant-specific pages (tables, orders, kitchen, checkout). The backend API for restaurant operations existed and was fully tested (514/514 E2E green), but there was no way for a restaurant user to interact with it.

2. **System roles missing restaurant/catalog/checkout permissions** — Non-owner roles (`location-manager`, `checkout-associate`, `service-team`, `host`, `kitchen-team`) had no `restaurant.*`, `catalog.*`, or `checkout.*` permissions. Only `owner` (wildcard `*`) and `platform-admin` (wildcard) could actually use restaurant features at runtime.

---

## Decisions

### 1. Single-file per page, not a component library

Each restaurant page (`TablesPage.tsx`, `KitchenPage.tsx`) is a self-contained file with its own sub-components declared locally. The project is at pilot stage with one restaurant client. Premature abstraction into a shared component library would add maintenance cost without value.

**Alternative rejected:** Shared design system with reusable `TableCard`, `KitchenTicket`, `Badge` components. Rejected because single-client pilot scope doesn't justify it; every page can be refactored when the pattern repeats across a second client.

### 2. Restaurant API client (`restaurant/api.ts`) typed at the call site

A single API module declares all TypeScript interfaces alongside the fetch calls. This is consistent with the existing `reports/api.ts` pattern and keeps the mental model simple: one file per domain, types and calls co-located.

**Alternative rejected:** Shared type generation from OpenAPI spec. Rejected as premature — the backend is stable and typed via Prisma; generating types from a spec adds a build step for no immediate benefit.

### 3. Inline view state over React Router

`TablesPage` uses an enum state (`view: 'floor' | 'session' | ...`) instead of React Router routes. The restaurant UI is POS-speed focused — navigating between table grid and session detail is a context switch, not a URL-addressable page. Back-browser-button semantics are not needed.

**Alternative rejected:** React Router with `/admin/tables/:id/session` etc. Rejected because it would require route configuration in `App.tsx`, a router provider, and URL synchronization for what are effectively ephemeral modal overlays.

### 4. Permission keys use the module-manifest's registered keys

System roles use the exact permission keys defined in `module-manifest.ts` (e.g. `restaurant.dining.view`, `catalog.item.manage`, `checkout.invoice.create`). The `CORE_PERMISSIONS` array in `permission.registry.ts` was not extended — module-specific permissions are registered by the `ModuleRegistry.onModuleInit()` loop, which is the established pattern (Phase 5).

**Alternative rejected:** Adding module permissions to `CORE_PERMISSIONS`. Rejected because it would create duplicate-registration errors at startup (the `PermissionRegistry` throws on duplicates), and it would couple the core IAM module to vertical modules.

### 5. Checkout flow: getOrCreate → finalise → pay in-browser

The checkout panel in `TablesPage` performs the full invoice lifecycle (getOrCreate → finalise → pay) as a sequential browser-side flow. This matches the documented API flow (`POST /sessions/:id/invoice` → `POST /invoices/:id/finalise` → `POST /invoices/:id/payments`) from ADR-028 testing.

Invoice idempotency is handled server-side (`getOrCreate` semantics). Payment idempotency uses `crypto.randomUUID()` as the `idempotencyKey` — unique per payment attempt, which is correct (re-trying with the same key would produce the same result, but each distinct payment attempt gets a fresh key to avoid the accidental idempotent case where the cashier means to try again after a failure).

### 6. Kitchen page auto-refreshes every 15 seconds

Kitchen staff cannot rely on a React state update from the waiter's browser. The KitchenPage polls `GET /admin/kitchen` every 15 seconds and updates optimistically on button clicks. This covers the pilot scale (1–2 concurrent sessions, low ticket volume).

**Alternative rejected:** WebSocket push (ADR-006). Correct long-term design but Phase 6/realtime is not yet implemented. Polling at 15-second intervals is sufficient for pilot.

### 7. Floor page auto-refreshes every 30 seconds

Table status (AVAILABLE/OCCUPIED/CLEANING) is less time-critical than kitchen status. 30-second polling matches the rhythm of a floor check-in.

---

## Consequences

### Positive

- Restaurant operations are now accessible to all staff roles via the frontend.
- Non-owner roles (`service-team`, `host`, `kitchen-team`, `checkout-associate`, `location-manager`) now have the correct restaurant/catalog/checkout permission grants — pilot staff can be given appropriate roles.
- The floor → session → order → kitchen → checkout → close flow is complete end-to-end.
- 514/514 E2E tests remain green (no regressions from permission changes).

### Negative / Trade-offs

- No real-time push: waiters won't see kitchen updates unless they navigate away and back, or wait for the 30-second refresh.
- Business/Location selectors in the AppShell header are still disabled (Phase 15 condition). The restaurant pages load data without an explicit `locationId` filter when the selector is absent — this works for single-location pilots but will need to be addressed before multi-location rollout.
- No catalog management page — the owner can add menu items via the configuration module or API directly; a dedicated menu management page is deferred to post-pilot.

### Conditions carried forward from Phase 14

- [ ] Physical printer validation (ESC/POS) before first live transaction
- [ ] Staging restore drill before pilot launch
- [ ] Production credential rotation before go-live
- [ ] Business/Location selector must be wired before multi-location pilot

---

## Pilot Readiness Assessment (Phase 15 partial)

| Area | Status |
|---|---|
| Restaurant backend (sessions/orders/kitchen/checkout) | ✅ Complete (Phase 7–9) |
| System roles — restaurant/catalog/checkout permissions | ✅ Fixed (Phase 15) |
| Permission registry — module permissions registered | ✅ Via module-manifest (existing design, no gap) |
| Restaurant frontend — Tables & Sessions page | ✅ Built (Phase 15) |
| Restaurant frontend — Kitchen Display page | ✅ Built (Phase 15) |
| Restaurant frontend — Catalog management | ⚠️ Deferred (owner uses API or config) |
| AppShell navigation — restaurant section | ✅ Added (Phase 15) |
| Business/Location selector in header | ⚠️ Still disabled |
| Real-time kitchen push | ⚠️ Polling fallback (15s) — sufficient for pilot |
| E2E regression | ✅ 514/514 green |
