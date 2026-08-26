# ADR-021: Core Tenant Scoping, Settings Precedence & Per-Business Serialization

- **Status:** ACCEPTED
- **Date:** 2026-08-23

## Context
Nexus Core is the foundation every vertical inherits. It must make three things structural (not per-feature heroics): tenant isolation (ADR-002), atomic + tamper-evident audit (ADR-016), and safe concurrency (ADR-017). It also defines the typed Configuration engine (Master §2) shared by all modules.

## Decision

**Tenant scoping.** A `TenantScope { businessId, locationId?, actor }` is passed **explicitly** into every service call (never read from ambient/global state), so isolation is visible and testable. Tenant-scoped data access extends `TenantScopedRepository`, whose `scoped(scope, where)` injects the mandatory `businessId` filter and `assertOwned(row, scope)` provides defense-in-depth. The tenant root (`business`) and the global `business_type` catalog are intentionally not business-scoped. Postgres RLS remains a future defense-in-depth layer (ADR-002), not a substitute for repository-layer enforcement.

**Settings precedence.** Effective value = location override → business value → registry default. Values are typed and validated against a `SettingsRegistry` (unknown keys rejected — configuration is typed, not a free-form bag); modules register their own definitions later through the same seam. Every write is versioned (optimistic concurrency) and audited.

**Per-business serialization.** All mutations acquire a transaction-scoped Postgres advisory lock keyed by `businessId` (`pg_advisory_xact_lock`) *before* their read-modify-write. This serializes audit appends (gapless per-business `sequence`, single well-defined predecessor hash), setting upserts (no lost updates), and number allocation (no duplicate numbers) — while different businesses never contend. Audit append runs **inside** the same transaction as the change it records, so history is atomic with the mutation.

**Numbering.** Gapless allocation via the same lock; consumed numbers are never reused (supports ADR-016 "voided numbers stay consumed forever").

## Consequences
- Every future tenant-scoped table/service follows this pattern; cross-business denial tests are mandatory per endpoint family (born in Phase 2's e2e isolation suite).
- The advisory lock briefly serializes writes per business — acceptable at expected per-tenant write rates; if a hot aggregate ever needs finer-grained concurrency, it can use row-level `SELECT … FOR UPDATE` instead without changing the isolation model.
- Audit hashing canonicalizes JSON (sorted keys) and hashes an explicit ISO-8601 millisecond timestamp, so the chain re-verifies deterministically.
