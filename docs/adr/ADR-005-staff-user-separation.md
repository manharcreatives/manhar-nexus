# ADR-005: Staff ≠ User

- **Status:** ACCEPTED (product decision)
- **Date:** 2026-08-23

## Context
A staff member may exist without login access (e.g., delivery hand, chef), and login identities must remain cleanly manageable without entangling HR-ish data.

## Decision
`Staff Profile` and `User` are separate entities. A Staff Profile MAY have 0..1 linked User (login identity). Team/HR features (shifts, attendance, performance) attach to Staff Profiles; authentication and permissions belong to Users. Shared-device PIN login maps device-session → User → attribution while the Staff Profile carries employment context.

## Consequences
- Phase 3 seeds the linkage groundwork; full Team module arrives later (P16 candidate).
- Deactivating a user never deletes the staff record (history preservation rule).
