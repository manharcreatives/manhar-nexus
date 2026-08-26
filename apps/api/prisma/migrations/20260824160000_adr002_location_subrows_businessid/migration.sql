-- ADR-002 hardening: add businessId to location_hours and location_service_mode.
-- These tables were originally scoped only by locationId. Any query that
-- bypasses the service-layer assertOwned() check would leak cross-tenant rows
-- without this column. The backfill derives businessId from the parent location.

-- ── location_hours ────────────────────────────────────────────────────────────

ALTER TABLE "location_hours"
    ADD COLUMN "businessId" UUID;

UPDATE "location_hours" lh
    SET "businessId" = l."businessId"
    FROM "location" l
    WHERE lh."locationId" = l."id";

ALTER TABLE "location_hours"
    ALTER COLUMN "businessId" SET NOT NULL;

ALTER TABLE "location_hours"
    ADD CONSTRAINT "location_hours_business_fk"
        FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT;

CREATE INDEX "location_hours_businessId_idx" ON "location_hours" ("businessId");

-- ── location_service_mode ─────────────────────────────────────────────────────

ALTER TABLE "location_service_mode"
    ADD COLUMN "businessId" UUID;

UPDATE "location_service_mode" lsm
    SET "businessId" = l."businessId"
    FROM "location" l
    WHERE lsm."locationId" = l."id";

ALTER TABLE "location_service_mode"
    ALTER COLUMN "businessId" SET NOT NULL;

ALTER TABLE "location_service_mode"
    ADD CONSTRAINT "location_service_mode_business_fk"
        FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT;

CREATE INDEX "location_service_mode_businessId_idx" ON "location_service_mode" ("businessId");
