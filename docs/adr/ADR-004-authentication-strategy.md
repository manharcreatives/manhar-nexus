# ADR-004: Authentication Strategy — Admin Password + Frontline Device/PIN

- **Status:** ACCEPTED (product direction confirmed)
- **Date:** 2026-08-23

## Context
Two very different populations use Nexus: back-office/admin staff and frontline workers sharing tablets during rush hour. Spec requires shift-based/temporary credentials rather than shared accounts, with full action attribution.

## Decision
- **Admin/internal:** email + password (argon2 hashing), short-lived JWT access token + rotating refresh token, optional TOTP MFA, session revocation effective ≤60s.
- **Frontline:** registered Device + individual PIN quick-login; sessions bound to device + shift; every action attributed to the specific User behind the PIN. One-shared-account-for-everyone is prohibited wherever auditability matters.

## Consequences
- Device registry + trust model becomes core infrastructure (Phase 3).
- PIN policy (length, lockout, rotation) configurable per business.
- Login events audited; permission changes revoke live sessions within 60s (tested).
