# ADR-027 — Onboarding / Deployment Architecture

**Date:** 2026-08-25  
**Status:** Accepted  
**Phase:** 13

---

## Context

Phase 12 established the commercial workflow (activation requests, deployment checklists). Phase 13 must turn the existing technical product into a repeatable client go-live process and establish safe deployment practices.

Two separable concerns:
1. **Client onboarding**: tracking which of the required setup milestones have been completed for a specific business before it goes live.
2. **Platform deployment**: safely applying code and schema changes to production with no accidental resets or data loss.

---

## Decisions

### 1. Onboarding Progress as milestone tracker

`OnboardingProgress` (one row per business) stores:
- `completedSteps: String[]` — array of step keys (e.g. `["BUSINESS_CREATED","LOCATION_ADDED"]`)
- `currentStep: String` — the next incomplete step (the "active" milestone)
- `completedAt` — set when all steps including `COMPLETED` are marked

**Step keys stored as TEXT[], not a Postgres enum.**  
New milestones can be added without a destructive migration (no ALTER TYPE … ADD VALUE required). The ordered step list (`ONBOARDING_STEPS` constant) is authoritative.

**Eight ordered milestones:**

| Step | Meaning |
|---|---|
| `BUSINESS_CREATED` | Business workspace created (auto-completed on init) |
| `LOCATION_ADDED` | At least one active location exists |
| `MODULES_SELECTED` | Modules activated and setup completed |
| `BRANDING_SET` | Slug / invoice name / logo / colors configured |
| `CONFIGURATION_DONE` | Key settings and alert rules configured |
| `USERS_PROVISIONED` | Owner and staff accounts created |
| `DEVICES_CONFIGURED` | Print agents and printers configured (optional) |
| `VALIDATED` | Test transactions completed |
| `COMPLETED` | Go-live confirmed; client is live |

**Step completion is idempotent** — marking an already-complete step is a no-op. Steps can be marked out of order (a Manhar staff member may configure devices before provisioning all users).

**`/internal/onboarding/:businessId/validate`** runs server-side checks (location count, active module count, user count, branding fields) so the wizard can surface actionable gaps.

### 2. Onboarding is PLATFORM-only

All `/internal/onboarding/*` routes require `platform.onboarding.view` / `platform.onboarding.manage` (both `restricted: true`). Business users have no visibility into onboarding state.

### 3. Relationship to Phase 12

Phase 12's `DeploymentChecklist` covers technical setup tasks within a single `ActivationRequest`. Phase 13's `OnboardingProgress` covers the broader go-live journey across all setup areas. They are complementary, not duplicative:

- Commercial approval → `ActivationRequest` (Phase 12)
- Technical go-live steps → `OnboardingProgress` (Phase 13)

### 4. Deployment model (resolved)

Multi-tenant cloud SaaS (ADR-002) on India-region infrastructure (ADR-013).  
One shared PostgreSQL database, one Node.js API process, one React SPA.  
No Docker (BLOCKER-B01 — resolved at Phase 14 pilot review).

**Deployment = sequential steps:**
1. `prisma migrate deploy` (forward-only, safe, production-grade)
2. `ts-node prisma/seed.ts` (idempotent reference data + IAM bootstrap)
3. Process reload (PM2 / systemd — outside the scope of this script)

**Deployment safety enforced by `infra/scripts/deploy.ps1`:**
- Validates required env vars are set
- Refuses dev-default secrets (`JWT_ACCESS_SECRET`) in production
- Refuses dev-credential `DATABASE_URL` in non-development environments
- Runs health check after migration and seed

### 5. Migration safety

`prisma migrate deploy` is used (not `migrate dev`):
- No shadow database, no auto-creation, no reset
- Only applies forward-pending migrations
- Fails hard on checksum mismatch (tampered migration file)

Migrations are reviewed like code — committed to git, applied to staging before production.

### 6. Secret handling

- Secrets never appear in code or migration files
- `.env.production.example` and `.env.staging.example` contain no real values
- `deploy.ps1` validates minimum JWT secret length for production
- Bootstrap password is a one-time credential; must be rotated after first login (documented in `docs/runbooks/deploy.md`)

---

## Consequences

**Positive**
- Repeatable, auditable go-live process for each client
- Wizard shows exactly which gaps remain before go-live
- Deployment scripts prevent accidental dev-credential production deployments
- Runbooks give the team clear procedures for deploy, rollback, backup, incident

**Negative / Trade-offs**
- Manual step completion — Manhar staff marks steps done; the wizard does not auto-detect all conditions (except via the `/validate` endpoint)
- No automated backup scheduling (deferred to Phase 14 — documented explicitly in `backup-restore.md`)
- No Docker/containerization (BLOCKER-B01; deferred)

---

## Alternatives Considered

**Full workflow engine (state machine per onboarding)**: Rejected — adds complexity without proportional value at MVP scale. Simple milestone array is sufficient for Phase 13.

**Auto-advance steps via event hooks**: Rejected — would require coupling every provisioning action to the onboarding tracker. Manual marking is explicit and auditable.
