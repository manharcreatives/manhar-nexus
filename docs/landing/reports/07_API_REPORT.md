# 07 - API Report: public registration requests (Tier 1)

Agent: API. Date: 2026-10-31. Scope: `apps/api/**`, ADR-033, one roadmap changelog entry, one `deploy.md` table row. `apps/web` untouched.

## 1. What was built

A landing-page **lead capture**. A visitor submits the registration form; the API stores a `RegistrationRequest` and returns a reference code. Nothing is provisioned: no business, no user, no subscription, no charge. Platform staff triage the lead in the platform realm and, when it converts, run the existing provisioning flow and record the `businessId` on the request.

## 2. Endpoints

Web base is `/api` (Caddy `handle_path /api/*` strips the prefix; the API has no global prefix, so the Nest routes are exactly as below). In dev, call the API origin directly or through the Vite proxy as `auth/api.ts` does.

| Method + path | Auth | Notes |
|---|---|---|
| `POST /public/registrations` | none (`@Public()`) | throttled per IP; 202 / 400 / 429 |
| `GET /internal/registrations?status=&skip=&take=` | `platform.registration.view` | `skip` default 0, `take` default 50 (max 100); newest first; strict query |
| `GET /internal/registrations/:id` | `platform.registration.view` | 404 unknown, 400 malformed uuid |
| `PATCH /internal/registrations/:id` | `platform.registration.manage` | `{status?, assignedTo?, internalNotes?, businessId?}` (strict, at least one) |

Business-realm tokens get 403 (the guard blocks any `platform.*` permission for non-PLATFORM principals); no token gets 401.

### Public request (matches the binding contract in 03_PLAN.md)

```bash
curl -i -X POST http://localhost:3000/public/registrations \
  -H 'Content-Type: application/json' \
  -d '{
    "restaurantName": "Ananda Cafe",
    "contactName": "Asha Patel",
    "email": "asha@example.com",
    "phone": "+91 97145 71522",
    "city": "Visnagar",
    "businessKind": "cafe",
    "outlets": 2,
    "planKey": "floor",
    "billingCycle": "yearly",
    "message": "Two outlets, one kitchen.",
    "consent": true,
    "consentVersion": "2026-10-31",
    "website": "",
    "startedAt": 1793000000000
  }'
# HTTP/1.1 202 Accepted
# {"ok":true,"referenceCode":"NX-7K2Q9M"}
```

Rules the web form must follow:
- `consentVersion` must be **`2026-10-31`** (server allow-list `CONSENT_VERSIONS` in `registration.dto.ts`). Any other value is a 400. When the legal text changes, add the new version there and ship the form with it.
- `website` is the hidden honeypot: send `""` (or omit). `startedAt` = `Date.now()` captured when the form mounted (omit it and the time-trap is skipped). A human filling the form in under 2 s, or a future timestamp, is treated as a bot.
- `phone`: 7-20 chars, digits with optional leading `+`, spaces, dashes, brackets. `email` is trimmed and lower-cased by the server. Text fields are trimmed; control characters are rejected.
- `planKey`: counter | floor | pass | many-doors | not-sure. `billingCycle`: monthly | yearly. `businessKind`: restaurant | cafe | bakery | cloud-kitchen | hotel | food-court | other. `outlets`: integer 1-500. `message` optional, <= 1000. `consent` must be literal `true`.
- The success body is always exactly `{ok:true, referenceCode}`. Display the code; never expect anything else in it.

### Other responses

400 (standard envelope; the issue list names fields, never echoes submitted values):
```json
{"statusCode":400,"error":{"code":"VALIDATION","message":"Request validation failed","details":{"issues":[{"path":"email","message":"Invalid email"}]}},"requestId":"..."}
```
429 (throttler, standard envelope with `statusCode: 429`). The web client should treat network error / 5xx / 429 as "offer the Tier-0 mailto + WhatsApp fallback".

Platform examples:
```bash
curl -s http://localhost:3000/internal/registrations?status=NEW\&take=20 -H "Authorization: Bearer $PLATFORM_TOKEN"
# {"items":[{"id":"...","referenceCode":"NX-7K2Q9M","status":"NEW","restaurantName":"Ananda Cafe", ... ,"createdAt":"..."}],"total":1,"skip":0,"take":20}

curl -s -X PATCH http://localhost:3000/internal/registrations/$ID -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H 'Content-Type: application/json' -d '{"status":"CONTACTED","assignedTo":"Utsav","internalNotes":"Called; demo on Friday."}'
curl -s -X PATCH http://localhost:3000/internal/registrations/$ID -H "Authorization: Bearer $PLATFORM_TOKEN" \
  -H 'Content-Type: application/json' -d '{"status":"CONVERTED","businessId":"<uuid of the provisioned business>"}'
```
Staff views omit `ipHash`.

