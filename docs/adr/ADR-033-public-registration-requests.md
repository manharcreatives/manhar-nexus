# ADR-033: Public registration requests (landing-page lead capture)

- **Status:** ACCEPTED
- **Date:** 2026-10-31

## Context

The public landing page needs a "Register your restaurant" form. Until now every endpoint except `/health`, `/auth/login`, `/auth/refresh` and the print agent required a JWT, and tenants are created only by platform staff (`internal/businesses` + `provision`). There is no payment gateway integration yet (Cashfree is planned; ADR-008 abstraction exists, no adapter). A public endpoint that created a tenant or an owner login from an unauthenticated request would let anyone consume emails, create businesses and bypass payment verification.

## Decision

Collect a **lead**, never a tenant.

- `POST /public/registrations` (`@Public()`) stores a `RegistrationRequest` row and answers `202 { ok: true, referenceCode: "NX-XXXXXX" }`. It creates no business, user, subscription or charge.
- Platform staff triage the lead in the app (`/internal/registrations`, permissions `platform.registration.view` / `platform.registration.manage`, both restricted) and, if it converts, run the existing provisioning flow, then record the resulting `businessId` on the request (status `CONVERTED`, terminal).
- The table is **pre-tenant**: no `businessId` at creation, no tenant scoping, no `AuditService` entry (the hash chain is per business). The row's own timestamps plus structured logs are the trail; the platform actions that follow are audited by the existing provisioning calls.

### Contract (binding for the web form)

Body (zod `.strict()`): `restaurantName` 2-120, `contactName` 2-120, `email`, `phone` 7-20, `city` 2-80, `businessKind` in restaurant|cafe|bakery|cloud-kitchen|hotel|food-court|other, `outlets` int 1-500, `planKey` in counter|floor|pass|many-doors|not-sure, `billingCycle` monthly|yearly, `message?` <=1000, `consent: true`, `consentVersion` (server allow-list, currently `2026-10-31`), `website?` (honeypot), `startedAt?` (ms epoch). Every non-validation outcome returns the same 202 body; validation errors use the standard 400 envelope; throttling returns 429.

### Abuse controls (no CAPTCHA vendor: CSP `script-src 'self'` blocks third-party scripts by design)

1. Per-IP throttle on the route, default 5 per hour (`REGISTRATION_RATE_LIMIT` / `REGISTRATION_RATE_TTL_MS`), in-memory per API instance.
2. DB-backed caps that hold across instances: max 5 rows per `ipHash` per hour (all statuses), max 3 per email per day (SPAM rows excluded, so a bot cannot lock a real address out). A capped request still gets the uniform 202 but **nothing is stored**.
3. Honeypot `website` filled, or `startedAt` less than 2 s before now (or in the future): uniform 202, stored as `SPAM` with `internalNotes = "auto: honeypot|time-trap"` so staff can recover a false positive (SPAM -> NEW is allowed).
4. No enumeration: duplicates are accepted, the `User` table is never consulted, the response never echoes input, reference codes come from an unambiguous 30-character alphabet with a uniqueness retry.

### Privacy

- Visitor IP is stored only as `HMAC-SHA256(ip, REGISTRATION_IP_SALT)`. The salt is optional in development (fixed dev key, not secret) and **required in production** (>= 32 chars, dev key refused, like other secrets in `validateEnv`). It needs `TRUST_PROXY=1` behind Caddy, otherwise every visitor shares the proxy IP and the per-IP controls would throttle everyone together.
- User agent truncated to 200 chars. Logs carry the reference code, registration id and outcome label only, never email, phone or names.
- `consentVersion` is validated against a server allow-list and `consentAt` is the server clock; the client cannot forge either.
- Staff views never expose `ipHash`.
- DPDP-minded retention (delete `SPAM`/`REJECTED` rows after N days) is a follow-up job; it is not built.

### Data model and migration

`registration_request` + enum `RegistrationStatus` (NEW, CONTACTED, QUALIFIED, CONVERTED, REJECTED, SPAM). Migration `20261031120000_registration_request` is additive and forward-only (ADR-019). Plan, kind and cycle are validated at the API and stored as text so the catalogue can change without a migration.

## Consequences

- Positive: the landing page gets a real, abuse-resistant intake with no new infrastructure and no tenant-creation risk; the Cashfree integration point is clean: a later `createCheckout(referenceCode)` can attach to this row and return a payment-link URL.
- Positive: staff see leads in the existing platform realm using the standard permission model; platform-admin holds them through the wildcard.
- Negative: the in-memory throttle is per process (the DB caps cover multi-instance); caps are check-then-insert, so a burst can overshoot by a request or two.
- Negative: no email/WhatsApp notification to staff exists (ADR-012 is spec-only); staff must open the Requests list. A platform "Requests" tab in the web app is a follow-up.
- Negative: production deploys must now set `REGISTRATION_IP_SALT` or the API refuses to boot.

## Rejected alternatives

- Auto-provisioning from the public endpoint: no payment verification, abuse and email-consumption risk.
- Reusing `ConflictError` for duplicate emails: it leaks which addresses are registered.
- A CAPTCHA widget: blocked by the strict CSP; honeypot + time-trap + throttle + DB caps are the captcha-less path (Cloudflare Turnstile would need CSP additions if abuse appears).
