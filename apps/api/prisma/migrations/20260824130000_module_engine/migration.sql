-- Phase 5: Module Engine
-- Per-business module lifecycle tracking. Module manifests are code-defined;
-- only the per-business activation state lives in the database.
--
-- Status semantics:
--   AVAILABLE    = no row (implicit) — activation not yet requested
--   TRIAL        = time-limited; set by platform (Phase 12)
--   PENDING_SETUP = activated but setup wizard not complete
--   ACTIVE        = fully running
--   SUSPENDED     = temporarily disabled by platform (data preserved)
--   DISABLED      = owner-disabled (data preserved, config preserved)
--   ARCHIVED      = platform-archived (data preserved, cannot re-enable without platform action)

CREATE TYPE "ModuleStatus" AS ENUM (
  'TRIAL',
  'PENDING_SETUP',
  'ACTIVE',
  'SUSPENDED',
  'DISABLED',
  'ARCHIVED'
);

CREATE TABLE "module_activation" (
    "id"               UUID           NOT NULL,
    "businessId"       UUID           NOT NULL,
    "moduleKey"        TEXT           NOT NULL,
    "status"           "ModuleStatus" NOT NULL DEFAULT 'PENDING_SETUP',
    "config"           JSONB          NOT NULL DEFAULT '{}',
    "setupCompletedAt" TIMESTAMPTZ(6),
    "activatedAt"      TIMESTAMPTZ(6),
    "suspendedAt"      TIMESTAMPTZ(6),
    "disabledAt"       TIMESTAMPTZ(6),
    "version"          INTEGER        NOT NULL DEFAULT 1,
    "createdAt"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "module_activation_pkey" PRIMARY KEY ("id")
);

-- At most one activation record per (business, module).
CREATE UNIQUE INDEX "module_activation_businessId_moduleKey_key"
  ON "module_activation"("businessId", "moduleKey");

CREATE INDEX "module_activation_businessId_idx"
  ON "module_activation"("businessId");

CREATE INDEX "module_activation_status_idx"
  ON "module_activation"("businessId", "status");

ALTER TABLE "module_activation"
  ADD CONSTRAINT "module_activation_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
