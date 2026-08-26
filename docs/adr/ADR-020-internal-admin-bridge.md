# ADR-020: Internal-Admin Access Bridge (temporary, Phase 2 → Phase 3)

- **Status:** SUPERSEDED by [ADR-022](ADR-022-platform-admin-identity.md) (Phase 3, 2026-08-24). The shared-secret `InternalAdminGuard` and `INTERNAL_ADMIN_TOKEN` were removed; `/internal/*` is now authorized by platform-realm users.
- **Date:** 2026-08-23

## Context
Phase 2 (Nexus Core) must expose `/internal/*` admin endpoints to create and configure Business Workspaces, Locations, and settings so that later phases (and pilots) have real tenants to operate on. Real authentication (admin password + TOTP, users, RBAC — ADR-004) does not land until Phase 3. Shipping tenant-mutating endpoints with no server-side authorization — even in a foundation phase — is unacceptable.

## Decision
Introduce a **provisional shared-secret guard** (`InternalAdminGuard`) protecting every `/internal/*` route:
- Requires header `x-internal-admin-token` matched against the `INTERNAL_ADMIN_TOKEN` env secret using a constant-time comparison.
- **Fail-closed:** if `INTERNAL_ADMIN_TOKEN` is unset/empty, all `/internal` requests are denied.
- On success the request is stamped with the `INTERNAL_ADMIN` actor, recorded on every audit event these calls produce.
- These endpoints represent the **Manhar Creatives internal realm** (which legitimately sees all businesses); tenant-facing scoping for real users arrives with ADR-004.

## Consequences
- No unauthenticated tenant mutation is ever possible, at any phase.
- This is a bridge, not a foundation: Phase 3 replaces the guard with real identity/RBAC and re-homes the actor model (`INTERNAL_ADMIN` becomes a proper internal user/role). No further capability should be built on the shared-secret mechanism.
- The secret is environment-provided (gitignored `.env`, documented in `.env.example`); never committed. Rotating it invalidates all internal access immediately.

## Known risk (accepted for Phase 2, closed in Phase 3)
The single shared secret is effectively a **platform master key**: it is not scoped to any business, so a leak grants read/modify of *every* tenant. Tenant-vs-tenant isolation remains sound (verified by the cross-business denial suite), but there is no per-business authorization until ADR-004 lands. Mitigations in force now: (a) the token is compared in constant time and **never logged** — the request logger emits only method/url/status, never headers; (b) it must be high-entropy per environment. **Deferred to Phase 3:** per-business actor scoping (ADR-004) and rate-limiting/lockout on `/internal/*`. Until then, treat the token as a production secret with the same handling as a root credential.
