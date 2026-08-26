# ADR-002: Multi-Tenant Cloud SaaS First

- **Status:** ACCEPTED (product decision)
- **Date:** 2026-08-23

## Context
Clients range from single cafés to future chains; economics require one shared platform. Dedicated/on-prem may be needed later for selected enterprise clients.

## Decision
Primary architecture is multi-tenant cloud SaaS. Single shared PostgreSQL database, shared schema, mandatory `business_id` discriminator enforced at the repository layer (optional Postgres RLS as defense-in-depth). Location-level isolation within businesses via `location_id` scoping. Deployment configuration stays portable so a dedicated/private instance = same image + isolated environment.

## Consequences
- Every table carries `business_id NOT NULL` where tenant-scoped.
- Cross-tenant denial tests are mandatory from Phase 2 onward.
- No schema-per-tenant complexity now; migration path to dedicated instances remains open without code forks.
