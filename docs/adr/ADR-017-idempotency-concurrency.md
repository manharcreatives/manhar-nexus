# ADR-017: Idempotency Keys + Optimistic Concurrency

- **Status:** ACCEPTED
- **Date:** 2026-08-23

## Context
Spec: "a duplicate tap should not create duplicate service requests." Rush hour produces double-taps and simultaneous editors.

## Decision
All state-changing endpoints accept a client-generated idempotency key; replays return the original result without side effects. Hot aggregates (guest session, service request, checkout, cash counter) carry a version column; conflicting concurrent writes fail with a typed conflict error the UI resolves (refresh-and-reconcile), never silently overwrite.

## Consequences
- Duplicate-protection is systemic, not per-feature heroics.
- Conflict UX pattern standardized once in Phase 8.
