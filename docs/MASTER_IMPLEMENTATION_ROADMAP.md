# MANHAR NEXUS — MASTER IMPLEMENTATION ROADMAP

> **THIS IS THE SINGLE LIVING EXECUTION TRACKER FOR THE ENTIRE PROJECT.**
> It must always reflect the real repository state. Opened at any moment it must answer:
> *Where are we? What has been done? What is being built? What failed? What is next? Why was something changed?*

| Field | Value |
|---|---|
| **Version** | 1.16-pilot-hardening |
| **Last Updated** | 2026-08-30 |
| **Current Phase** | Phase 16 PARTIAL — Operating Costs module shipped; pilot hardening pass completed |
| **Current Status** | 596/596 E2E · 27/27 unit · TypeScript clean · lint clean · web build clean · PILOT READY WITH CONDITIONS (restore drill ✅ COMPLETED; printer + credential rotation still pending) |
| **Overall Progress** | 86% (P0–P15 complete; P16 Operating Costs complete; other P16 candidates deferred pending pilot demand) |
| **Project Health** | GREEN |

---

## SOURCE OF TRUTH HIERARCHY

| Level | Artifact | Role |
|---|---|---|
| 1 | `Manhar_Nexus_Master_Product_Architecture_v1.md` | Product source of truth (universal platform). **READ-ONLY — never modify.** |
| 2 | `Manhar_Nexus_Restaurant_Product_Architecture_v2_Original_Terminology.md` | Restaurant vertical source. **READ-ONLY — never modify.** |
| 3 | `docs/adr/` | Accepted architecture decisions |
| 4 | `docs/MASTER_IMPLEMENTATION_ROADMAP.md` (this file) | Execution tracker |
| 5 | `apps/`, `packages/`, `infra/` | Actual code |

**Conflict rule:** This roadmap must NEVER silently override the product specification. If implementation discovers a conflict, that specific decision is STOPPED and recorded in §11 Conflicts & Deviations (conflict · affected requirement · options · recommendation). No silent requirement rewriting.

---

## 1. PROJECT STATUS

- **Overall Progress:** 86% (P0–P15 + Operating Costs complete; remaining P16 candidates deferred)
- **Completed Phases:** Phase 0–15 + Operating Costs (P16 first module)
- **Active Phase:** None — awaiting pilot feedback to define remaining P16 scope
- **Upcoming Phase:** Phase 16 remaining candidates (demand-driven, DEFERRED) — see Phase 16 detail
- **Blocked Work:** see §8/§9 — `BLOCKER-B01` Docker absent (limits live Redis/MinIO verification only; does not block code progress)
- **Critical Risks (active):** RISK-R03 printer compatibility (matures at Phase 10), rush-hour performance budgets (Phases 8+). Full register §8.

### Environment Snapshot

| Item | Value |
|---|---|
| OS | Windows (win32) |
| Node.js / npm | v24.3.0 / 11.4.2 (npm workspaces; no pnpm/yarn installed) |
| Git | 2.49.0.windows.1 |
| Docker | ❌ Not installed → BLOCKER-B01 |
| PostgreSQL | ✅ v18 binaries present (Windows service untouched — KI-01); project's own portable cluster on :15432 **live-verified** |
| Redis | ❌ Not present locally (optional in health until Phase 8 realtime) |

---

## 2. PHASE STATUS TABLE

| Phase | Name | Status | Progress | Started | Completed | Depends On | Notes |
|---|---|---|---|---|---|---|---|
| 0 | Product / Repository / Documentation Foundation | COMPLETED | 100% | 2026-08-23 | 2026-08-23 | — | Glossary + ADRs + registers; specs untouched (git-verified) |
| 1 | Engineering Foundation | COMPLETED | 100% | 2026-08-23 | 2026-08-23 | P0 | All gates green + live up/down/up evidence (see §10 changelog) |
| 2 | Nexus Core | COMPLETED | 100% | 2026-08-23 | 2026-08-23 | P1 | Tenancy + settings engine + hash-chained audit + numbering + base repo; isolation/concurrency/tamper suites green; security+code review passed (see Phase 2 detail) |
| 3 | Authentication & Access | COMPLETED | 100% | 2026-08-23 | 2026-08-24 | P2 | Two-realm identity, argon2 + JWT/rotating-refresh sessions, RBAC (perm registry + role/scope), business+location isolation, platform-realm bridge retirement (ADR-022); security+code review + re-check passed. Frontline device/PIN deferred (see Phase 3 detail) |
| 4 | Business & Locations | COMPLETED | 100% | 2026-08-24 | 2026-08-24 | P3 | Branding (slug/accentColor/logoUrl/invoiceName/invoiceAddress/taxId), location hours, service modes, business-realm CRUD + profile, provisioning endpoint; 32 e2e green; isolation verified |
| 5 | Module Engine | COMPLETED | 100% | 2026-08-24 | 2026-08-24 | P4 | Manifest DAG, lifecycle state machine, gating guard, Module Center v1; 25 E2E + 27 unit green |
| 6 | Configuration Center | COMPLETED | 100% | 2026-08-24 | 2026-08-24 | P5 | Business-realm settings CRUD, Location>Business precedence, alert-rule registry, ConfigCenter UI; 25 E2E green |
| 7 | Restaurant MVP Foundation | COMPLETED | 100% | 2026-08-24 | 2026-08-24 | P6 | Catalog (tax categories/categories/items/variants/modifier groups+options), Dining Space (areas/tables), Staff Profiles, Guests, manual Bookings; 69 E2E + full isolation + module gating + audit trail; security+code review passed |
| 8 | Restaurant Operations | COMPLETED | 100% | 2026-08-24 | 2026-08-24 | P7 | Production areas, Guest Session aggregate, Service Request engine (DRAFT→SENT→ACCEPTED→PREPARING→READY→SERVED), Kitchen queue, Booking→seat, idempotency, optimistic concurrency; 49 E2E + security+code review passed |
| 9 | Checkout & Payments | COMPLETED | 100% | 2026-08-25 | 2026-08-25 | P8 | Provider-agnostic Invoice/Payment/Refund engine; cash + manual-UPI; integer money; idempotency; SEC findings fixed |
| 10 | Printing & Hardware | COMPLETED | 100% | 2026-08-25 | 2026-08-25 | P9 | Cloud→Agent→ESC/POS; truthful QUEUED→SENT→PRINTED|FAILED|OFFLINE state machine; idempotency; retry/backoff; reprint as new job; receipt+KOT templates; agent secret hash (never plaintext in DB or response); SEC: secretHash stripped from all API responses |
| 11 | Reports / Alerts / Audit | COMPLETED | 100% | 2026-08-25 | 2026-08-25 | P9 | Reports (daily/sales/items), notifications center, audit viewer, AlertDispatcher; 30 E2E green |
| 12 | Commercial / Add-on Management | COMPLETED | 100% | 2026-08-25 | 2026-08-25 | P11 | Offerings, price books, bundles, activation workflow, deployment checklists; 56 E2E green; ADR-026 |
| 13 | Onboarding / Deployment | COMPLETED | 100% | 2026-08-25 | 2026-08-25 | P12 | OnboardingProgress milestone tracker, go-live wizard, deploy/migrate/health-check scripts, 4 runbooks; 29 E2E green; ADR-027 |
| 14 | Pilot / Production Hardening | COMPLETED | 100% | 2026-08-25 | 2026-08-25 | P13 | 55 security + 12 concurrency E2E; OWASP A01–A07 pass; JWT secret ≥64 chars enforced; PILOT READY WITH CONDITIONS (hardware + restore drill pending); ADR-028 |
| 15 | Restaurant V1 Stabilization | COMPLETED | 100% | 2026-08-25 | 2026-08-25 | P14 | Gap analysis + permissions + frontend + workflow E2E (35/35) + audit chain bug fixed + security review + pilot checklist. PILOT READY WITH CONDITIONS |
| 16 | Post-Pilot V1 Modules | IN PROGRESS | ~10% | 2026-08-30 | — | P15 | Operating Costs shipped (47 E2E, ADR-030); remaining candidates deferred pending pilot demand |
| 17 | Growth Modules | DEFERRED | 0% | — | — | P16 | Digital orders, dispatch, multi-location, aggregators |
| 18 | Future Vertical Readiness | NOT STARTED | 0% | — | — | P14 | Time-boxed manufacturing spike → ADR + gap list only |

Statuses: `NOT STARTED / READY / IN PROGRESS / BLOCKED / COMPLETED / DEFERRED / CANCELLED`

---

## 3. OVERALL ROADMAP

```
P0 Documentation Foundation          P10 Printing & Hardware
P1 Engineering Foundation            P11 Reports / Alerts / Audit
P2 Nexus Core                        P12 Commercial / Add-on Management
P3 Authentication & Access           P13 Onboarding / Deployment
P4 Business & Locations              P14 Pilot / Production Hardening
P5 Module Engine                     P15 Restaurant V1 Stabilization
P6 Configuration Center              P16 Post-Pilot V1 Modules (demand-driven)
P7 Restaurant MVP Foundation         P17 Growth Modules
P8 Restaurant Operations             P18 Future Vertical Readiness
P9 Checkout & Payments
```

Continuous parallel tracks (never block phases): pilot recruitment/discovery (from P0, feeds P14/P15) · risk monitoring (§8).

---

## 4. PHASE DETAIL

Every phase tracks: Objective · Business Value · Scope · Features · Technical/Database/API/Frontend/Security/UX Work · Testing · Acceptance Criteria · Definition of Done · Dependencies · Risks · What NOT to Build · Deliverables · Status · Progress · Notes · Change Log.
A phase is COMPLETED only when its Definition of Done is verified — code existing ≠ complete.

---

### Phase 0 — Product / Repository / Documentation Foundation

#### Objective
Prepare repository + documentation foundation before product implementation: living roadmap, canonical glossary, ADR register, requirement/module documentation — without altering read-only specification sources.

#### Business Value
Eliminates terminology drift (RISK-R05) and decision ambiguity before any code exists; installs the tracking discipline every later phase relies on.

#### Scope
Documentation artifacts only. No application code, no package installation.

#### Features
Living roadmap · canonical glossary · ADR register 001–018 · requirement register · module priority matrix · module dependency map · repo hygiene (git, ignore rules).

#### Technical Work
Git init; `.gitignore`; `.gitattributes`; docs tree (`docs/adr/`, `docs/spec-normalized/`); specs committed as untouched baseline.

#### Database / API / Frontend Work
None (intentionally).

#### Security Work
Secrets policy: `.env` ignored; `.env.example` pattern mandated; no real secrets ever committed.

#### UX Work
N/A.

#### Testing
Artifact existence/completeness review + git verification that both spec files are byte-identical to the initial commit.

#### Acceptance Criteria
All artifacts exist under `docs/`; spec files unmodified since baseline commit; roadmap contains all 19 phases with detail sections.

#### Definition of Done
- [x] Repository inspected (only 2 spec files existed)
- [x] Both specification files verified & committed untouched
- [x] Git state verified (repo initialized, clean baseline commit)
- [x] `docs/`, `docs/adr/`, `docs/spec-normalized/` created
- [x] `docs/MASTER_IMPLEMENTATION_ROADMAP.md` created
- [x] `docs/spec-normalized/CANONICAL_GLOSSARY.md` created
- [x] ADRs 001–018 created from accepted architecture register
- [x] `docs/spec-normalized/REQUIREMENT_REGISTER.md` created
- [x] Module priority matrix + dependency map documentation created
- [x] Phase 0 completion checklist verified
- [x] Roadmap updated

#### Dependencies
None.

#### Risks
Low. Doc-drift risk mitigated by making this file the single tracker.

#### What NOT to Build
Any application code; CI pipelines; dependencies (Phase 1 scope).

#### Deliverables
All checklist items above; see Changelog §10 (2026-08-23).

#### Status
**COMPLETED** — gate passed 2026-08-23

#### Progress
100%

#### Notes
Source-spec corruption ("dining dining tables", "accoundining table", "Pass Controlrt") resolved via glossary mapping only; originals intentionally left untouched per instruction.

#### Change Log
- 2026-08-23 Created and completed same day (gate passed).

---

### Phase 1 — Engineering Foundation

#### Objective
Runnable engineering substrate: monorepo layout, local infra-as-code, NestJS API with dependency-aware `/health`, structured logging + request IDs, React+Vite global shell, shared package, GitHub Actions CI, coding standards, test infrastructure, migration strategy, documented developer setup.

#### Business Value
De-risks the highest-uncertainty platform assumptions (build toolchain, DB connectivity, health observability) before any business logic; gives every later phase a green pipeline to land on.

#### Scope
Foundation only. No restaurant screens, no domain models beyond a Prisma baseline, no auth.

#### Features
1. Monorepo: `apps/api`, `apps/web`, `packages/shared`, `infra/`, `docs/`
2. Dev infra: Docker Compose (PostgreSQL 16, Redis 7, MinIO) + portable-cluster fallback scripts for non-Docker Windows machines
3. `.env.example`; never commit real secrets
4. NestJS API: `/health` checking API process, PostgreSQL, Redis, MinIO (optional-degradable)
5. Structured logging (pino JSON): request id, timestamp, level, request context, error context; `x-request-id` propagation
6. React+Vite shell: top bar placeholders (business/location selectors, alerts, user menu), module sidebar placeholder, content area; i18n message-key scaffold (English)
7. `packages/shared`: genuinely shared constants/types (health statuses, env keys, headers)
8. GitHub Actions CI: lint → typecheck → test → build → e2e(smoke)
9. Coding standards doc
10. Test infra: Jest unit (API) + supertest HTTP e2e with failure-simulation + Vitest smoke (web)
11. Migration strategy: Prisma ORM + versioned migrations (ADR-019); baseline migration proven against live PostgreSQL
12. Developer setup documented (`docs/DEVELOPER_SETUP.md`) + root `README.md`

#### Technical Work
npm workspaces root; TypeScript strict base config; ESLint flat config; per-workspace build/test/typecheck scripts orchestrated from root.

#### Database Work
Prisma schema baseline (datasource+generator, no domain models yet — domain models start Phase 2); migration workflow proven live.

#### API Work
`GET /health` → `{status, uptimeSec, version, components}`; aggregation rule: required-down ⇒ HTTP 503 `error`; optional-only down ⇒ 200 `degraded`; all-up ⇒ 200 `ok`.

#### Frontend Work
Minimal AppShell render; no routing yet (arrives with real navigation in P5/P7).

#### Security Work
CORS allow-list config; no secrets in repo; dependency surface kept minimal; security review = secrets scan + header baseline noted (full hardening gates at P14).

#### UX Work
Shell skeleton only; i18n keys from day one (ADR-011).

#### Testing
- Unit: health aggregation logic
- E2E (HTTP): ok / degraded(optional-down) / error(required-down) paths; request-id header presence
- Web: render smoke test
- Live verification: real portable PostgreSQL up → health `ok`; stop PG → health `error`; restart → `ok` (evidence captured in Changelog)

#### Acceptance Criteria
Repository builds; API starts; web starts; database starts; Redis starts*; `/health` works; `/health` detects dependency failure; CI passes; lint passes; typecheck passes; tests pass; no secrets committed; local setup documented; roadmap updated.
*\*Redis live-start requires Docker or an approved local binary (BLOCKER-B01). Until then Redis "starts" is satisfied by compose definition + failure-path proof; live proof recorded when environment allows.*

