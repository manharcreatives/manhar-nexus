# ADR-009: Connectivity — Interruption-Tolerant, Full Offline Is FUTURE

- **Status:** ACCEPTED (product decision)
- **Date:** 2026-08-23

## Context
Venues have imperfect internet. Spec demands no data loss during network interruption but full offline POS is explicitly out of MVP scope.

## Decision
MVP guarantees: draft preservation locally, explicit pending/failed states, automatic retry with idempotent resubmission, reconnect + snapshot resync (ADR-006), clear user feedback at all times. The system NEVER claims offline capability it does not have; marketing/product language reflects this honestly.

## Consequences
- No local database/sync engine in MVP.
- Any workflow that cannot tolerate a mid-step disconnect must be redesigned before build (design-review checklist item).