Status transitions (`REGISTRATION_TRANSITIONS`): NEW/CONTACTED/QUALIFIED move freely among themselves and to CONVERTED/REJECTED/SPAM; REJECTED can reopen; SPAM can go to NEW or REJECTED (recover a false positive); CONVERTED is terminal. `businessId` may only be set when the resulting status is CONVERTED and must be an existing business. Updates are compare-and-set on status (a concurrent change gives 409).

## 3. Environment variables

| Var | Dev | Production |
|---|---|---|
| `REGISTRATION_IP_SALT` | optional; fixed dev key `dev-only-registration-ip-salt-change-in-production` (hashes reproducible, not secret) | **REQUIRED**, >= 32 chars, dev key refused. Generate: `openssl rand -base64 48 \| tr -d '\n'`. The API refuses to boot without it. |
| `REGISTRATION_RATE_LIMIT` | 5 | 5 (POSTs per IP per window, in-memory per instance) |
| `REGISTRATION_RATE_TTL_MS` | 3600000 | 3600000 |

Also required in production (already the case): `TRUST_PROXY=1` (compose sets it) so `req.ip` is the visitor, not Caddy. Documented in `apps/api/.env.example` and in the `deploy/api.env` table of `docs/runbooks/deploy.md`. **Deploy action: add `REGISTRATION_IP_SALT` to `deploy/api.env` before shipping this build.**

## 4. Migration

`apps/api/prisma/migrations/20261031120000_registration_request/migration.sql` - additive, forward-only (ADR-019): `CREATE TYPE "RegistrationStatus"`, `CREATE TABLE "registration_request"`, unique index on `referenceCode`, indexes `(status, createdAt)`, `(email, createdAt)`, `(ipHash, createdAt)`. Apply with the normal `prisma migrate deploy`.

IMPORTANT honesty note: `prisma migrate diff` could **not** be run. The Prisma schema engine binary is downloaded from `binaries.prisma.sh`, which the sandbox egress policy blocks (403). The SQL is therefore hand-written in Prisma's emission style (UUID without a DB default, `TIMESTAMPTZ(6)`, `CURRENT_TIMESTAMP` default on `createdAt`, `-- CreateEnum/-- CreateTable/-- CreateIndex`). It was applied successfully to a real PostgreSQL 17 after all 18 earlier migrations. **Please run once on your machine** (needs a DB): `npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <scratch db> --script` and expect an empty diff (or `npx prisma migrate dev` reporting no drift). If it reports a difference, replace the SQL with its output.

## 5. Files touched

New:
- `apps/api/src/registration/registration.module.ts`, `.controller.ts` (public + admin controllers), `.service.ts`, `.dto.ts`, `.util.ts` (reference code, ipHash, UA truncation), `.limits.ts` (throttle env resolvers)
- `apps/api/src/registration/registration.util.spec.ts`, `registration.dto.spec.ts`
- `apps/api/test/registration.e2e-spec.ts`
- `apps/api/prisma/migrations/20261031120000_registration_request/migration.sql`
- `docs/adr/ADR-033-public-registration-requests.md`
- `docs/landing/reports/07_API_REPORT.md`

Edited (additive):
- `apps/api/prisma/schema.prisma` (enum + model appended at the end)
- `apps/api/src/app.module.ts` (import `RegistrationModule`)
- `apps/api/src/iam/permission.registry.ts` (+ `platform.registration.view|manage`, restricted); `permission.registry.spec.ts` (new assertion; no count-based test existed, `system-roles.catalog.spec.ts` needed no change because platform-admin holds the wildcard and no role lists platform permissions explicitly)
- `apps/api/src/config/configuration.ts` + `configuration.spec.ts` (`REGISTRATION_IP_SALT` with production rules, throttle vars)
- `apps/api/.env.example`, `docs/runbooks/deploy.md` (one table row), `docs/MASTER_IMPLEMENTATION_ROADMAP.md` (one dated changelog entry inserted at the top of section 10; nothing else rewritten)

## 6. Test status (no fabricated results)

Environment: Linux VM, Node 22, no system Postgres, Prisma engine downloads blocked by the egress allowlist.