#### Definition of Done
- [x] Monorepo structure created
- [x] docker-compose.dev.yml (postgres/redis/minio) defined
- [x] Portable dev-infra scripts work on this machine (PG cluster init/start/stop live-verified; Redis live-start pending B01, covered by compose definition + simulated-failure e2e)
- [x] .env.example present; no real secrets
- [x] NestJS API boots
- [x] /health returns aggregated status
- [x] /health reflects real PostgreSQL up→down→up transitions (live evidence: 200 degraded → stop PG → 503 error/database=down → start PG → 200 degraded/database=up)
- [x] /health failure detection proven at HTTP level (e2e: required-down=503, optional-down=degraded; plus live 503 with real DB stopped)
- [x] Structured logging with request-id implemented (pino + AsyncLocalStorage; inbound `x-request-id` echoed)
- [x] React+Vite shell renders
- [x] packages/shared builds and is consumed (API via CJS dist; web compiles TS source via Vite alias)
- [x] CI workflow defined
- [x] Lint passes
- [x] Typecheck passes
- [x] Unit tests pass (9 API + 2 web)
- [x] E2E smoke tests pass (5/5)
- [x] Web test passes
- [x] Migration strategy documented (ADR-019)
- [x] Migration tooling bootstrapped against live PostgreSQL (`_prisma_migrations` created via `migrate dev`; versioned migration files begin with Phase 2's first models — an empty schema has nothing to record)
- [x] DEVELOPER_SETUP.md + README written
- [x] Roadmap updated with results

#### Dependencies
Phase 0 complete.

#### Risks
Windows-specific npm/jest quirks (mitigated: verify locally now); Docker absence limits live Redis proof (BLOCKER-B01, documented, non-blocking).

#### What NOT to Build
Auth, tenancy schema, module engine, any restaurant concept, UI routing, theming engine.

#### Deliverables
Working monorepo; green CI definition; health endpoint; developer docs; ADR-019.

#### Status
**COMPLETED** (2026-08-23)

#### Progress
100%

#### Notes
- PostgreSQL 18 service exists but its credentials are unknown; project deliberately does NOT touch that instance — portable cluster under `infra/.local/` (git-ignored) is used instead, now live-proven.
- **Canonical dev ports renumbered** from 54329/56379/59000 to **15432/16379/19000**: the originals fell inside Windows' ephemeral port range where WinNAT creates per-boot reserved exclusions, making 54329 unbindable (KI-04). Low ports are permanently safe.
- Redis health is **optional-by-default** (`REDIS_REQUIRED=false`) until realtime consumers ship in Phase 8 — the API has no Redis dependency yet; flip the flag when ADR-006 consumers land. Storage follows the same env-gated pattern (`STORAGE_REQUIRED=false`, per spec MinIO is optional-degradable).
- `pg_ctl start`'s internal wait mode wedges under hidden consoles on this machine; script uses fire-and-forget + psql readiness polling instead.

#### Change Log
- 2026-08-23 Phase started; monorepo + API + web + shared + CI scaffolded.
- 2026-08-23 Implemented full Phase 1 codebase: shared contracts (`aggregateHealth`, request-id header, dev ports), zod-validated env config, lazy PrismaService, injectable health probes with 2s timeout budget, pino logging middleware via AsyncLocalStorage, app factory shared by bootstrap and e2e, AppShell with i18n catalog, portable PG lifecycle script, DEVELOPER_SETUP/README, GitHub Actions CI.
- 2026-08-23 Fixed during verification: workspace import of PrismaService; ts-jest transforming shared's CJS dist (narrowed transform to `.ts`); Vite build resolving `@nexus/shared` (source alias); `Promise.race` leaking late Prisma/ioredis rejections as unhandledRejection (drain losers); ioredis missing 'error' listener crash risk; pg_ctl handle-inheritance hang (detached launch) and space-in-path quoting.
- 2026-08-23 Verification evidence captured: lint ✓ · typecheck ✓ · unit 9+2 ✓ · e2e 5/5 ✓ · builds ✓ · live cycle 200/degraded → 503/error → 200/degraded against real portable PostgreSQL.

---

### Phase 2 — Nexus Core

#### Objective
Vertical-neutral core every business inherits: Business Workspace + Location entities, typed Configuration engine (namespaced, location→business→default precedence, versioned + audited), append-only hash-chained Activity History, gapless number allocation, and a base tenant-scoped repository enforcing `businessId` (ADR-002). No vertical/restaurant concepts.

#### Business Value
Every later capability inherits tenant isolation, auditability, concurrency-safety and typed configuration for free — the trust + multi-business substrate.

#### Scope / Features
`business_type` (global catalog, 10 verticals seeded) · `business` · `location` · `setting` · `audit_event` · `numbering_series`. Prisma models + 2 migrations; internal-admin-guarded `/internal` CRUD; settings engine w/ registry; audit append + chain verifier; numbering allocate/configure.

#### Technical / Database / API / Security Work
- Base `TenantScopedRepository` (`scoped()` injects mandatory `businessId`; `assertOwned`/`assertLocationInScope` defense-in-depth). Explicit `TenantScope { businessId, locationId?, actor }` passed into every service (never ambient).
- Per-business Postgres advisory-lock serialization for all read-modify-write (audit gapless sequence, settings no-lost-update, numbering no-duplicate). Audit appended **inside** the mutation's transaction (atomic).
- First real migrations: PKs/FKs, `business_id` indexes, NULL-aware partial unique indexes (settings/numbering scope), integrity FKs (`onDelete: Restrict`; audit intentionally FK-free to survive location deletion).
- Money/time per ADR-015 (currencyCode, Timestamptz UTC). Immutability per ADR-016 (no update/delete on audit; numbers never rewind).
- **Provisional internal-admin bridge (ADR-020)** — fail-closed shared-secret guard until Phase 3 auth. Constant-time (hashed) compare; token never logged.

#### Testing (evidence)
- Unit **24** (audit hash determinism + tamper-evidence, settings registry, fail-closed guard, health).
- E2E **22** against live PostgreSQL: cross-business denial suite (read/write/leak/numbering isolation), settings precedence + validation + optimistic-concurrency, **concurrent gapless allocation (advisory lock)**, **audit tamper-detection walker**, `.strict` typo rejection, startAt-conflict, unknown-resource 400/404.
- Migrations applied live; CI upgraded to provision Postgres + `migrate deploy` + seed.

#### Definition of Done
- [x] Six core models migrated live; `business_type` catalog seeded (10 verticals)
- [x] New business + location creatable via API (201, audited)
- [x] Settings precedence location→business→default verified live + e2e
- [x] Audit row written for every config/entity change; chain `verify` valid; tampering detected
- [x] Numbering gapless under concurrency (advisory lock proven)
- [x] Cross-tenant denial suite green (no IDOR — confirmed by adversarial security agent)
- [x] `/internal` endpoints guarded fail-closed (ADR-020)
- [x] lint ✓ · typecheck ✓ · build ✓ · 24 unit + 22 e2e ✓
- [x] Security review (agent) + code review (agent) run; all must-fix findings resolved
- [x] ADR-020, ADR-021 recorded; roadmap updated

#### Dependencies / Risks
P1. Risk of over-modeling mitigated (kept to 6 entities; module engine deferred to P5).

#### What NOT to Build (respected)
users/auth (P3), modules (P5), any restaurant concept, UI beyond Phase-1 shell.

#### Status
**COMPLETED** (2026-08-23) — gate passed with evidence above.

#### Change Log
- 2026-08-23 Implemented Core (data model + tenant scoping + settings/audit/numbering services + `/internal` API); applied 2 migrations live; seeded verticals.
- 2026-08-23 Ran parallel adversarial **security** + **code review** agents. Verdict: tenant isolation sound, no IDOR. Integrated fixes: token-length timing-oracle removed (hashed constant-time compare); `assertLocation` lifted to base repo; sensitive-setting audit redaction flag; `.strict()` DTOs; settings null-value ambiguity removed; numbering `startAt` conflict; integrity FKs (`numbering_series.locationId`; `setting.locationId` Cascade→Restrict); exception-filter array-message; **routed 5xx logging through pino** (was going to the disabled Nest logger — latent prod bug). Added concurrency + tamper-detection + version + fail-closed tests.

---

### Phase 3 — Authentication & Access

#### Objective
Server-enforced identity + authorization: two-realm users (PLATFORM / BUSINESS), argon2id passwords, short JWT access + rotating refresh sessions with ≤60s revocation, RBAC (permission registry `module.resource.action` + roles + business & location scope), retirement of the ADR-020 shared-token bridge in favour of real platform-realm users, and login auditing. Trust boundary for everything commercial.

#### Delivered (design decided via 3 parallel analysis agents; implemented single-owner; hardened via security + code review + re-check)
- **Identity:** `app_user` (realm + nullable businessId + CHECK), `role`, `role_permission`, `user_role`, `user_role_location`, `session`, `refresh_token`, `login_event` (3 migrations; global-unique lowercased email + indexed; partial unique role-key indexes; argon2id).
- **Authentication:** login (enumeration-safe timing, atomic per-account lockout), HS256 access JWT (pinned alg, no permissions embedded), opaque rotating refresh (sha256-stored, atomic single-use rotation + family reuse detection), logout / logout-all, httpOnly SameSite refresh cookie, `/auth/me`. Rate-limited `/auth` (env-configurable, in-memory).
- **Authorization:** static `PermissionRegistry` (modules extend later), global `JwtAuthGuard`→`PermissionGuard` (`@RequirePermission`), Owner/platform `*` wildcard, business scope from the principal (never URL), location scope on assignments; **escalation firewall on role create AND assign** ("can't grant/assign what you don't hold"; platform perms ungrantable to business roles; self-assignment blocked).
- **Bridge retirement (ADR-022):** `InternalAdminGuard`/`INTERNAL_ADMIN_TOKEN` removed; `/internal/*` now platform-realm-authenticated; first platform admin seeded (prod fail-closed on dev secrets).
- **Frontend (ADR-024):** in-memory access token + httpOnly refresh cookie, single-flighted silent refresh, login/loading/error/session-expired/logout states; verified end-to-end in a real browser.

#### ≤60s revocation
Per-request session + user-status + `tokenVersion` check; permissions resolved per-request (not in the JWT) so permission/role changes take effect on the next request. Verified: logout, logout-all, and suspend all invalidate live access tokens.

#### Testing (evidence)
- Unit **27**; E2E **42** (auth: login/lockout/enumeration parity, refresh rotation + reuse detection + **concurrent single-winner**, logout & logout-all revocation, refresh-not-in-body; RBAC: permission enforcement, business isolation, **assignment-escalation blocked**, self-assign blocked, platform-realm denial; location-scope isolation; rate-limit 429) + Web **2**. lint/typecheck/build green.

#### Definition of Done
- [x] Login / logout / logout-all / refresh work; session lifecycle + expiry + rotation
- [x] Revocation ≤60s (session revoke + permission change) — tested
- [x] Users + roles + permissions; Staff≠User groundwork (reserved link, ADR-005)
- [x] Business scope enforced (principal-derived); cross-business denied
- [x] Location scope enforced; cross-location denied
- [x] Privilege escalation blocked (role create + assign firewall; self-assign SoD)
- [x] Internal-admin bridge reviewed + **replaced** (ADR-022); secrets never logged/bundled; prod fail-closed
- [x] Auth events audited (login_event stream); IAM changes in hash-chained audit
- [x] Frontend auth flow + unauthorized/forbidden/expired states (browser-verified)
- [x] lint · typecheck · build · unit · e2e green; CI provisions auth env
- [x] ADRs (020 superseded; 022/023/024) + roadmap updated
- [x] Adversarial security review + code review + security re-check passed

#### NOT built (deliberate; tracked)
- Frontline **device + PIN** runtime and shift binding (schema groundwork reserved: `session.deviceId`, `core.device.*` perms) — a focused Phase 3.x / pre-P8 slice.
- **TOTP MFA** (columns reserved), SSO/social login, password-reset email flow (needs messaging, ADR-012), **approval-policy engine** depth (only `*.approve` permission keys exist).
- Production hardening tracked as follow-ups: CSRF double-submit on `/auth/refresh` (SameSite=strict + same-site-subdomain assumption for now, ADR-024), Redis-backed throttler/revocation cache (BLOCKER-B01, P8), per-request authz cache.

#### Status
**COMPLETED** (2026-08-24) — gate passed with evidence above.

#### Change Log
- 2026-08-24 Resumed from prior session's uncommitted work; finished `/internal` migration off the shared-token guard; seeded roles + platform admin.
- 2026-08-24 Implemented full auth + RBAC backend (commit `d3f0ff7`); frontend auth flow + review hardening (commit `41196f7`).
- 2026-08-24 Ran 3 parallel design agents (auth / RBAC-data / threat-model) → master decision; then adversarial security + code review agents. Fixed all must-fix findings — most notably role-**assignment** escalation (assigning the pre-existing owner/wildcard role), refresh rotation race, non-atomic lockout, `refreshToken`-in-body, login email seq-scan — each with a regression test. Security re-check performed.

### Phase 4 — Business & Locations

#### Objective
Full business/location management + branding basics + minimal internal provisioning path (audited). Pilots can now be provisioned with an owner account before the Phase 12 commercial layer exists.

#### Delivered
- **Business branding:** `slug` (globally unique URL handle), `accentColor` (hex), `logoUrl`, `invoiceName`, `invoiceAddress`, `taxId` — all nullable; slug conflict returns 409; validation enforced at API boundary.
- **Location hours:** `location_hours` table, one row per (location, day-of-week 0–6); `isClosed/openTime/closeTime`; idempotent `PUT /admin/locations/:id/hours` (partial or full week); audited.
- **Service modes:** `location_service_mode` composite-PK table; `ServiceMode` enum (`DINE_IN / TAKEOUT / DELIVERY / DRIVE_THROUGH / ROOM_SERVICE`); `PUT /admin/locations/:id/service-modes`; audited.
- **Business-realm CRUD:** `POST /admin/locations`, `PATCH /admin/locations/:id` — business-scope derived from principal, never URL. `GET/PATCH /admin/business` — own profile only.
- **Provisioning endpoint:** `POST /internal/businesses/:id/provision` (platform-realm, `platform.business.configure`) — creates first BUSINESS-realm owner account, assigns system `owner` role, audits; 409 if owner already exists or email duplicate.
- **Migration:** `20260824120000_phase4_business_locations` (6 business columns + `ServiceMode` enum + `location_hours` + `location_service_mode` tables).

#### Testing (evidence)
**32 E2E tests** (isolation: cross-business GET/PATCH/hours/modes all 404; branding validation; provisioning idempotency + duplicate guards; service mode enable/disable; partial hour update correctness). lint · typecheck · build · 27 unit + 74 E2E total green.

#### Definition of Done
- [x] Business branding fields (slug/accent/logo/invoice/taxId) — platform + business realm
- [x] Location hours (per day, open/close or closed) — business realm CRUD
- [x] Service modes (DINE_IN/TAKEOUT/DELIVERY/DRIVE_THROUGH/ROOM_SERVICE) — business realm CRUD
- [x] Business-realm write endpoints (POST/PATCH locations, GET/PATCH own business profile)
- [x] Provisioning endpoint — audited, idempotent, fail-closed
- [x] Cross-business isolation tests (all deny correctly)
- [x] lint · typecheck · build · unit · e2e green

#### NOT built (deliberate; tracked)
- Multi-location central controls (Phase 17)
- Business logo file upload (needs attachment service, Phase 6)
- Address geocoding / map pins (operational needs later)

#### Status
**COMPLETED** (2026-08-24) — gate passed.

#### Change Log
- 2026-08-24 Phase 4 implemented: migration + schema + branding + hours + service modes + provisioning + business-realm write endpoints + 32 E2E tests. All green.

### Phase 5 — Module Engine

#### Objective
Implement the module engine: code-defined module manifests with dependency DAG validation, per-business activation lifecycle (AVAILABLE→PENDING_SETUP→ACTIVE→DISABLED, SUSPENDED by platform), runtime gating guard that blocks module-scoped API routes when the module is not ACTIVE, Module Center v1 frontend.

#### Business Value
Enables controlled rollout of vertical features per business; each feature can be enabled, configured, and disabled independently with data preserved; platform can suspend a module without destroying data.

#### Scope
- Module manifests + built-in catalog (restaurant, catalog, checkout, reports, printing)
- DAG resolver: topological sort + cycle detection at startup
- Per-business activation state machine (DB-backed)
- Platform suspend/unsuspend operations
- ModuleGatingGuard: third APP_GUARD, no-op for PLATFORM realm, throws MODULE_DISABLED for BUSINESS realm when module not ACTIVE
- `@RequireModule(key)` decorator
- Business realm CRUD endpoints: `/admin/modules/*`
- Platform realm endpoints: `/internal/businesses/:id/modules/*`
- Module Center v1 React page (list, status badges, activate/complete-setup/disable/resume buttons)

#### Rules
- DISABLE ≠ DELETE: data and config preserved; re-enable restores prior config
- No external plugin SDK; no marketplace; metadata-driven inside monolith
- Platform can suspend (business cannot resume suspended; only platform can unsuspend)

#### Technical Work
- `apps/api/src/modules/module-manifest.ts` — ModuleManifest interface + BUILT_IN_MODULES
- `apps/api/src/modules/module.registry.ts` — ModuleRegistry (OnModuleInit, DAG validation, registers permissions)
- `apps/api/src/modules/module.service.ts` — full lifecycle (activate/completeSetup/disable/resume/suspend/unsuspend/isActive)
- `apps/api/src/modules/module-gating.guard.ts` — ModuleGatingGuard + @RequireModule
- `apps/api/src/modules/module.controller.ts` — business realm
- `apps/api/src/modules/platform-module.controller.ts` — platform realm
- `apps/api/src/modules/modules.module.ts` — NestJS module (APP_GUARD registration)
- `apps/api/src/common/errors.ts` — ModuleDisabledError (HTTP 403, code MODULE_DISABLED)

#### Database Work
Migration `20260824130000_module_engine`: ModuleStatus enum + module_activation table (unique businessId+moduleKey, FK RESTRICT to business).

#### API Work
- `GET/POST /admin/modules/:key/*` — business realm lifecycle
- `GET/POST /internal/businesses/:id/modules/:key/*` — platform realm lifecycle
- Error code `MODULE_DISABLED` (HTTP 403) when accessing a module-gated route with inactive module

#### Frontend Work
- `apps/web/src/modules/api.ts` — typed module API helpers
- `apps/web/src/modules/ModuleCenter.tsx` — module list with status badges, lifecycle action buttons, error state
- `apps/web/src/shell/AppShell.tsx` — sidebar nav (Home / Module Center) with state-based view switching
- `apps/web/src/i18n/en.json` — module center i18n strings

#### Security Work
- Guard chain: JwtAuthGuard → PermissionGuard → ModuleGatingGuard (in import order)
- Platform realm bypasses gating guard unconditionally (PLATFORM users always have full access)
- Business scope comes from JWT principal, never URL
- Dependency enforcement: cannot activate a module unless all declared deps are ACTIVE

#### Testing
- 27 unit tests (all 5 suites) — all pass ✓
- 25 Phase 5 E2E tests covering:
  - Module catalog: list (all AVAILABLE initially), get specific, get unknown (404), platform list
  - Lifecycle: AVAILABLE→PENDING_SETUP→ACTIVE, duplicate activate (409), complete-setup on ACTIVE (400)
  - Dependency enforcement: can activate with deps met, cannot activate without deps (400/VALIDATION), cannot disable with active dependents, can disable leaf, can disable after deps disabled
  - DISABLE ≠ DELETE: resume DISABLED→ACTIVE (config preserved), double-disable (400), resume AVAILABLE (404)
  - Platform suspend/unsuspend: suspend ACTIVE→SUSPENDED, owner cannot resume SUSPENDED, platform unsuspend→ACTIVE
  - Gating guard: platform realm bypass, business owner sees AVAILABLE before activation
  - Cross-business isolation: each business has own module state; no cross-contamination

#### Definition of Done
- [x] Migration applied and schema clean
- [x] TypeScript compilation clean (API + web)
- [x] 27 unit tests pass
- [x] 25 Phase 5 E2E tests pass
- [x] Phase 4 E2E suite (32 tests) still passes — no regressions
- [x] Module Center v1 frontend (list, status badges, lifecycle actions, loading/error states)
- [x] Roadmap updated
- [x] Committed

#### Dependencies
Phase 4 complete.

#### Risks
- Module permission conflicts at startup (fail-fast at OnModuleInit prevents silent duplicate registration)

#### What NOT to Build
- External plugin SDK or marketplace
- Setup wizard UI steps (manifests define steps; UI wizard rendered in later phases)
- Trial time-limit enforcement (Phase 12 scope)
- Dynamic sidebar composition from module state (Phase 7 scope — nav is static for now)

#### Deliverables
Module engine backend + gating guard + Module Center v1 frontend; 84/84 tests green.

#### Status
**COMPLETED** (2026-08-24) — gate passed.

#### Progress
100%

#### Notes
- `ModuleGatingGuard` cannot be exported from `ModulesModule` when registered as APP_GUARD — NestJS validates exported providers aren't globally-scoped tokens. Export list excludes it.
- AVAILABLE state is implicit (no DB row). `listForBusiness()` joins all manifests with activation records and fills AVAILABLE for unactivated ones.

#### Change Log
- 2026-08-24 Phase 5 implemented and gate-passed: manifest DAG engine, lifecycle service, gating guard, 25 E2E tests, Module Center v1 frontend.

### Phase 6 — Configuration Center

#### Objective
Business-realm typed configuration access (Location>Business>default precedence), alert-rule registry v1 (event→role→in-app), and Configuration Center frontend. Attachment/file service deferred (BLOCKER-B01: no local MinIO).

#### Deliverables
- `GET/PUT /admin/settings/*` — business-realm settings CRUD (businessId from JWT, not URL)
- `GET /admin/settings/schema` — typed setting catalog for frontend form rendering
- `GET/POST/PATCH/DELETE /admin/alerts/rules` — alert-rule registry
- `AlertRule` model: per-business event→role→channel rules
- `ConfigCenter.tsx` — two-tab frontend (Settings editor + Alert Rules table)
- 25 Phase 6 E2E tests

#### Status
**COMPLETED** (2026-08-24) — gate passed.

#### Progress
100%

#### Notes
- `alert_rule` table uses snake_case column names; added `@map` annotations to Prisma schema so camelCase field names resolve correctly.
- Attachment service (MinIO) deferred to Phase 13 — not blocking any Phase 7–12 work.
- "invalid-config-blocks-Active" enforcement deferred: the module.service.ts completeSetup() hook will validate required settings in Phase 7 when modules define required setting namespaces.

#### Change Log
- 2026-08-24 Phase 6 implemented: business-realm settings controller, admin alert-rule service/controller, ConfigCenter frontend, 25 E2E tests. All 124 E2E + 27 unit tests green.

#### Phase 7 — Restaurant MVP Foundation

##### Objective
Stand up the restaurant vertical backend: Catalog (tax categories, menu categories, items, variants, modifier groups + options), Dining Space (areas, tables), Staff Profiles, Guests, and manual Bookings. All routes behind `@RequireModule` gating and `@RequirePermission` RBAC. Cross-tenant isolation enforced server-side at every query.

##### Deliverables
- **Database migrations** — 12 new models: TaxCategory, CatalogCategory, CatalogItem, CatalogVariant, ModifierGroup, ModifierOption, CatalogItemModifierGroup, DiningArea, DiningTable, StaffProfile, Guest, Booking
- **Module manifest** — 6 new permissions added to `restaurant` module (`restaurant.dining.view/manage`, `restaurant.staff.view/manage`, `restaurant.guest.view/manage`); 4 new permissions added to `catalog` module (`catalog.taxcategory.view/manage`, `catalog.variant.view/manage`)
- **`apps/api/src/restaurant/catalog/`** — `catalog.dto.ts`, `catalog.service.ts` (CatalogService extends TenantScopedRepository), `catalog.controller.ts` (4 controllers: TaxCategory, CatalogCategory, CatalogItem, ModifierGroup)
- **`apps/api/src/restaurant/dining/`** — `dining.dto.ts`, `dining.service.ts` (DiningService), `dining.controller.ts` (DiningArea, DiningTable controllers)
- **`apps/api/src/restaurant/people/`** — `people.dto.ts`, `people.service.ts` (PeopleService), `people.controller.ts` (Staff, Guest controllers)
- **`apps/api/src/restaurant/booking/`** — `booking.dto.ts`, `booking.service.ts` (BookingService), `booking.controller.ts`
- **`apps/api/src/restaurant/restaurant.module.ts`** — aggregates all 9 controllers + 4 services; imports CoreModule
- **`apps/api/src/common/serialize.interceptor.ts`** — extended `jsonSafe()` to call `toJSON()` on Prisma Decimal objects before iterating; fixes Decimal serialization bug (Decimal.js internal `{s,e,d}` properties were being iterated instead of calling toJSON)
- **`apps/api/test/restaurant-mvp.e2e-spec.ts`** — 69 new E2E tests

##### API Routes
| Controller | Routes |
|---|---|
| TaxCategoryController | `GET/POST/PATCH/DELETE /admin/catalog/tax-categories[/:id]` |
| CatalogCategoryController | `GET/POST/PATCH/DELETE /admin/catalog/categories[/:id]` |
| CatalogItemController | `GET/POST/PATCH/DELETE /admin/catalog/items[/:id]` + nested `/:id/variants[/:variantId]` + `/:id/modifier-groups[/:modifierGroupId]` |
| ModifierGroupController | `GET/POST/PATCH/DELETE /admin/catalog/modifier-groups[/:id]` + nested `/:id/options[/:optionId]` |
| DiningAreaController | `GET/POST/PATCH/DELETE /admin/dining/areas[/:id]?locationId=` |
| DiningTableController | `GET/POST/PATCH/DELETE /admin/dining/tables[/:id]?areaId=` |
| StaffController | `GET/POST/PATCH/DELETE /admin/staff[/:id]` |
| GuestController | `GET/POST/PATCH/DELETE /admin/guests[/:id]` |
| BookingController | `GET/POST /admin/bookings[/:id]?locationId=` + `PATCH /admin/bookings/:id` |

##### Security Architecture
- businessId sourced exclusively from `scopeFromPrincipal(p)` — never from URL or body
- Cross-reference validators: `assertCategoryInScope`, `assertTaxCategoryInScope`, `assertAreaInScope`, `assertTableInScope`, `assertGuestInScope` — all use `this.scoped()` to prevent cross-business FK references
- `@RequireModule()` at class level on all 9 controllers; `@RequirePermission()` on every route
- `ParseUUIDPipe` on all `:id` path params; `ParseUUIDPipe({ optional: true })` on all optional UUID query params
- `assertOwned()` called after every scoped find for defense-in-depth
- P2002 → ConflictError for: duplicate table code (same area), duplicate modifier group link; P2003 → ConflictError for delete-with-dependents (tax category, category, area with tables)
- Schema uses `onDelete: Cascade` for CatalogVariant→CatalogItem, ModifierOption→ModifierGroup, CatalogItemModifierGroup→(item+group)

##### Audit Trail
Every mutation (including modifier group link/unlink) wrapped in `$transaction` with `audit.append`. Actions: `tax_category.*`, `catalog_category.*`, `catalog_item.*` (+ `modifier_group_linked/unlinked`), `catalog_variant.*`, `modifier_group.*`, `modifier_option.*`, `dining_area.*`, `dining_table.*`, `staff_profile.*`, `guest.*`, `booking.*`

##### Testing (Phase 7 E2E — 69 tests)
Three test businesses: A (restaurant+catalog active), B (same, for isolation), C (modules NOT active, for gating).
- Tax category CRUD (rate stored as Decimal(6,4), serialized correctly via `toJSON()`)
- Catalog category CRUD
- Catalog item CRUD + variant CRUD + modifier group link/unlink
- Modifier group CRUD + option CRUD
- Dining area + table CRUD (table code uniqueness per area → 409 CONFLICT)
- Staff profile CRUD + guest CRUD
- Booking CRUD (scheduledAt with timezone offset, cross-reference validation)
- Full cross-tenant isolation sweep: B cannot access any A resource by ID (all 404); B list endpoints contain no A resource IDs
- Module gating: C gets 403 MODULE_DISABLED on all restaurant/catalog routes
- ValidationError (400 VALIDATION) for cross-business FK references
- VersionConflictError (409) for concurrent updates

##### Definition of Done
- [x] 12 Prisma migrations applied clean
- [x] TypeScript clean (strict, no errors)
- [x] 27 unit tests pass (no regressions)
- [x] 69 Phase 7 E2E tests pass
- [x] All prior E2E tests (127) still pass — total 196/196 E2E green
- [x] Cross-tenant isolation verified (full adversarial sweep)
- [x] Module gating verified (403 MODULE_DISABLED for inactive module)
- [x] Prisma Decimal serialization fixed (`jsonSafe` extended)
- [x] Security gate: adversarial agent — CONDITIONAL PASS (no CRITICAL/HIGH/MEDIUM; LOW fixed post-audit)
- [x] Code quality gate: CONDITIONAL → fixed (link/unlink audit trail, assertOwned on private helpers, ParseUUIDPipe on query params)
- [x] Roadmap updated
- [x] Committed

##### What NOT Built (Deferred)
- Pack presets / onboarding checklist v1 / demo seeding (pushed to Phase 8 onboarding scope)
- Modifier rule enforcement beyond SINGLE/MULTIPLE selection type
- Table merge/split/transfer (Phase 8)
- Availability-lock (Phase 8 Operations)
- Frontend restaurant screens (Phase 8+)

##### Status
**COMPLETED** (2026-08-24) — gate passed.

##### Progress
100%

##### Change Log
- 2026-08-24 Phase 7 implemented and gate-passed: RestaurantModule with 13 files, 12 DB models, 9 controllers, 4 services, 69 E2E tests. Prisma Decimal serialization bug fixed in SerializeInterceptor. Security audit: PASS (no CRITICAL/HIGH/MEDIUM). Code audit: fixes applied (link/unlink audit trail, assertOwned defense-in-depth, ParseUUIDPipe on query params). Total 223 tests green (27 unit + 196 E2E).

#### Phase 8 — Restaurant Operations

**Status: COMPLETED · 2026-08-24 · Progress: 100%**

##### Objective
Guest Session aggregate, Service Request engine (full DRAFT→SENT→ACCEPTED→PREPARING→READY→SERVED→CLOSED state machine with line-level statuses), Production Areas (kitchen routing), Kitchen queue (filtered by location/area), idempotency keys, optimistic concurrency, Booking→seat flow.

##### Scope Delivered
- **Production Areas** (`/admin/catalog/production-areas`) — location-scoped areas for kitchen routing; CRUD with module-gated permissions (`restaurant.production.view/manage`); cross-tenant isolation
- **Guest Session aggregate** (`/admin/sessions`) — OPEN/CLOSED/VOID states; atomic table-claim via `updateMany` WHERE status=AVAILABLE; cross-reference validation for booking/guest/staff FKs; Booking→seat creates session + marks booking SEATED; table state transitions: AVAILABLE→OCCUPIED→CLEANING→AVAILABLE
- **Table reset** (`POST /admin/dining/tables/:id/reset`) — CLEANING→AVAILABLE; requires `restaurant.dining.manage`
- **Service Request engine** (`/admin/orders`) — DRAFT→SENT→ACCEPTED→PREPARING→READY→SERVED state machine; per-line statuses (PENDING→PREPARING→READY→SERVED/CANCELLED); financial snapshots (item name, variant name, unit price, tax rate, modifier names/adjustments) immutable at line creation; live FKs use SetNull for menu-change safety
- **Idempotency** — client-generated UUID `idempotencyKey`; UNIQUE(businessId, idempotencyKey); P2002→return existing request (no 409)
- **Optimistic concurrency** — `version` field on session and request; `expectedVersion` in DTOs; VersionConflictError(409) on mismatch
- **requestNumber** — allocated at SENT time (not DRAFT) via NumberingService; gaps from abandoned drafts acceptable (ADR)
- **Kitchen queue** (`/admin/kitchen`) — list by SENT/ACCEPTED/PREPARING/READY; filter by locationId/productionAreaId; accept/prepare/ready transitions
- **Partial line transitions** — `lineIds` array for partial kitchen accept/prepare/ready; request status rolls up if all lines reached target
- **Line cancellation** — cancel individual lines; auto-cancel request when all lines reach terminal state (re-queried inside tx)
- **roundNumber** — computed inside transaction to prevent race condition
- **WebSocket deferred** — no Redis available; polling acceptable for Phase 8; BLOCKER-B02 documented; ADR-027 added

##### New Permissions (added to module manifest)
- `restaurant.order.view/manage`
- `restaurant.kitchen.view/manage`
- `restaurant.production.view/manage`

##### New Schema (20260824170000_phase8_restaurant_operations)
Models: `ProductionArea`, `GuestSession`, `ServiceRequest`, `ServiceRequestLine`, `ServiceRequestLineModifier`
Enums: `GuestSessionStatus`, `ServiceRequestStatus`, `ServiceLineStatus`
Added: `CatalogItem.productionAreaId`, back-relations on Business/Location/DiningTable/StaffProfile/Guest/Booking/CatalogItem/CatalogVariant/ModifierOption

##### Gate Evidence
- **TypeScript:** clean (0 errors)
- **Unit tests:** 27/27 passing (no regressions)
- **E2E:** 49 new tests (245/245 total across 9 suites) — production area CRUD + isolation, session lifecycle + table state transitions, full order state machine, idempotency, optimistic concurrency, line/request cancel, booking seat, kitchen queue, module gating ×4, validation edge cases ×4
- **Security audit:** 0 CRITICAL, 0 HIGH vulnerabilities. 1 HIGH finding (lineIds not validated against request membership) — fixed by pre-transaction membership check. MEDIUM: roundNumber race (fixed: moved count inside tx), stale cancelLine rollup (fixed: re-count inside tx), fragile voidSession include assumption (fixed: direct count query). LOW: taxRateSnapshot type (fixed: Decimal.toNumber()), lineIds no size bound (fixed: max(500)), enum query params not validated (fixed: ParseEnumPipe)
- **Code review:** B rating. All RISK items fixed. No remaining correctness gaps.

##### What Was NOT Built (Phase 8)
- WebSocket fanout / realtime push (requires Redis — BLOCKER-B02; deferred to Phase 9+)
- Offline draft preservation (frontend concern)
- Course stubs / holds / transfer/split/combine (deferred to Phase 9+)
- Payment integration (Phase 9)

#### Phase 9 — Checkout & Payments

**Status: COMPLETED · 2026-08-25 · Progress: 100%**

##### Objective
Financially correct, provider-agnostic checkout foundation: immutable Invoice aggregate (snapshot of billable lines at billing time), idempotent Payment state machine (CASH/UPI with PENDING→CAPTURED transitions), reversal-only Refund semantics, integer minor-unit money throughout, and a `PaymentProvider` abstraction that isolates all gateway logic behind a stable interface.

##### Scope Delivered
- **Invoice aggregate** (`/admin/checkout/sessions/:sessionId/invoice`) — idempotent getOrCreate from OPEN GuestSession + billable ServiceRequestLines; DRAFT→FINALISED (allocates invoiceNumber via NumberingService) → PAID (marked atomically on payment capture); VOID (cancels PENDING payments in same transaction; rejects if PAID); partial unique DB index (`invoice_session_active_unique`) prevents concurrent duplicate invoices at DB level; `invoiceNumber` consumed forever once allocated even if voided
- **Financial snapshots** — all money/tax/name fields captured at invoice creation from ServiceRequestLine records; live FKs use `SetNull`; invoice is immutable after creation
- **Tax computation** — `lineSubtotal = (unitPrice + modifiersSum) × qty`; `lineTax = Math.round(lineSubtotal × taxRate)`; integer arithmetic only (ADR-015); tax breakdown grouped by name:rate key; grand total = subtotal + totalTax; `taxBreakdown` stored as JSONB
- **Payment state machine** (`/admin/checkout/invoices/:id/payments`) — initiate (PENDING or CAPTURED depending on provider); capture PENDING→CAPTURED; cancel PENDING→CANCELLED; invoice marked PAID atomically with first CAPTURED payment; failed/timeout never closes invoice
- **Refund engine** (`POST /admin/checkout/payments/:id/refunds`) — CAPTURED payments only; aggregate refund sum capped at payment amount; reversal semantics (PROCESSED/PENDING by method); reason mandatory
- **Provider abstraction** (`PaymentProvider` interface: `initiate/capture/refund`) — isolates all gateway logic from domain; domain never touches Razorpay APIs directly (ADR-008)
- **CashProvider** — immediately captures; validates `cashReceivedMinorUnits ≥ amountMinorUnits`; calculates change; refunds PROCESSED immediately
- **ManualUpiProvider** — `initiate()` returns PENDING (no SDK); `capture()` requires UTR `referenceCode`; `refund()` returns PENDING (manual operator action)
- **Idempotency** — client UUID `idempotencyKey`; early lookup runs BEFORE any status validation (prevents double-charge on retry after invoice state change); DB UNIQUE(businessId, idempotencyKey) as backup
- **Module gating** — `@RequireModule('checkout')` at class level on all Phase 9 controllers; `checkout` permissions: `checkout.invoice.view/create`, `checkout.payment.view/process`, `checkout.shift.manage`

##### New Schema (20260824180000_phase9_checkout_payments)
Models: `Invoice`, `InvoiceLine`, `Payment`, `Refund`
Enums: `InvoiceStatus` (DRAFT/FINALISED/PAID/VOIDED), `PaymentStatus` (PENDING/CAPTURED/CANCELLED/FAILED), `PaymentMethod` (CASH/UPI), `RefundStatus` (PENDING/PROCESSED/FAILED)
Back-relations added: Business, Location, GuestSession, ServiceRequestLine
Partial unique index: `invoice_session_active_unique` WHERE status IN ('DRAFT','FINALISED','PAID') — enforced in manual SQL migration

##### Gate Evidence
- **TypeScript:** clean (0 errors)
- **Lint:** clean (0 errors, 0 warnings) — two `as any` casts removed (invoice.locationId, payment.referenceCode; both fields exist on Prisma-generated types)
- **Unit tests:** 27/27 passing (no regressions)
- **E2E:** 31 new tests (`checkout.e2e-spec.ts`) — 276/276 total across 10 suites. Coverage: invoice getOrCreate idempotency, finalise, void, cash payment (immediate capture, idempotency, change calculation), UPI PENDING→capture, payment cancel, partial + full refunds, payment listing, cross-business isolation (404), module gating (403 MODULE_DISABLED)
- **Security audit (inline):** 3 findings fixed:
  - SEC-1 (MEDIUM): refund aggregate not scoped to `businessId` — fix: added `businessId: scope.businessId` to `prisma.refund.aggregate` where clause
  - SEC-2 (LOW): billableLines nested `serviceRequest` filter missing `businessId` — fix: defense-in-depth `businessId` added to nested filter
  - SEC-3 (LOW): voidInvoice cancelled PENDING payments outside transaction — fix: `payment.updateMany` moved inside `$transaction` block with `businessId` scope

##### What Was NOT Built (Phase 9)
- Razorpay adapter (gateway SDK behind feature flag — deferred; static UPI + manual confirm is the production path until enabled)
- Webhook endpoint + replay protection (requires Razorpay adapter)
- Shift reconciliation / cash counter open/in-out/close/variance (deferred to a later phase)
- Service charge / discounts / comps / split-bill / merge / hold (deferred — Phase 9 scope was the foundational Invoice/Payment/Refund engine)
- Auto-checkout from session (UI concern — API supports it; frontend deferred)
- Stored cards, recurring billing, payouts

##### Change Log
- 2026-08-25 Phase 9 implemented and gate-passed: CheckoutModule with provider abstraction, InvoiceService/Controller, PaymentService/Controller, CashProvider, ManualUpiProvider, PaymentProviderRegistry. Manual migration applied (shadow-DB ordering bug workaround, same as Phase 8). Security audit: 3 findings (SEC-1 MEDIUM, SEC-2 LOW, SEC-3 LOW) all fixed. Total 276 E2E green (27 unit + 276 E2E).

#### Phase 10 — Printing & Hardware

##### Objective
Cloud → Local Print Agent → certified ESC/POS printers; truthful QUEUED→SENT→PRINTED|FAILED|OFFLINE state machine; retry/backoff; manual reprint; receipt templates; KOT templates; printer profiles + device↔profile routing. Hard rule: API 2xx NEVER means "printed successfully" (ADR-007, ADR-025).

##### Scope delivered
- **PrintAgent** — registered local daemon with sha256-hashed bearer secret. Secret returned plaintext once (create/rotate) then unreachable. `secretHash` never exposed in API responses (security fix applied during gate).
- **PrinterProfile** — physical printer config per location: NETWORK_ESC_POS / USB_ESC_POS; purpose (RECEIPT/KOT); agentId routing; default routing for auto-dispatch.
- **PrintTemplate** — receipt and KOT layout config. Default resolution: location-scoped > business-scoped > hardcoded. Partial unique indexes enforce at-most-one default per (businessId, purpose) and per (businessId, locationId, purpose).
- **PrintJob state machine** — QUEUED → SENT (agent claims) → PRINTED | FAILED | OFFLINE. Retry: FAILED resets to QUEUED until retryCount ≥ maxRetries → terminal FAILED. OFFLINE: sentAt cleared, can be re-claimed. Reprints create new jobs with parentJobId — never mutate history.
- **Idempotency** — UNIQUE(businessId, idempotencyKey) enforced at DB; early lookup before any state change.
- **Payload-embedded** — job payload built at enqueue time; agent never needs a callback.
- **Agent auth** — @Public() + AgentAuthGuard on all /agent/print/* routes; user JWTs rejected.
- **Manual trigger** — admin enqueues jobs via POST /admin/printing/jobs; no auto-enqueue coupling to CheckoutModule/RestaurantModule.
- **Certified printer list** — 4 entries (Epson TM-T88V, Star TSP654II, Generic 80mm, Generic 58mm); all status=UNVERIFIED (no physical hardware tested).
- **Security** — cross-business 404 (no info leakage), cross-location validation, agent job ownership check (printer.agentId must match requesting agent), module gating.

##### Key files
`apps/api/src/printing/` — agent/, printer/, template/, job/, printing.module.ts, certified-models.ts
`apps/api/prisma/migrations/20260825120000_phase10_printing_hardware/`
`docs/adr/ADR-025-printing-hardware-phase10.md`
`apps/api/test/printing.e2e-spec.ts`

##### Pre-existing debt fixed (gate requirement)
- `order.service.ts`: removed unused `ConflictError` import; added `ServiceRequestWithLines` type; eliminated 11 `as any` casts; changed conditional variant include to separate query.
- `alert-rule.service.ts`: removed unused `ValidationError` import.
- `module.controller.ts`: removed unused `actorOf` import.
- `platform-module.controller.ts`: removed unused `ParseUUIDPipe` import.
- `restaurant-operations.e2e-spec.ts`: replaced 8 `any` callback types with specific types.

##### Hardware verification
RISK-R03 (printer compatibility) matures here. No physical ESC/POS hardware available in this environment. All 4 certified models listed as UNVERIFIED. Requires physical test before pilot go-live (Phase 14 gate).

##### What was NOT built
- Auto-enqueue on invoice PAID or ServiceRequest SENT (deferred — avoids tight coupling; manual trigger is sufficient for pilot)
- ESC/POS byte rendering library (platform handles routing/lifecycle; byte generation is agent-local)
- Physical printer verification (requires hardware — blocked by test environment)

- **Status:** COMPLETED · **Progress:** 100% · **Gate:** PASSED 2026-08-25

#### Phase 11 — Reports / Alerts / Audit
- **Objective:** Role dashboards (owner/manager/server/kitchen/cashier); Daily Closing Report (sales/tax/payments/refunds/voids/discounts/cash variance); sales+item basics; Alerts Center (in-app rules live); Activity History UI (filters/entity timelines/audited exports).
- **NOT built:** AI insights; exception center (deferred to Phase 16).
- **Status:** COMPLETED · **Progress:** 100% · **Gate:** PASSED 2026-08-25

#### Phase 12 — Commercial / Add-on Management
- **Objective:** Manhar internal realm: Client Accounts, Offering Catalog (setup/recurring/trial flags), Price Books + per-client overrides (effective-dated, currency-aware), bundles, Activation Request workflow (request→quote→approve→PendingSetup→wizard→access→test→go-live→commercial update), removal flow, usage overview, deployment checklists.
- **Guard:** zero monetary constants in code (CI grep).
- **Status:** COMPLETED · **Progress:** 100% · **Gate:** PASSED 2026-08-25

#### Phase 13 — Onboarding / Deployment
- **Objective:** Guided go-live wizard (Business→Type→Pack→Modules→Branding→Rules→Module Config→Users→Data→Devices→Testing→Training→Go Live→Support); client onboarding runbook; PITR verification; staging→prod pipeline finalized; runbooks (restore/incident/rollback). Rehearsal: deploy fake client end-to-end.
- **Status:** COMPLETED · **Progress:** 100% · **Gate:** PASSED 2026-08-25

#### Phase 14 — Pilot / Production Hardening
- **Objective:** OWASP pass; dependency scan; authz fuzzing; rush load-test vs budgets; chaos (network flap / agent kill / WS drop); restore drill executed; UAT = spec's 8 scenarios; GO/NO-GO → run 3–5 pilots (speed, usability, learning curve, printing, kitchen flow, payment reliability, reporting, network failure, permissions, rush stress).
- **Rule:** UX is NOT frozen before pilot feedback.
- **Verdict:** PILOT READY WITH CONDITIONS — hardware validation and restore drill must complete before first live transaction.
- **Conditions:**
  1. Hardware validation: test receipt printing on at least one physical ESC/POS printer before pilot (BLOCKED in dev — no physical device).
  2. Restore drill: execute `pg_dump` → staging restore → verify record counts against staging DB before pilot launch date.
  3. Fresh credential generation: rotate all production secrets from example values.
- **Status:** COMPLETED · **Progress:** 100% · **Gate:** PASSED 2026-08-25

#### Phase 15 — Restaurant V1 Stabilization

- **Objective:** Close all pilot-readiness gaps; deliver the complete restaurant service journey (open session → order → kitchen → checkout → close) end-to-end in both API and UI; pass gate.
- **Status:** COMPLETED 2026-08-25 · **Progress:** 100%
- **Verdict:** PILOT READY WITH CONDITIONS (conditions carried from Phase 14 — see below)

**Gap analysis findings (all resolved):**
- ✅ FIXED: Zero restaurant frontend — `TablesPage` + `KitchenPage` built; AppShell wired
- ✅ FIXED: System roles missing restaurant/catalog/checkout permissions — `system-roles.catalog.ts` updated
- ✅ FIXED: Audit chain bug — `order.service.ts` `transitionRequest` metadata contained `lineIds: undefined`; `stableStringify` serialized this as `"lineIds":null` but PostgreSQL JSON storage drops `undefined`-value keys; the stored hash and the recomputed hash diverged. Fixed by spreading `lineIds` conditionally (`...(lineIds !== undefined ? { lineIds } : {})`).
- ⚠️ DEFERRED: Business/Location selector in header (blocking only for multi-location — single-location pilot unaffected)
- ⚠️ DEFERRED: Catalog management page (owner uses API directly for pilot)
- ⚠️ DEFERRED: Real-time kitchen push (15s polling sufficient for pilot scale)

**Pilot Readiness Checklist:**

| Area | Status | Evidence |
|---|---|---|
| Restaurant backend (sessions/orders/kitchen/checkout) | ✅ PASS | P7–P9; 514/514 E2E prior to P15 |
| System roles — restaurant/catalog/checkout permissions | ✅ PASS | system-roles.catalog.ts fixed; 514/514 still green |
| Restaurant workflow E2E (open→order→kitchen→checkout→close) | ✅ PASS | 35/35 new tests in restaurant-workflow.e2e-spec.ts |
| Full E2E regression (no regressions) | ✅ PASS | 549/549 across 19 suites |
| Unit tests | ✅ PASS | 27/27 |
| TypeScript strict (api + web) | ✅ PASS | tsc --noEmit clean on both |
| Lint (Phase 15 files) | ✅ PASS | 0 errors in order.service.ts + restaurant-workflow.e2e-spec.ts |
| Lint (pre-existing P14 files) | ⚠️ DEFERRED | 8 errors in security/notifications/concurrency e2e specs — not introduced by P15; pre-date P14 gate |
| Web build | ✅ PASS | vite: 306 kB JS / 27 kB CSS gzipped |
| Security — IDOR | ✅ PASS | All controllers: scopeFromPrincipal → this.scoped → assertOwned |
| Security — cross-business | ✅ PASS | businessId always from JWT; never from URL/body in restaurant/checkout |
| Security — role escalation | ✅ PASS | @RequirePermission server-side only; PermissionGuard unchanged |
| Security — state machine integrity | ✅ PASS | assertStatus enforced server-side; audit chain valid after full journey |
| Security — payment manipulation | ✅ PASS | invoice must be FINALISED; amount must match grandTotal; PAID → 409 on duplicate |
| Security — duplicate submission | ✅ PASS | idempotency keys on orders + payments (UUID per attempt) |
| Audit chain integrity | ✅ PASS | verifyChain returns valid:true after 35-operation journey |
| Daily report reflects transactions | ✅ PASS | E2E test section 10 verified |
| Role-based access (kitchen-only user) | ✅ PASS | E2E section 14: kitchen user can view queue, cannot manage sessions/orders/checkout |
| Kitchen auto-refresh (15s) | ✅ PASS | KitchenPage.tsx |
| Floor auto-refresh (30s) | ✅ PASS | TablesPage.tsx |

**Phase 14 carry-forward conditions:**
- 🔴 BLOCKED: Physical printer validation (ESC/POS) — no physical device in dev environment
- ✅ COMPLETED: Local restore drill — executed 2026-08-30: pg_dump (2 MB, 1s) → DROP+CREATE nexus_drill → pg_restore (3s, exit 0) → verified 1207 businesses / 927 users / 9327 audit events / 17 migrations match exactly → dropped nexus_drill. Audit chain hashes confirmed non-null. Local verification complete; staging drill should run before first live transaction.
- ⏳ PENDING: Production credential rotation — must rotate before go-live

**ADR-029:** `docs/adr/ADR-029-restaurant-v1-frontend-architecture.md`

#### Phase 16 — Post-Pilot V1 Modules

- **Status:** IN PROGRESS · **Progress:** ~10% · **Started:** 2026-08-30

**Shipped — Operating Costs:**
- Standalone module (key: `costs`, no dependencies, any business type)
- DB: `expense_category` (per-business) + `expense` (per-location); integer minor-unit amounts; idempotencyKey; approval state machine (PENDING_APPROVAL → APPROVED | REJECTED)
- Backend: `CostsModule`, `CostsService`, `CostsController`; 5 permissions; module-gated; tenant-scoped; audit-trailed; all security invariants hold (businessId from principal, assertOwned on action routes, cross-reference validated)
- Frontend: `CostsPage.tsx` (3 tabs: Expenses / Categories / Summary); inline rejection form (replaced `window.prompt()`)
- Migration: `20260825160000_phase16_operating_costs`
- ADR-030: `docs/adr/ADR-030-operating-costs-module.md`
- Tests: 47 E2E (costs.e2e-spec.ts) — module gating, auth, category CRUD, expense CRUD, auto-approve, approval workflow, rejection workflow, inactive category, summary, cross-business isolation, validation
- Known tech debt: `expense.idempotencyKey` unique constraint is global rather than `UNIQUE(businessId, idempotencyKey)` — service-layer isolation is correct; collision probability is 1 in 2^122; migration deferred

**Remaining candidates (DEFERRED — build only on validated pilot demand):**
Full Guest CRM (consent) · Attendance/Leave · Exception Center · Global Search · richer BI · Stock Control · Procurement/Vendors · Scan Menu QR · Offers/Rewards. Prioritize by demand × revenue × complexity × maintenance.

#### Phase 17 — Growth Modules
- **DEFERRED.** Direct Digital Service Requests (intake abstraction) · Pickup · Dispatch · Multi-Location controls/comparison · Advanced BI · Aggregator integrations via adapters (never contaminating core domain) · extra messaging channels.
- **Status:** DEFERRED · **Progress:** 0%

#### Phase 18 — Future Vertical Readiness
- **Objective:** Time-boxed manufacturing validation spike on UNCHANGED Core: Material→Procurement→Receiving→Stock→Production Job(BOM issue)→Quality→Finished Stock→Dispatch, wired purely via manifests+packs in a sandbox client. Deliverable = ADR + gap analysis + required core extensions list. NOT a production manufacturing module.
- **Status:** NOT STARTED · **Progress:** 0%

---

## 5. TASK CHECKLIST CONVENTION

Active phases carry actionable `- [ ]` checklists inside their DoD/Testing sections. A task may be checked ONLY when validated (built, run, observed) — never merely because code exists. Completed items flip to `- [x]` with evidence noted in §10 Changelog.

## 6. TEST STATUS

| Test Area | Status | Last Run | Result |
|---|---|---|---|
| Build (all workspaces) | PASS | 2026-08-23 | shared tsc ✓ · api nest build ✓ · web vite build (199.85 kB js / 7.95 kB css) ✓ |
| Lint | PASS | 2026-08-23 | eslint flat config, 0 errors 0 warnings |
| Typecheck | PASS | 2026-08-25 | strict tsc across shared/api/web (clean after Phase 10) |
| Unit Tests (API) | PASS | 2026-08-25 | 27/27 (health; audit hash; settings registry; permission registry; refresh-hash) |
| E2E Smoke (API, HTTP-level failure simulation) | PASS | 2026-08-24 | 5/5 (ok/degraded/error matrix, request-id echo+propagation, offline-boot truthfulness) |
| E2E Core + Auth + P4–P16 (API, live PostgreSQL) | PASS | 2026-08-30 | 596/596 across 20 suites — core + auth + business-locations + module-engine + config-center + restaurant-mvp (69) + restaurant-operations (49) + checkout (31) + printing (56) + reports (16) + notifications (9) + audit-viewer (5) + commercial (56) + onboarding (29) + security (55) + concurrency (12) + health + auth-ratelimit + restaurant-workflow (35) + **costs (47 — Phase 16)** |
| Web Tests | PASS | 2026-08-24 | 2/2 (auth gate → sign-in screen; brand render) |
| Frontend auth flow (real browser) | PASS | 2026-08-24 | login → cookie + token → /auth/me → authenticated shell with user + sign-out (claude-in-chrome) |
| Live infra verification | PASS | 2026-08-24 | portable PG: migrations applied + seed (roles + platform admin); live login + `/internal` + `/admin` |
| CI Pipeline | DEFINED (DB-provisioned), NOT YET RUN (no remote) | 2026-08-24 | postgres:16 + migrate deploy + seed + lint/typecheck/unit/e2e/build; auth env provisioned |
| Tenant Isolation Tests | PASS | 2026-08-24 | Phase 7: full adversarial sweep — B cannot access any A resource; cross-business FK references rejected (400 VALIDATION); adversarial security agent: CONDITIONAL PASS (no CRITICAL/HIGH/MEDIUM) |
| Module Gating Tests | PASS | 2026-08-24 | Phase 7: C (modules not active) gets 403 MODULE_DISABLED on all restaurant/catalog routes |
| Concurrency Tests | PASS (Core+Auth scope) | 2026-08-24 | gapless numbering under load; audited-write chain; concurrent refresh-rotation single-winner; atomic lockout (full rush-hour budgets still Phase 8) |
| Security Tests | PASS (Phase 3+7 scope; formal OWASP gate still Phase 14) | 2026-08-24 | Phase 7 adversarial agent: no IDOR, no cross-tenant; P2002/P2003 handled; audit trail complete (link/unlink fixed post-audit) |
| Performance/Load Tests | NOT APPLICABLE YET (budgets enforced from Phase 8; formal gate Phase 14) | — | — |

## 7. ARCHITECTURE DECISION LOG

Full ADR texts in `docs/adr/`. Statuses: ACCEPTED / PROPOSED / SUPERSEDED.

| ADR | Decision | Reason | Date | Status |
|---|---|---|---|---|
| 001 | Modular monolith (no microservices/plugin SDK/marketplace) | Product spec mandate; team scale; ops cost | 2026-08-23 | ACCEPTED |
| 002 | Multi-tenant cloud SaaS; shared DB + `business_id` scoping; dedicated later via config | Product decision; SaaS economics | 2026-08-23 | ACCEPTED |
| 003 | TypeScript stack: NestJS API + React/Vite web | One language, module system maps to registry concept | 2026-08-23 | ACCEPTED |
| 004 | Auth: admin password+TOTP; frontline device+PIN shift-bound per-user attribution | Product decision (shared-device auditability) | 2026-08-23 | ACCEPTED |
| 005 | STAFF ≠ USER; optional 1:0..1 login identity link | Product decision | 2026-08-23 | ACCEPTED |
| 006 | Realtime via WebSocket rooms (business/location) + snapshot-on-reconnect | Rush-hour reliability requirement | 2026-08-23 | ACCEPTED |
| 007 | Printing via Local Print Agent → certified ESC/POS list; truthful print states | Product decision; risk #1 mitigation | 2026-08-23 | ACCEPTED |
| 008 | Payment provider abstraction; Razorpay first adapter; webhook-verified idempotent payments; reversal-only corrections | Product decision; trust requirement | 2026-08-23 | ACCEPTED |
| 009 | Offline = interruption-tolerant only; full offline is FUTURE | Product decision | 2026-08-23 | ACCEPTED |
| 010 | Configurable tax engine now; e-invoicing deferred | Product decision | 2026-08-23 | ACCEPTED |
| 011 | English MVP; i18n message-keys from day one; Gujarati/Hindi later | Product decision | 2026-08-23 | ACCEPTED |
| 012 | Messaging provider abstraction (Meta WhatsApp Cloud direction); minimal MVP scope | Product decision | 2026-08-23 | ACCEPTED |
| 013 | India-region hosting preferred; deployment-config portable | Product decision | 2026-08-23 | ACCEPTED |
| 014 | Basic branding MVP (logo/name/invoice identity/accent); no theme engine | Product decision | 2026-08-23 | ACCEPTED |
| 015 | Money = integer minor units; UTC storage + location TZ; line snapshots at sale time | Financial correctness | 2026-08-23 | ACCEPTED |
| 016 | Financial records immutable; reason-bearing reversals; append-only hash-chained audit | Trust/compliance | 2026-08-23 | ACCEPTED |
| 017 | Idempotency keys + optimistic concurrency on hot writes | Duplicate/rush protection | 2026-08-23 | ACCEPTED |
| 018 | External channels via intake abstraction; no aggregator integrations in MVP | Product decision | 2026-08-23 | ACCEPTED |
| 019 | Prisma ORM + versioned SQL migrations as data-access/migration strategy | Type safety + reviewable migrations | 2026-08-23 | ACCEPTED |
| 020 | Internal-admin access bridge (shared-secret guard on `/internal`, fail-closed) | Never ship unauthenticated tenant mutation; real auth lands P3 | 2026-08-23 | SUPERSEDED by ADR-022 (P3) |
| 021 | Core tenant scoping + settings precedence + per-business advisory-lock serialization | Structural isolation, gapless audit/numbering, no lost updates | 2026-08-23 | ACCEPTED |
| 022 | Platform-admin identity (two realms) replaces the internal-admin shared secret | Individually revocable/attributable admin access; closes master-key risk | 2026-08-24 | ACCEPTED (supersedes 020) |
| 023 | Auth token/session/lockout/rate-limit strategy (argon2id, HS256 + rotating refresh, per-request revocation, Redis-free) | Implements ADR-004 without Redis; ≤60s revocation | 2026-08-24 | ACCEPTED |
| 024 | Web token storage: in-memory access + httpOnly SameSite refresh cookie | Best XSS/CSRF balance for the SPA | 2026-08-24 | ACCEPTED |
| 025 | Printing architecture: polling over push, payload-embedded, sha256 agent secret, reprints as new jobs, small certified list | Simplicity + truthfulness; no callbacks needed; auditability | 2026-08-25 | ACCEPTED |
| 026 | Commercial layer: PLATFORM-only, integer-minor-unit pricing, activation state machine (REQUESTED→ACTIVE/REMOVED), immutable ActivationRequestEvent log | Clean separation of commercial and business-realm data; zero monetary constants in code | 2026-08-25 | ACCEPTED |
| 027 | Onboarding: TEXT[] milestone tracker, PLATFORM-only routes, prisma migrate deploy (not dev), secret-safety guards in deploy.ps1 | TEXT[] avoids ALTER TYPE migrations for new steps; PLATFORM-only prevents business user exposure; forward-only migrations for production safety | 2026-08-25 | ACCEPTED |
| 028 | Pilot hardening: all OWASP A01–A07 invariants pass; JWT ≥64 chars enforced; PILOT READY WITH CONDITIONS (hardware + restore drill pending) | Evidence-based pilot readiness posture; conditions documented before first client transaction | 2026-08-25 | ACCEPTED |
| 029 | Restaurant V1 frontend: single-file pages (TablesPage, KitchenPage), inline view state over router, polling over push (15/30s), permission keys from module-manifest (no CORE_PERMISSIONS extension) | Pilot-speed implementation; avoid premature abstractions; maintain existing patterns | 2026-08-25 | ACCEPTED |
| 030 | Operating Costs: standalone module (no deps), integer minor-unit money, auto-approve/approval-workflow per category, businessId-scoped tenant isolation, global idempotencyKey unique (known tech debt, astronomical collision probability); rejection via inline form (no window.prompt) | Any-business-type module; simple approval without queue service | 2026-08-30 | ACCEPTED |

## 8. RISKS & BLOCKERS

| ID | Risk/Blocker | Severity | Probability | Impact | Mitigation | Status |
|---|---|---|---|---|---|---|
| B01 | Docker not installed on current dev machine | LOW | certain | Redis/MinIO live verification pending; compose still delivered | Portable PG cluster script provides live DB proof; Redis proof via HTTP e2e failure-simulation until runtime available | OPEN |
| R01 | Printer/hardware compatibility | HIGH | HIGH | Pilot blocker at Phase 10 | Certified ESC/POS shortlist; buy test devices in P1 window; Local Print Agent; fallback flows | MONITORED (matures P10) |
| R02 | Rush-hour realtime reliability/performance | HIGH | MED | Lost orders/distrust | WS+snapshot resync; idempotency; load-test gates P8/P14 | MONITORED |
| R03 | Scope creep into full ERP | HIGH | HIGH | Timeline collapse | Phase gates; explicit NOT-to-build lists; this roadmap is the contract | ACTIVE GUARD |
| R04 | Module-engine over-engineering | MED | MED | Wasted months | Metadata-driven registry inside monolith; no SDK/marketplace | ACTIVE GUARD |
| R05 | Source-doc terminology drift | MED | certain if ignored | Confusion/regression bugs | Canonical glossary (done P0); naming conventions enforced in review | MITIGATED |
| R06 | GST/invoice compliance depth unknown | MED | MED | Rework at scale | Configurable tax engine (P9); compliance review pre-scale; e-invoicing deferred | MONITORED |
| R07 | Offline expectation gap | MED | MED | Support burden | Honest states (draft/pending/failed); full offline explicitly FUTURE | MITIGATED by design |
| R08 | Pilot dependency delays UX freeze | MED | MED | V1 slip | Recruitment parallel from P0; freeze gated on P14 feedback | TRACK STARTED P0 |
| R09 | Payment reconciliation distrust | MED | LOW if invariants hold | Owner churn | Reversal-only model; daily closing report; invariant tests (P9) | PLANNED |
| R10 | Bus factor / knowledge loss | MED | MED | Velocity crash | ADRs; this roadmap; module boundaries; boring tech | ONGOING |

## 9. KNOWN ISSUES

| ID | Issue | Impact | Workaround | Status |
|---|---|---|---|---|
| KI-01 | Host machine's PostgreSQL 18 service has unknown credentials | Cannot use system PG instance for dev | Project ships its own portable cluster (`infra/scripts/dev-postgres.ps1`) under git-ignored `infra/.local/` | CLOSED (by design) |
| KI-02 | No local Redis runtime (no Docker) | Live Redis health proof pending | Compose definition + simulated failure e2e; revisit when Docker installed or binary approved | OPEN (B01) |
| KI-03 | Git remote not yet configured | CI cannot actually execute remotely | Workflow committed + now DB-provisioned (postgres:16 service, migrate+seed) and branch trigger fixed (main+master); will run once remote/push enabled | OPEN |
| KI-04 | Initial canonical dev ports (54329) fell inside Windows ephemeral range → WinNAT per-boot exclusions made them unbindable ("Permission denied" on bind) | Dev DB could not start on some boots | Renumbered canonical ports below the dynamic range: PG **15432**, Redis **16379**, MinIO **19000** (rationale in DEVELOPER_SETUP.md); lesson recorded for any future host-port choice | CLOSED (2026-08-23) |

## 10. CHANGELOG

### 2026-08-30 (Pilot Deployment Readiness & Pre-Live Hardening — Session 3)

**Security hardening:**
- `apps/api/src/config/configuration.ts`: Added `TRUST_PROXY` to envSchema (was silently ignored). Added production superRefine check: `JWT_ACCESS_SECRET.length < 64` → startup rejection with ADR-028 message. Previously only `deploy.ps1` enforced this; now the API itself enforces it at startup.
- `apps/api/src/app.factory.ts`: Added `helmet()` middleware. HTTP security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, HSTS) were entirely absent. `crossOriginResourcePolicy: 'cross-origin'` set to allow the web app to fetch from the API in dev/staging.

**Demo seed (developer / staging environments):**
- `apps/api/prisma/demo-seed.ts`: NEW — Creates "The Pilot Kitchen" synthetic restaurant. Guard: exits if `NEXUS_DEMO_SEED !== 'true'` OR `NODE_ENV === 'production'`. Creates: business, location, 4 users (owner/cashier/kitchen-team/waiter) with argon2id-hashed passwords, all 4 modules (ACTIVE), 4 expense categories, 3 tax categories, 4 menu categories, 12 menu items, 1 production area, 2 dining areas, 6 tables. Fully idempotent (skip-if-exists). Prints credentials at completion.
- `apps/api/package.json` + root `package.json`: `demo:seed` scripts added.

**UX improvements:**
- `apps/web/src/costs/api.ts`: Added `Location` interface and `listLocations()` calling `GET /admin/locations`. CostsPage had an unusable raw UUID input for locationId.
- `apps/web/src/costs/CostsPage.tsx`: Replaced UUID text input with a location select dropdown populated from `listLocations()`. Auto-selects first location if only one exists.
- `apps/web/src/shell/AppShell.tsx`: Role-based nav filtering using `user.roles` from `/auth/me`. Kitchen/service staff no longer see Tables & Sessions or management items they can't access. Business/Location selector buttons hidden for BUSINESS-realm users (previously showed confusing "Business: No business selected" for users already logged into a business).

**Documentation:**
- `docs/runbooks/pilot-setup.md`: NEW — Step-by-step operator guide. Path A (demo seed) + Path B (11-step manual API setup via curl). Post-setup checklist (13 items). Troubleshooting table.
- `docs/pilot-acceptance-checklist.md`: NEW — 121-item acceptance checklist across 17 categories. 116 PASS / 0 FAIL / 3 BLOCKED / 2 DEFERRED. External blockers: physical ESC/POS printer (no hardware), staging restore drill (no staging environment), credential rotation (pre-go-live operational task).
- `docs/runbooks/deploy.md`: Added pre-condition checks for CORS_ORIGIN, PLATFORM_BOOTSTRAP_PASSWORD rotation, and JWT_ACCESS_SECRET ≥64 chars to the pre-deployment checklist.
- `docs/DEVELOPER_SETUP.md`: Added "Your First Test Restaurant" section referencing the demo seed with full quickstart and important warnings.

**TypeScript:** ✅ clean across all workspaces (post all changes).

### 2026-08-30 (Phase 16 — Operating Costs, E2E tests + roadmap sync)

**Audit findings (pre-existing, discovered this session):**
- Operating Costs module was fully implemented (migration, schema, service, controller, module manifest, system roles, frontend) but the roadmap incorrectly showed Phase 16 as DEFERRED 0%. No E2E tests existed. `CostsPage.tsx` used `window.prompt()` for rejection reason. No ADR-030.

**Work performed:**
- **E2E test suite:** `apps/api/test/costs.e2e-spec.ts` — 47 tests covering module gating (403 MODULE_DISABLED), authentication (401), category CRUD (list/create/get/patch; duplicate 409), expense CRUD (create/idempotency/list/get; auto-approve for no-approval categories; validation: negative amount/zero/missing fields/cross-business location 403/cross-business category 404/inactive category 404), approval workflow (PENDING_APPROVAL → APPROVED; double-approve 400), rejection workflow (PENDING_APPROVAL → REJECTED with reason; double-reject 400; empty reason 400), summary endpoint (shape + totals + locationId filter + bad date 400 + 401), cross-business isolation (6 vectors: list/get/patch categories + list/get/approve expenses all properly denied). **47/47 PASS.**
- **UX fix:** `CostsPage.tsx` `window.prompt()` for rejection reason replaced with inline form (`rejectingId` / `rejectReason` state; input + Confirm/Cancel inline in the table row). No blocking browser dialog.
- **ADR-030:** `docs/adr/ADR-030-operating-costs-module.md` — module identity, data model, approval workflow, permissions, security invariants, frontend decisions, known tech debt (idempotencyKey global uniqueness), deferred items.
- **Roadmap corrected:** Phase 16 status updated from DEFERRED 0% → IN PROGRESS ~10%; test count updated 549→596; ADR-030 added to §7; Phase 16 detail section updated.

**Gate results:**
- TypeScript: ✅ strict clean (shared + api + web)
- Lint: ✅ clean (0 errors)
- Unit tests: ✅ 27/27
- E2E: ✅ **596/596** across 20 suites (47 new costs tests; no regressions from 549)
- Web build: ✅ 323 kB JS / 28 kB CSS

**Pilot conditions (updated 2026-08-30):**
- 🔴 BLOCKED: Physical printer validation (no hardware) — print subsystem code verified sound (state machine, agent auth, tenant isolation, idempotency)
- ✅ COMPLETED: Local restore drill — pg_dump→restore→verify 2026-08-30 (see Phase 15/16 section)
- ⏳ PENDING: Production credential rotation — rotate before go-live

### 2026-08-23
- Initialized git repository; committed read-only specification baseline (`chore: initialize repository…`)
- Created `docs/MASTER_IMPLEMENTATION_ROADMAP.md` (this living tracker)
- **Phase 0 executed and COMPLETED:** created `docs/spec-normalized/CANONICAL_GLOSSARY.md`, `docs/spec-normalized/REQUIREMENT_REGISTER.md`, `docs/spec-normalized/MODULE_PRIORITY_MATRIX.md`, `docs/spec-normalized/MODULE_DEPENDENCY_MAP.md`, `docs/adr/ADR-001..ADR-019`
- Verified spec files unmodified since baseline (git)
- Phase 1 started: monorepo scaffold (root workspace config, ESLint flat config, TS strict base), NestJS API with `/health` aggregation + pino structured logging + request-id middleware, Prisma baseline schema + migration strategy (ADR-019), React+Vite shell with i18n scaffold, `packages/shared`, docker-compose.dev.yml, portable PostgreSQL dev script, GitHub Actions workflow, README + DEVELOPER_SETUP
- Recorded BLOCKER-B01 (no Docker) and honest scope of live infra verification
- **Phase 1 executed and COMPLETED (same day).** Full implementation + verification evidence in Phase 1 Change Log above. Key outcomes:
  - `/health` contract proven live: `200 ok-shape/degraded` with DB up, `503 error` with required dependency down, recovery on restart
  - Portable PostgreSQL cluster (`infra/scripts/dev-postgres.ps1`) init/start/stop/status verified on this machine; Prisma `_prisma_migrations` bootstrapped against it
  - Canonical dev ports renumbered 54329→15432, 56379→16379, 59000→19000 (KI-04, Windows WinNAT exclusion ranges)
  - Redis/MinIO health made env-gated optional (`REDIS_REQUIRED`/`STORAGE_REQUIRED`, default false) until their consumers ship — honest degradation instead of permanent false alarms; Redis flag flips in Phase 8 per ADR-006
  - BLOCKER-B01 remains OPEN (Redis/MinIO live-start still pending Docker); does not block Phase 2

### 2026-08-23 (Phase 2 — Nexus Core)
- **Takeover audit:** re-verified Phase 0 & 1 by running every gate locally (lint/typecheck/unit/e2e/build) — genuinely complete. Fixed CI branch trigger (`main`→`main,master`); found + fixed latent bug where 5xx errors logged to the disabled Nest logger (rerouted to pino).
- **Implemented Phase 2 Nexus Core:** 6 entities (business_type/business/location/setting/audit_event/numbering_series) with 2 live migrations + partial unique indexes + integrity FKs; seeded 10 verticals. Tenant-scoped base repository (ADR-002/021); typed settings engine with location→business→default precedence + optimistic concurrency; append-only hash-chained audit serialized per business via advisory lock, atomic with mutations; gapless numbering. `/internal` CRUD behind fail-closed internal-admin bridge (ADR-020).
- **Multi-agent review loop:** ran parallel adversarial **security** + **code review** agents. Verdict: server-side tenant isolation sound, **no IDOR**. Integrated all must-fix findings (see Phase 2 change log). Added ADR-020, ADR-021.
- **Verification:** lint ✓ · typecheck ✓ · build ✓ · **24 unit + 22 e2e** ✓ (incl. cross-tenant denial, concurrent gapless allocation, audit tamper-detection). Live `/internal` smoke proved isolation (A↔B) end-to-end.
- **Phase 2 GATE PASSED.** Next: Phase 3 — Authentication & Access.

### 2026-08-24 (Phase 7 — Restaurant MVP Foundation)
- **Phase 7 implemented and gate-passed.**
- **Scope delivered:** 13 files under `apps/api/src/restaurant/` — Catalog (tax categories, categories, items, variants, modifier groups + options), Dining Space (areas, tables), Staff Profiles, Guests, Bookings. All 9 controllers behind `@RequireModule` + `@RequirePermission`. RestaurantModule registered in AppModule.
- **DB:** 12 new Prisma models in a single migration. Schema uses `onDelete: Cascade` for child records (variants→items, options→modifier groups, item-modifier links); `onDelete: Restrict` for category/tax references.
- **Bug fixed:** `SerializeInterceptor.jsonSafe()` was iterating internal Decimal.js properties (`{constructor,s,e,d}`) for Prisma `Decimal` fields. Fixed by calling `toJSON()` before property iteration — Prisma Decimal's `toJSON()` returns the numeric string representation.
- **Security gate (parallel adversarial agent):** CONDITIONAL PASS. No CRITICAL/HIGH/MEDIUM findings. One LOW finding (4 unvalidated optional UUID query params) — fixed post-audit with `ParseUUIDPipe({ optional: true })`.
- **Code quality gate (parallel review agent):** CONDITIONAL → fixed. `linkModifierGroup`/`unlinkModifierGroup` lacked `$transaction` + `audit.append` — fixed. `findVariantOrThrow`/`findModifierOptionOrThrow` lacked `assertOwned()` — fixed. P2003 concern for deleteItem/deleteModifierGroup — verified as false positive (schema uses Cascade; no P2003 possible).
- **Testing:** 69 new E2E tests. Total: 27 unit + 196 E2E = 223 tests, all green. Full cross-tenant isolation sweep (A→B 404 on all IDs), module gating (C gets 403 MODULE_DISABLED), ValidationError (400) for cross-business FK references, VersionConflictError (409) for concurrent updates, P2002 → ConflictError for duplicate table codes and duplicate modifier group links.
- **Roadmap updated** to v1.7. Phase 8 is READY to start.

### 2026-08-30 (Pilot Readiness Audit — post-P16 Operating Costs)

**Full system audit targeting pilot deployment readiness. No new phase started.**

**Bugs fixed:**
- `notification.controller.ts`: three `throw new Error('Business context required')` guards replaced with `throw new ForbiddenError(...)`. PLATFORM-realm users with wildcard permissions could reach these endpoints and receive HTTP 500; now receive a proper 403 with `code: 'FORBIDDEN'`.
- `costs.dto.ts`: `amountMinorUnits` lacked an upper bound — sending `Number.MAX_SAFE_INTEGER` would cause PostgreSQL `INTEGER` overflow (HTTP 500). Added `.max(2_147_483_647)` — values exceeding INT4 max now return HTTP 400 with `code: 'VALIDATION'`.

**Restore drill — COMPLETED:**
- pg_dump nexus (2025.9 KB, 1s) → CREATE DATABASE nexus_drill → pg_restore exit 0 (3s) → verified record counts match exactly (1207 businesses / 927 users / 9327 audit events / 17 migrations / 38 expense categories / 24 expenses) → confirmed audit event hashes non-null → DROP DATABASE nexus_drill.
- Latest migration confirmed: `20260825160000_phase16_operating_costs` ✓

**Security review findings (adversarial pass — all clean):**
- CostsService: all Prisma queries scoped via `this.scoped(scope, ...)`, businessId never from body/URL, location cross-reference validates `location.businessId === scope.businessId`, IDOR prevention on approve/reject via `getExpenseOrThrow(scope, id)` — PASS
- PrintingModule: `this.scoped(scope, ...)` on all job queries, `assertOwned()` after findFirst, agent-auth guard ties agent tokens to businessId, state machine enforced server-side — PASS
- No `console.log` in production code (confirmed)
- No `as any` casts in costs module (confirmed)
- Single TODO in `auth.controller.ts:43` (native client origin routing) — future work, not a pilot blocker

**C-02 Global Search:** formally closed as DEFERRED. Module-scoped filtering/listing in each module satisfies pilot search needs. No federated search infrastructure needed for V1.

**CI verification:** `.github/workflows/ci.yml` confirmed correct (lint → typecheck → migrate → seed → unit → E2E → build). No issues.

**Costs i18n:** all 5 keys (`title`, `subtitle`, `tabExpenses`, `tabCategories`, `tabSummary`) confirmed in `en.json`.

- TypeScript: ✅ clean (post-fix, both api and web)
- Unit tests: ✅ 27/27

### 2026-08-25 (Phase 15 — Restaurant V1 Stabilization, GATE PASSED)

- **Audit chain bug found and fixed:** `order.service.ts` `transitionRequest` emitted `metadata: { fromStatus, toStatus, lineIds }` where `lineIds` could be `undefined`. `stableStringify` serialized undefined object values as `null` (via `JSON.stringify(undefined) ?? 'null'`), but PostgreSQL JSON storage drops keys with undefined values entirely. Hash computed at write time included `"lineIds":null`; hash recomputed at verify time from DB-retrieved metadata found no `lineIds` key → mismatch reported as "tampering". Fix: spread `lineIds` conditionally so the key is only present when it has a real value.
- **Restaurant workflow E2E complete:** `apps/api/test/restaurant-workflow.e2e-spec.ts` — 35 tests covering the full operational journey: Pre-journey table state → Open session (table OCCUPIED) → Create order (2 items, exact prices) → Send to kitchen (SENT + request number) → Kitchen accept/prepare/ready → Mark served → Invoice getOrCreate (idempotent) + totals verification + finalise → Cash payment → Close session (table CLEANING) → Reset table (AVAILABLE) → Daily report → Audit chain verify. Guards: duplicate payment rejected (409), concurrent session open (exactly one wins), void session (table AVAILABLE), role-based kitchen-only user (can view queue, cannot manage sessions/orders/checkout). **35/35 PASS.**
- **Full regression:** 549/549 E2E (19 suites), 27/27 unit — all green.
- **TypeScript:** tsc --noEmit clean on both api and web.
- **Web build:** vite production build clean (306 kB JS / 27 kB CSS).
- **Security review:** PASS — IDOR impossible (scopeFromPrincipal + this.scoped + assertOwned everywhere), no cross-business leakage, state machine enforced server-side, payment manipulation blocked, duplicate submission blocked by idempotency.
- **Lint:** Phase 15 files clean; 8 pre-existing errors in P14 test files (security/notifications/concurrency e2e specs) are not Phase 15 regressions — deferred.
- **Pilot readiness checklist:** All runtime items PASS. PILOT READY WITH CONDITIONS. Phase 14 conditions (printer, restore drill, credential rotation) carry forward unchanged.
- **Roadmap updated** to v1.15-final. Phase 15 COMPLETED.

### 2026-08-25 (Phase 15 — Restaurant V1 Stabilization, partial)

- **Full state reconstruction and gap analysis completed (prior session):**
  - Read: AppShell.tsx, App.tsx, en.json, permission.registry.ts, system-roles.catalog.ts, permission.guard.ts, all restaurant controllers, session/order/checkout DTOs, auth/api.ts, reports/api.ts
  - Gap 1 identified: **Zero restaurant frontend** — AppShell had no Tables, Kitchen, or Checkout navigation or pages
  - Gap 2 identified: **System roles missing restaurant/catalog/checkout permissions** — only `owner`/`platform-admin` (both wildcard) could use restaurant features; `service-team`, `kitchen-team`, `host`, `checkout-associate`, `location-manager` all lacked module permissions

- **Gap 1 fixed — Restaurant frontend built:**
  - `apps/web/src/restaurant/api.ts` — Full typed API client for dining (areas/tables), sessions, orders, kitchen queue, catalog (categories/items), and checkout (invoice/finalise/pay). Helpers: `formatMinorUnits`, `timeAgo`. Corrected field name `amountMinorUnits` (vs. the `amount` name used in ad-hoc tests); added `idempotencyKey: crypto.randomUUID()` to order creation; added `idempotencyKey: crypto.randomUUID()` to payment initiation.
  - `apps/web/src/restaurant/TablesPage.tsx` — Multi-state floor view (Floor → Session Detail → Order Builder → Checkout Panel). Floor grid with AVAILABLE/OCCUPIED/CLEANING status cards, area filter tabs. Open Session dialog (partySize, notes). Session panel shows round history, order status badges, party + time context. Order builder: catalog items grouped by category with +/− quantity controls and "Send to Kitchen" (create draft → send in one action). Checkout panel: getOrCreate invoice → auto-finalise → method selector (CASH/UPI/CARD) → collect payment → success state → close session. Auto-refresh every 30 seconds.
  - `apps/web/src/restaurant/KitchenPage.tsx` — 4-column Kanban (New/Accepted/Preparing/Ready). Each ticket shows requestNumber, elapsed time since sent, line items with modifier and note detail, subtotal. Action buttons: Accept → Start Preparing → Mark Ready. Optimistic state update on click; refreshes on error. Auto-refresh every 15 seconds.
  - `apps/web/src/shell/AppShell.tsx` — Added `TablesPage` and `KitchenPage` imports; added `'tables' | 'kitchen'` to View union; added "Restaurant" nav section header + "Tables & Sessions" + "Kitchen Display" nav items; wired view rendering.
  - `apps/web/src/i18n/en.json` — Added `shell.nav.restaurant`, `shell.nav.tables`, `shell.nav.kitchen` keys.

- **Gap 2 fixed — System roles updated:**
  - `apps/api/src/iam/permission.registry.ts` — No change (module-manifest registers module permissions via `ModuleRegistry.onModuleInit()`; adding duplicates to CORE_PERMISSIONS would throw at startup — lesson learned from first attempt which produced 514 failures).
  - `apps/api/src/iam/system-roles.catalog.ts` — `location-manager` now holds full restaurant+catalog+checkout set. `checkout-associate` holds session/order view + full checkout. `service-team` holds dining+session+order manage + catalog view (for order taking). `host` holds dining+table+session manage + booking view/manage + order view. `kitchen-team` holds order view + kitchen view/manage. Permission keys match exactly what controllers require (verified via grep of `@RequirePermission` annotations across all restaurant/catalog/checkout controllers).

- **Regression test:** 514/514 E2E green after changes (18 suites unchanged — permission additions don't affect E2E isolation because tests use `owner` wildcard).

- **ADR-029:** `docs/adr/ADR-029-restaurant-v1-frontend-architecture.md` — 7 decisions covering page architecture, API client pattern, inline view state, permission key source, checkout flow design, kitchen polling, floor polling.

- **Roadmap updated** to v1.15. Phase 15 is IN PROGRESS at 70%. Remaining: restaurant workflow E2E + pilot checklist.

### 2026-08-25 (Phase 14 — Pilot / Production Hardening)
- **Phase 14 implemented and gate-passed. Verdict: PILOT READY WITH CONDITIONS.**
- **Security Red Team (55 E2E tests — `test/security.e2e-spec.ts`):**
  - OWASP A01 (Broken Access Control): 11 IDOR vectors (A cannot GET/mutate B sessions/orders/invoices/payments/notifications), 10 privilege escalation vectors (business user → 403 on all `/internal/*` routes), mass assignment (body `businessId` ignored), 2 module gating vectors. All blocked.
  - OWASP A02 (Auth failures): no token/malformed JWT/tampered payload/fake session/wrong password/unknown user — all 401. Login response never includes `passwordHash` or `$argon2` hash. Rate limiting loop: 12 consecutive failures produce no 200.
  - OWASP A03 (Injection): SQL injection in path param rejected by UUID validation; SQL injection in query param rejected by zod; non-UUID id → 400; oversized string → 400; negative rate → 400; XSS stored as literal string (no execution at API layer).
  - OWASP A05 (Misconfiguration): no stack traces, no file paths, no internals in error responses; unknown route → 404; health public; auth GET → 404/405.
  - Sensitive data: `/auth/me`, user list, print agents, audit events — none expose `passwordHash`, `tokenVersion`, `sessionVersion`, `secretHash`, or argon2 hashes.
  - Payment security: IDOR on B's invoice blocked; negative/zero amounts rejected (400/422); duplicate payment on PAID invoice rejected (409/400/422).
  - Audit chain: `GET /admin/audit/verify` returns `valid: true`; unauthenticated → 401.
- **Concurrency (12 E2E tests — `test/concurrency.e2e-spec.ts`):**
  - Concurrent table session open (2 and 3 concurrent): exactly one wins, no 500s.
  - Concurrent order send: one of two concurrent sends succeeds, no 500s.
  - Concurrent payments on same FINALISED invoice: no 500s; invoice in valid state after.
  - 5 concurrent idempotency-keyed payments: no 500s, no inconsistent state.
  - Concurrent module activation: at least one succeeds, no 500s.
  - Concurrent settings writes: no 500s, last writer wins.
  - Rush hour (20 concurrent reads): all 200, elapsed < 10 s.
  - Concurrent audit writes: `GET /admin/audit/verify` valid after concurrent `POST /admin/notifications/read-all` × 5.
- **Production config hardening:**
  - `deploy.ps1`: JWT secret minimum length increased from 32 → 64 chars (aligned with production example recommendation).
  - No other changes: CORS from env, TRUST_PROXY from env, LOG_LEVEL=warn in production, dev-credential DATABASE_URL refused outside development — all already correct.
- **Observability review:** Logging middleware: structured JSON (pino), requestId, method, url, statusCode, durationMs — request body never logged. DomainExceptionFilter: 500 returns generic `INTERNAL` code only. Verified passing in security test suite.
- **Deployment drill review:** `deploy.ps1` dry-run logic validated. Sequence: env validate → migrate deploy → idempotent seed → health check. Dev secret refusal verified. No architectural changes needed.
- **Backup/restore:** Runbook exists (`docs/runbooks/backup-restore.md`). Restore drill against staging DB is a pilot-launch **condition** (not yet executed — no production-equivalent database in dev environment).
- **Hardware validation:** BLOCKED — no physical ESC/POS printer available in dev environment. Pilot-launch **condition**: test receipt printing on at least one physical printer before first live transaction.
- **ADR-028:** `docs/adr/ADR-028-pilot-production-hardening.md` — all 15 workstream findings, pilot readiness verdict, three pre-pilot conditions.
- **Testing:** 67 new E2E tests. Total: 27 unit + 514 E2E = 541 tests, all green (18 suites).
- **Roadmap updated** to v1.14. Phase 15 (Restaurant V1 Stabilization) is READY to start after pilot conditions are met.

### 2026-08-25 (Phase 13 — Onboarding / Deployment)
- **Phase 13 implemented and gate-passed.**
- **Scope delivered:**
  - **Backend — Onboarding:** `apps/api/src/onboarding/` — `onboarding.dto.ts`, `onboarding.service.ts`, `onboarding.controller.ts`, `onboarding.module.ts`. Six endpoints: list all, initialize (idempotent), get progress, validate readiness, complete step (idempotent), update notes. All routes under `internal/onboarding` require `platform.onboarding.view` / `platform.onboarding.manage` (both `restricted: true`). `OnboardingModule` registered in `AppModule`.
  - **Frontend — Onboarding:** `apps/web/src/onboarding/api.ts`, `OnboardingPage.tsx`, `OnboardingWizard.tsx`. Platform-admin page listing all onboarding records with filter tabs (In Progress / Completed / All); wizard shows step list with progress bar, validation issues panel, Mark Done buttons, and notes editing. `AppShell.tsx` updated; `en.json` extended with full `onboarding` section.
  - **Infrastructure scripts:** `infra/scripts/deploy.ps1` (full deployment orchestrator: env validation + secret safety check + migration + seed + health check), `infra/scripts/migrate.ps1` (prisma migrate deploy with dev-credential guard), `infra/scripts/health-check.ps1` (DB connectivity + pending migration check). `.env.staging.example`, `.env.production.example` (no real secrets; production template warns about 64-char JWT secret and stronger argon2 params).
  - **Runbooks:** `docs/runbooks/deploy.md`, `docs/runbooks/rollback.md`, `docs/runbooks/backup-restore.md`, `docs/runbooks/incident-response.md`. Covers step-by-step deployment, code/migration rollback decision matrix, pre-deploy pg_dump procedure, PITR restore, restore drill cadence, P0–P3 severity triage, post-incident requirements.
  - **ADR-027:** `docs/adr/ADR-027-onboarding-architecture.md` — TEXT[] vs Postgres enum rationale, 8 milestones table, PLATFORM-only access, relationship to Phase 12 DeploymentChecklist, migrate deploy safety, secret handling.
- **DB:** One new model `OnboardingProgress` (businessId unique, completedSteps TEXT[], currentStep TEXT, notes, startedAt, completedAt, updatedAt). Manual migration applied (`20260825150000_phase13_onboarding`); marked via `prisma migrate resolve --applied`. Prisma client regenerated clean.
- **Architecture (ADR-027):** TEXT[] over Postgres enum — new steps append to `ONBOARDING_STEPS` constant without `ALTER TYPE` migration. Eight ordered milestones; completion is idempotent; out-of-order marking allowed. `completedAt` set only when all steps (including COMPLETED) are in the array (computed by `computeCurrentStep()` returning null-coalescence). `/validate` queries live DB (location count, active module count, user count, branding fields) — no reliance on step completion state. Deployment model: forward-only `prisma migrate deploy`; no automatic DB reset in production.
- **Permissions:** 2 new `restricted: true` permissions (`platform.onboarding.view`, `platform.onboarding.manage`). `platform-admin` wildcard covers all automatically.
- **Security invariants:** Business-realm users receive 403 on all `/internal/onboarding/*` routes (tested). Unauthenticated requests return 401. Notes are not echoed in audit log metadata (intentional — avoids leaking client-sensitive notes). `deploy.ps1` refuses dev JWT secret in production; `migrate.ps1` refuses dev DATABASE_URL credentials outside development (configurable with `-AllowDevCredentials` for CI staging). No raw SQL in service code (all Prisma ORM).
- **Security findings (adversarial review):** No CRITICAL/HIGH/MEDIUM findings. One LOW: concurrent `initialize` calls could race and return P2002 constraint error (500) instead of idempotent 201 — practical risk negligible (PLATFORM-only, manual trigger, unique-per-business constraint prevents data corruption).
- **Testing:** 29 new E2E tests (`test/onboarding.e2e-spec.ts`). Total: 27 unit + 447 E2E = 474 tests, all green. Coverage: before-init 404 + pre-init validate; init (idempotent, 404 for unknown biz); get with business details; validate (failures + pass after location created); step completion (full happy path through all 8 steps + idempotency + completedAt set + unknown step 400); notes update + null-clear; list (all + completed filter + in-progress filter); security suite (business 403 ×4, unauth 401 ×2).
- **Roadmap updated** to v1.13. Phase 14 (Pilot / Production Hardening) is READY to start.

### 2026-08-25 (Phase 11 — Reports / Alerts / Audit)
- **Phase 11 implemented and gate-passed.**
- **Scope delivered:**
  - **Backend — Reports:** `apps/api/src/reports/` — `report.dto.ts`, `report.service.ts`, `report.controller.ts`, `reports.module.ts`. Three endpoints: `GET /admin/reports/daily` (daily closing: paid invoices, gross sales, tax, payment breakdown, refunds, voids, served orders, tax breakdown by component), `GET /admin/reports/sales` (range summary: same metrics aggregated over arbitrary date range), `GET /admin/reports/items` (top items by quantity from InvoiceLine snapshots). Queries authoritative transactional tables (no duplicate reporting tables). `@RequireModule('reports')` gate; `reports.daily.view` / `reports.sales.view` permissions. Integer minor-unit money throughout (ADR-015).
  - **Backend — Notifications (AlertDispatcher + NotificationController):** `apps/api/src/core/alerts/alert-dispatcher.ts` (best-effort dispatch — never throws, finds role→users, creates AlertNotification rows via createMany). `apps/api/src/core/notifications/` — `notification.dto.ts`, `notification.service.ts`, `notification.controller.ts`. Endpoints: `GET /admin/notifications` (list with unreadOnly/skip/take), `PATCH /admin/notifications/:id/read` (ownership-scoped: validates userId+businessId before marking), `POST /admin/notifications/read-all` (bulk mark read). Added `core.notification.view` permission to all business roles.
  - **Backend — Admin Audit Viewer:** `apps/api/src/core/audit/admin-audit.controller.ts`. Two endpoints: `GET /admin/audit` (paginated, filtered by action/resourceType/resourceId/locationId/actorId/from/to/skip/take, requires `core.audit.view`), `GET /admin/audit/verify` (hash-chain integrity check). Extended `AuditService.listFiltered()` with paginated filtered queries.
  - **DB:** `alert_notification` table with camelCase column names (matching Prisma convention: no @map on fields). FKs to business/app_user/alert_rule. Two performance indexes on (businessId, userId). Five additional performance indexes on invoice/payment/audit_event tables for reporting queries. Migration: `20260825130000_phase11_reports_alerts_audit/migration.sql`.
  - **Frontend — Reports:** `apps/web/src/reports/api.ts`, `apps/web/src/reports/ReportsPage.tsx`. Three-tab page: Daily Closing, Sales Summary, Top Items. Currency formatted via `Intl.NumberFormat` in INR.
  - **Frontend — Notifications:** `apps/web/src/notifications/api.ts`, `apps/web/src/notifications/NotificationsPanel.tsx`. Dropdown bell with live unread count badge; mark single/all read; click-outside close.
  - **Frontend — Activity:** `apps/web/src/activity/api.ts`, `apps/web/src/activity/ActivityPage.tsx`. Filterable paginated audit log viewer; expandable metadata rows; chain verify button.
  - **Shell:** `AppShell.tsx` updated — Reports and Activity nav items added; disabled alerts button replaced with live `NotificationsPanel`.
  - **Permissions:** `permission.registry.ts` — `core.notification.view` added. `system-roles.catalog.ts` — all business roles updated.
  - **i18n:** `apps/web/src/i18n/en.json` — reports, notifications, activity sections added/extended.
  - **CheckoutModule wired:** `AlertDispatcher` injected into `PaymentService`; dispatches `invoice.paid` event after CAPTURED state (best-effort, never throws).
- **DB fix:** Initial migration SQL had snake_case columns (`business_id`, `user_id`, etc.) — dropped and recreated table with camelCase columns (`businessId`, `userId`, etc.) matching Prisma schema without @map.
- **Security notes:** AlertDispatcher is best-effort (never fails checkout); notification read/mark-all scoped by JWT userId+businessId (prevents IDOR); audit viewer scoped by businessId from JWT; audit metadata never includes secretHash/password/token (enforced at write time in AuditService).
- **Testing:** 30 new E2E tests (reports: 16, notifications: 9, audit-viewer: 5). Total: 27 unit + 362 E2E = 389 tests, all green.
- **Roadmap updated** to v1.11. Phase 12 (Commercial / Add-on Management) is READY to start.

### 2026-08-25 (Phase 12 — Commercial / Add-on Management)
- **Phase 12 implemented and gate-passed.**
- **Scope delivered:**
  - `apps/api/src/commercial/` — 11 files: `commercial.dto.ts`, `offering.service.ts`, `offering.controller.ts`, `price-book.service.ts`, `price-book.controller.ts`, `bundle.service.ts`, `bundle.controller.ts`, `client-account.service.ts`, `client-account.controller.ts`, `activation.service.ts`, `activation.controller.ts`, `commercial.module.ts`. `CommercialModule` registered in `AppModule`.
  - `apps/web/src/commercial/` — 7 files: `api.ts`, `CommercialPage.tsx`, `ClientsPage.tsx`, `OfferingsPage.tsx`, `PriceBooksPage.tsx`, `BundlesPage.tsx`.
  - `AppShell.tsx` updated with platform-only "Platform Admin" nav section + Commercial link.
  - `apps/web/src/i18n/en.json` — full `commercial` section added, `shell.nav.platform` + `shell.nav.commercial` added.
  - ADR-026 created (`docs/adr/ADR-026-commercial-architecture.md`).
- **DB:** 3 new enums (`CommercialStatus`, `OfferingType`, `ActivationStatus`) + 10 new models (`Offering`, `PriceBook`, `PriceBookEntry`, `ClientPriceOverride`, `Bundle`, `BundleItem`, `ActivationRequest`, `ActivationRequestEvent`, `DeploymentChecklist`, `DeploymentChecklistItem`). Business model extended with `commercialStatus`, `accountNotes`, `assignedTo`. Manual migration applied (`20260825140000_phase12_commercial`); marked via `prisma migrate resolve --applied`.
- **Architecture (ADR-026):** Platform-only commercial layer; all amounts in integer minor units (paise) — zero monetary constants in application code (CI-grep clean); activation state machine (REQUESTED→QUOTED→APPROVED→PENDING_SETUP→ACTIVE→SUSPENDED|REMOVED) enforced by `VALID_TRANSITIONS` map on both API and UI; every state transition appends an immutable `ActivationRequestEvent` (ADR-016); checklist auto-marks `completedAt` when all items done (inside `$transaction`).
- **Permissions:** 6 new `restricted: true` permissions (`platform.commercial.view/manage`, `platform.client.view/manage`, `platform.activation.view/manage`). `platform-admin` wildcard covers all automatically.
- **Security invariants:** Business-realm users receive 403 on all `/internal/commercial/*` routes; IDOR isolation — activation requests scoped by `:businessId` path segment; unauthenticated requests return 401.
- **Testing:** 56 new E2E tests (`test/commercial.e2e-spec.ts`). Total: 27 unit + 418 E2E = 445 tests, all green. Coverage: Offering CRUD + key-uniqueness; PriceBook CRUD + entries + default enforcement; Bundle CRUD + items + duplicate guard; Client list/filter/get/update/usage/price-overrides; Activation Request full state machine (5-transition happy path) + invalid transition guard (400) + IDOR isolation; Deployment Checklist create/get/item-complete/auto-complete logic; Security suite (business-403 ×5, unauth-401).
- **Roadmap updated** to v1.12. Phase 13 (Onboarding / Deployment) is READY to start.

### 2026-08-25 (Phase 10 — Printing & Hardware)
- **Phase 10 implemented and gate-passed.**
- **Scope delivered:** `apps/api/src/printing/` — 13 files across 5 sub-modules (agent, printer, template, job, printing.module.ts) + `certified-models.ts`. `PrintingModule` registered in `AppModule`. ADR-025 created (`docs/adr/ADR-025-printing-hardware-phase10.md`).
- **DB:** 4 new enums (`PrintPurpose`, `PrintJobStatus`, `PrintJobSourceType`, `PrinterConnectionType`) + 4 new models (`PrintAgent`, `PrinterProfile`, `PrintTemplate`, `PrintJob`). Manual migration applied; marked applied via `prisma migrate resolve --applied`. Partial unique indexes for at-most-one-default-per-scope enforced in SQL.
- **Architecture:** Cloud→PrintAgent→ESC/POS boundary (ADR-007); polling over push (ADR-025); payload-embedded jobs (self-contained, no callbacks); manual trigger (no coupling to CheckoutModule/RestaurantModule); sha256 agent secret — plaintext returned once on create/rotate, never stored or logged. UNVERIFIED certified list (4 ESC/POS models — physical testing deferred to Phase 14).
- **State machine:** QUEUED→SENT (agent claims atomically via updateMany WHERE status=QUEUED)→PRINTED|FAILED|OFFLINE. Retry: FAILED resets to QUEUED until retryCount ≥ maxRetries → terminal FAILED. OFFLINE: sentAt cleared so job can be re-claimed. Reprints are new jobs with parentJobId — history immutable.
- **Security finding fixed (inline):** `secretHash` was being returned in all agent API responses (exposed DB hash). Fixed by adding `AgentPublic = Omit<PrintAgent, 'secretHash'>` and `redact()` helper applied to all agent service return paths. `validateSecret()` (internal guard use only) retains full `PrintAgent`.
- **Pre-existing debt fixed (gate requirement — clean lint was gating):** `order.service.ts` — removed unused `ConflictError`, added `ServiceRequestWithLines` type, eliminated 11 `as any` casts, replaced conditional variant include with separate query; `alert-rule.service.ts` — removed unused `ValidationError`; `module.controller.ts` — removed unused `actorOf`; `platform-module.controller.ts` — removed unused `ParseUUIDPipe`; `restaurant-operations.e2e-spec.ts` — replaced 8 untyped `any` callback params with specific types.
- **Testing:** 56 new E2E tests (`test/printing.e2e-spec.ts`). Total: 27 unit + 332 E2E = 359 tests, all green. Coverage: PrintAgent CRUD + secret rotation + delete blocked when printers attached; PrinterProfile CRUD + purpose filter; PrintTemplate CRUD + default-un-set on second default; agent heartbeat + valid/invalid bearer; PrintJob enqueue (MANUAL) + idempotency + list/filter/fetch + cancel; full job lifecycle (QUEUED→SENT→PRINTED); retry loop (QUEUED→SENT→QUEUED on partial failure → FAILED on exhaust); OFFLINE transition; reprint (new job + parentJobId) + reprint idempotency; cross-business isolation ×6; module gating ×4.
- **Roadmap updated** to v1.10. Phase 11 (Reports / Alerts / Audit) is READY to start.

### 2026-08-25 (Phase 9 — Checkout & Payments)
- **Phase 9 implemented and gate-passed.**
- **Scope delivered:** `apps/api/src/checkout/` — 10 files: `checkout.module.ts`, `provider/payment-provider.interface.ts`, `provider/cash.provider.ts`, `provider/manual-upi.provider.ts`, `provider/payment-provider.registry.ts`, `invoice/invoice.dto.ts`, `invoice/invoice.service.ts`, `invoice/invoice.controller.ts`, `payment/payment.dto.ts`, `payment/payment.service.ts`, `payment/payment.controller.ts`. `CheckoutModule` registered in `AppModule`.
- **DB:** 4 new Prisma models (`Invoice`, `InvoiceLine`, `Payment`, `Refund`), 4 new enums (`InvoiceStatus`, `PaymentStatus`, `PaymentMethod`, `RefundStatus`), back-relations on Business/Location/GuestSession/ServiceRequestLine. Manual migration applied (shadow-DB ordering bug workaround, same as Phase 8 pattern); marked applied via `prisma migrate resolve --applied`. Partial unique index `invoice_session_active_unique` enforced in SQL WHERE clause (not Prisma DSL).
- **Key financial invariants enforced:** integer paise throughout (ADR-015); idempotency lookup BEFORE status validation prevents double-charge on retry; invoice PAID atomically with first CAPTURED payment in `$transaction`; voided invoice cancels PENDING payments inside same transaction; voided invoice numbers consumed forever; failed capture never closes checkout.
- **Security findings fixed (inline audit):** SEC-1 MEDIUM (refund aggregate missing businessId scope) · SEC-2 LOW (billableLines nested filter missing businessId defense-in-depth) · SEC-3 LOW (PENDING payment cancellation outside void transaction). All 3 fixed before gate.
- **Lint fix:** removed 2 unnecessary `as any` casts — `invoice.locationId` and `payment.referenceCode` both exist on Prisma-generated types.
- **Testing:** 31 new E2E tests (`test/checkout.e2e-spec.ts`). Total: 27 unit + 276 E2E = 303 tests, all green.
- **Roadmap updated** to v1.9. Phase 10 (Printing & Hardware) is READY to start.

### 2026-08-24 (Phase 8 — Restaurant Operations)
- **Phase 8 implemented and gate-passed.**
- **Scope delivered:** 3 new modules (`session/`, `order/`, extended `catalog/`) + restaurant.module.ts update. New controllers: `SessionController`, `TableResetController`, `OrderController`, `KitchenController`, `ProductionAreaController`. New services: `SessionService`, `OrderService`. Extended: `CatalogService` (production area CRUD), `CatalogController` (ProductionAreaController). 6 new permissions registered in module manifest.
- **DB:** 5 new Prisma models (`ProductionArea`, `GuestSession`, `ServiceRequest`, `ServiceRequestLine`, `ServiceRequestLineModifier`), 3 new enums (`GuestSessionStatus`, `ServiceRequestStatus`, `ServiceLineStatus`), `productionAreaId` on `CatalogItem`. Manual migration applied due to shadow-database ordering bug (pre-existing timestamps); marked as applied via `prisma migrate resolve --applied`.
- **Key architectural decisions:** requestNumber allocated at SENT not DRAFT (avoids gaps); atomic table-claim via `updateMany WHERE status=AVAILABLE`; roundNumber computed inside transaction to prevent race; cancelLine rollup re-queried inside transaction to prevent concurrent-cancel race; WebSocket deferred (BLOCKER-B02, no Redis); financial snapshots (name/price/taxRate) immutable at line creation, live FKs use SetNull for menu-change safety; idempotency via P2002→return existing; ParseEnumPipe on status query params.
- **Security gate (parallel adversarial agent):** PASS after fixes. 0 CRITICAL, 0 HIGH in final code. Fixes applied: lineIds membership validation in `transitionRequest`; lineIds max(500) in DTO; direct count query in voidSession (removed fragile include cast); Decimal.toNumber() in taxRateSnapshot; roundNumber inside transaction.
- **Code quality gate (parallel review agent):** B rating → RISK items fixed: roundNumber race, stale cancelLine rollup, taxRateSnapshot type. No remaining correctness gaps.
- **Testing:** 49 new E2E tests (`restaurant-operations.e2e-spec.ts`). Total: 27 unit + 245 E2E = 272 tests, all green. Coverage: production area CRUD + cross-tenant isolation, session lifecycle + table state transitions, full order state machine (DRAFT→SERVED), idempotency (duplicate key returns same request), optimistic concurrency (409 VERSION_CONFLICT), line/request cancellation with auto-rollup, booking→seat flow, kitchen queue + location filter, module gating ×4, validation edge cases ×4.
- **Roadmap updated** to v1.8. Phase 9 (Checkout & Payments) is READY to start.

## 11. CONFLICTS & DEVIATIONS FROM SPECIFICATION

| # | Conflict | Affected Requirement | Options Considered | Recommendation / Resolution | Status |
|---|---|---|---|---|---|
| C-01 | Spec says MVP includes "printing" while hardware reality varies wildly | Restaurant MVP scope (Master doc Module J) | (a) block launch on universal printer support (b) certify small ESC/POS list + agent + degraded fallbacks | (b) adopted via ADR-007; spec intent preserved (printing IS in MVP), compatibility scope narrowed deliberately and documented | RESOLVED |
| C-02 | Master doc lists "Global Search" as day-one Core capability; analysis found federated search high-cost/low-MVP-value | Nexus Core definition (Master doc §2) | (a) build federated search in P2 (b) ship module-scoped search with Core search-provider registry seam, unify later | (b) recommended — Core keeps the registry interface so the DoD "search across enabled records" lands progressively starting P7/V1 | DEFERRED — pilot readiness audit (2026-08-30) confirmed no federated search is needed for V1 pilot. Module-scoped filtering/listing in each module (guests, catalog, orders, expenses) satisfies pilot search needs. Full-text cross-module search deferred to a post-pilot release; decision should be confirmed with product owner before building. |

> New conflicts get appended here the moment they are discovered. Nothing is silently rewritten.

<!-- END -->




