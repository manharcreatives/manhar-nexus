# ADR-022: Platform-Admin Identity Replaces the Internal-Admin Shared Secret

- **Status:** ACCEPTED (supersedes ADR-020)
- **Date:** 2026-08-24

## Context
ADR-020 guarded `/internal/*` with a single shared `INTERNAL_ADMIN_TOKEN` — a known temporary platform *master key*: unscoped, not individually revocable, not attributable to a person, and a total-compromise risk on leak. Phase 3 introduces real authentication + RBAC, so the bridge can and must be retired.

## Decision
Model **two realms in one `User` table** via `user.realm` (`PLATFORM` | `BUSINESS`) with a nullable `businessId` (a DB CHECK enforces `PLATFORM ⇒ businessId NULL`, `BUSINESS ⇒ businessId NOT NULL`).
- **Platform realm** = Manhar internal staff; cross-business; holds `platform.*` permissions (the seeded `platform-admin` role has the `*` wildcard).
- **Business realm** = client users; scoped to exactly one business; their `TenantScope.businessId` is derived from the authenticated principal, never the URL.
- `/internal/*` is re-authorized by the global `JwtAuthGuard` + `PermissionGuard` requiring platform-namespaced permissions; the `PermissionGuard` additionally requires `realm = PLATFORM` for any `platform.*` permission, so a business wildcard can never reach the platform realm.
- The `InternalAdminGuard` and `INTERNAL_ADMIN_TOKEN` are **removed entirely** (no break-glass shared secret retained). The first platform admin is provisioned idempotently by the seed from `PLATFORM_BOOTSTRAP_EMAIL`/`PLATFORM_BOOTSTRAP_PASSWORD`; production refuses to boot on the dev placeholder values.

## Consequences
- Every `/internal` action is now attributable to an individual, individually-revocable platform user and audited with a real actor id (the `ActorType.INTERNAL_ADMIN` enum value is retained for audit continuity, derived from `realm = PLATFORM`).
- ADR-020's master-key risk is closed: no standing unscoped secret exists.
- Re-provisioning the first platform admin (break-glass) requires database access (re-running the seed), which is already a privileged operation — no weaker path is introduced.
- Business users physically cannot reach `/internal` (realm + permission checks); cross-business isolation is enforced by principal-derived scope on top of the Phase-2 repository layer.