Could be run and PASSED:
- `npm ci` in a copy (`$HOME/lpbuild-api`, outside the mount), `@nexus/shared` build, `tsc --noEmit` for `@nexus/api` (includes `test/**`): clean.
- ESLint on all of `apps/api/src` and `test/registration.e2e-spec.ts`: 0 errors, 0 warnings.
- `prisma validate`: schema valid. `prisma generate`: ok. (Both ran with dummy engine paths via `PRISMA_QUERY_ENGINE_LIBRARY`/`PRISMA_SCHEMA_ENGINE_BINARY`, since only the WASM schema tooling is needed for these.) `prisma format`: my block is already canonical (the rest of the file was already unformatted before my change).
- Unit tests (`npx jest`): 9 suites, 75 tests pass, including new `registration.util.spec.ts` (reference code alphabet/format/determinism, ipHash HMAC/keyed/IPv4-mapped/null, UA truncation), `registration.dto.spec.ts`, the updated `permission.registry.spec.ts` and `configuration.spec.ts` (production salt rules).
- **Real database run:** I started a throwaway PostgreSQL 17 (npm package `embedded-postgres`, in `$HOME/pgtmp`, outside the repo) and applied all 19 migration SQL files in order (mine included), ran the seed, then ran e2e with `--runInBand`:
  - `registration.e2e-spec.ts`: **28/28 pass** (202 shape and stored row, HMAC ipHash, UA truncation, no echo, distinct codes, no PII in logs, 400s for unknown key / bad email / consent false / bad consentVersion / allow-lists / bounds, honeypot, time-trap (past and future), blank honeypot not spam, 3-per-email cap, SPAM not counting to email cap, 5-per-IP cap, 429 on a separate app instance with other IPs unaffected, platform list 401/403/200, filter, pagination and query validation, get-one, PATCH transitions incl. terminal CONVERTED, SPAM recovery, businessId rules, body validation).
  - Regression e2e that touch the same surfaces, all pass (12 suites, 291 tests): auth, auth-ratelimit, security, onboarding, commercial, health, core, module-engine, config-center, business-locations, team-directory, audit-viewer.

Caveat on that DB run: the Rust query engine is also unobtainable, so in the scratch copy ONLY I set `engineType = "client"` in the generator and constructed `PrismaClient` with `@prisma/adapter-pg` (in `prisma.service.ts` and `seed.ts` of `$HOME/lpbuild-api`). The repo sources are unchanged (verified: no `adapter`/`engineType` in `D:\manhar-nexus`). Behaviour should be identical for these queries, but the standard engine path was not exercised.

NOT run:
- `prisma migrate diff` / `migrate deploy` / `migrate dev` (engine blocked) - see section 4.
- The other ~26 e2e suites (restaurant, checkout, printing, reports, costs, realtime, notifications ...) and the web test suites; they do not touch the new code paths but were not executed.
- Whole-repo `npm run lint` and `apps/web` typecheck (not my scope).
- No load or Caddy/TLS test; `X-Forwarded-For` behaviour was tested with `TRUST_PROXY=1` through Express only.

## 7. Security notes

- Lead only; unauthenticated input never provisions, never reads the `User` table, never echoes input; duplicates accepted silently (no enumeration).
- Layers: strict zod (unknown keys 400), per-IP throttle (default 5/h), DB caps (5 rows per ipHash/h counting all statuses; 3 per email/day excluding SPAM), honeypot, 2 s time-trap, consent allow-list, server-side `consentAt`.
- Capped requests are dropped (not stored) but still return a plausible 202 + code; honeypot/time-trap rows are stored as SPAM with `internalNotes = "auto: ..."` for staff to review and recover.
- Check-then-insert caps are not transactional: a burst can overshoot a cap by a request or two. Acceptable for lead capture.
- The throttle store is in-memory (per instance); the DB caps cover multi-instance. A time-trap false positive is possible if a visitor's clock is far ahead; hence SPAM is stored rather than dropped.
- ipHash is an HMAC (keyed), never the raw IP; rotating the salt only resets the 5-per-IP window for existing rows. Logs: reference code, registration id, outcome label only (asserted by a test). Staff API never returns `ipHash`.
- Audit: `AuditService` is per business so it cannot hold pre-tenant events; timestamps + structured logs are the trail.
- Without `TRUST_PROXY=1` behind Caddy, all visitors share one IP and would trip the per-IP controls together.

## 8. Follow-ups

1. **Platform UI "Requests" tab** in `apps/web/src/commercial/CommercialPage.tsx` (list with status filter, detail, set status/assignee/notes, "Create workspace" prefilling `NewRestaurantDialog` then PATCH `CONVERTED` + `businessId`). Out of scope here; the endpoints are ready.
2. **Cashfree integration point:** add `RegistrationService.createCheckout(referenceCode)` that creates a Cashfree payment link / subscription authorisation link server-side and returns a URL for a top-level redirect (keeps the CSP strict). Likely new nullable columns on `registration_request` (`paymentLinkUrl`, `paymentStatus`, `paidAt`) plus a signature-verified, idempotent webhook (ADR-008 discipline) that flips the lead to PAID and queues provisioning. Until then the form says "payment link shared after review".
3. Staff notification of new leads (ADR-012 mailer is spec-only): until then staff must open the list; consider an uptime/alert hook on the `registration received` log line.
4. Retention job for SPAM/REJECTED rows (DPDP) and a privacy-notice line about retention in the form copy.
5. Optional edge rate limit on `/api/public/*` in Caddy; Turnstile only if abuse appears (needs CSP changes).
6. Run the `migrate diff` verification from section 4 on a machine with Prisma engines; add `REGISTRATION_IP_SALT` to `deploy/api.env`.
7. Consent version bump procedure: add the new version to `CONSENT_VERSIONS` and deploy the form in the same release.
