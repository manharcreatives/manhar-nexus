# ADR-019: Data Access & Migrations — Prisma ORM

- **Status:** ACCEPTED
- **Date:** 2026-08-23

## Context
Phase 1 requires an established migration strategy before domain models land in Phase 2. Requirements: reviewable SQL migrations, type-safe queries, PostgreSQL-first.

## Decision
Use **Prisma** (`prisma/schema.prisma` as schema-of-record; `prisma migrate` for versioned SQL migrations committed under version control; generated client for type-safe access). Raw SQL remains available inside migrations for constraints/triggers/indexes Prisma cannot express (partial indexes, RLS policies).

## Consequences
- Migration discipline: every schema change = new migration file, reviewed like code, applied forward-only in staging→prod; `migrate dev` reserved for local development.
- Engine binaries are a build-time dependency; CI caches npm artifacts to keep pipelines fast.
