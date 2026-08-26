# ADR-010: Configurable Tax Engine Now; E-Invoicing Later

- **Status:** ACCEPTED (product decision)
- **Date:** 2026-08-23

## Context
GST correctness matters in India, but compliance depth varies per client and e-invoicing/filing automation is future/open commercial scope.

## Decision
Build a configurable tax engine in Phase 9: tax rates, tax components, inclusive/exclusive pricing, item/category assignment, exemptions, invoice configuration. No hard-coded single-restaurant assumptions. GST compliance review gates production scale; e-invoicing/filing automation deferred until explicitly required.

## Consequences
- Tax math gets property-based invariant tests (line totals recomputable).
- Invoice formats configurable; compliance review checklist added to Phase 14 gate.
