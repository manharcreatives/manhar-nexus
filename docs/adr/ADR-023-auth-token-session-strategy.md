# ADR-023: Authentication Token, Session, Lockout & Rate-Limit Strategy

- **Status:** ACCEPTED (implements ADR-004)
- **Date:** 2026-08-24

## Context
ADR-004 mandates argon2 admin passwords, short-lived JWT access + rotating refresh, and session revocation ≤60s. Redis is unavailable in the current environment (BLOCKER-B01), so all mechanisms must be Redis-free and correct on a single instance.

## Decision

**Passwords.** argon2id, params from env (OWASP-2024 floor: m=19456, t=2, p=1), full PHC string stored. Unknown-user logins run a dummy verify so timing doesn't reveal account existence.

**Access token.** HS256 JWT, TTL 300s, secret from env (min 32 chars, prod refuses the dev placeholder). Verified with a **pinned algorithm** (rejects `alg:none`/confusion) and `typ:'access'`. Claims carry `sub/bid/realm/sid/sv/tv` — **never permissions**, so authorization changes take effect on the next request.

**Refresh token.** Opaque 32-byte random, **only its sha256 is stored**, single-use rotating, carrying a `familyId`. Presenting an already-rotated token ⇒ theft ⇒ the whole family (session) is revoked. Sliding TTL (30d) capped by an absolute session TTL (90d).

**≤60s revocation.** The hard guarantee is a per-request check in `JwtAuthGuard`: the session must exist, be unrevoked, unexpired, and match `sessionVersion`; the user must be `ACTIVE` with a matching `tokenVersion`. Logout revokes the session; logout-all / permission-suspension bump `tokenVersion`. (An in-process validity cache is a documented future optimization; correctness-first now.)

**Lockout.** Per-account: after `AUTH_MAX_FAILED_ATTEMPTS` (5) consecutive failures, `lockedUntil = now + AUTH_LOCKOUT_MINUTES` (15). Lockout state is disclosed only after a correct password (not to anonymous guessers). Per-account (not global) to avoid a lock-everyone DoS.

**Rate limiting.** Coarse in-memory per-IP throttle on `/auth` (`@nestjs/throttler`, env-configurable `AUTH_RATE_LIMIT`/`AUTH_RATE_TTL_MS`). Single-instance today; Redis-backed when horizontal scaling arrives (Phase 8).

**Login telemetry.** All attempts (success/failure/lockout/reuse) are recorded to a `login_event` table (includes pre-auth failures with no trustworthy tenant), kept separate from the hash-chained per-business audit stream.

## Consequences
- No permissions in the JWT means one small per-request authz query; acceptable at admin volumes, cacheable later.
- All in-memory mechanisms (throttle) are per-instance — documented; revisit with Redis at scale.
- HS256 is a symmetric master key; migrate to RS/EdDSA when a second independent verifier appears (e.g. the realtime gateway / print agent, Phase 8+).
- TOTP MFA columns are reserved but unused (deferred per ADR-004).
