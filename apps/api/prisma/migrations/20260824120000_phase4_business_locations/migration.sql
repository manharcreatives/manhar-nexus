-- Phase 4: Business & Locations — branding, operating hours, service modes
-- Extends the tenant root (business) with identity/branding fields and adds two
-- new location-scoped tables for structured operating hours and service modes.

-- ── Business branding / invoice identity ────────────────────────────────────
ALTER TABLE "business"
  ADD COLUMN "slug"           TEXT,
  ADD COLUMN "accentColor"    TEXT,
  ADD COLUMN "logoUrl"        TEXT,
  ADD COLUMN "invoiceName"    TEXT,
  ADD COLUMN "invoiceAddress" TEXT,
  ADD COLUMN "taxId"          TEXT;

-- Slugs are globally unique (used in URLs / deep-link handles).
CREATE UNIQUE INDEX "business_slug_key" ON "business"("slug");

-- ── ServiceMode enum ─────────────────────────────────────────────────────────
CREATE TYPE "ServiceMode" AS ENUM (
  'DINE_IN',
  'TAKEOUT',
  'DELIVERY',
  'DRIVE_THROUGH',
  'ROOM_SERVICE'
);

-- ── location_hours ───────────────────────────────────────────────────────────
-- One row per (location, day-of-week). dayOfWeek: 0=Sunday … 6=Saturday.
-- openTime/closeTime stored as "HH:MM" strings (NULL when isClosed).
-- Cascade: removing a location removes its hours (no orphan-hours risk).
CREATE TABLE "location_hours" (
    "id"         UUID        NOT NULL,
    "locationId" UUID        NOT NULL,
    "dayOfWeek"  INTEGER     NOT NULL,
    "openTime"   TEXT,
    "closeTime"  TEXT,
    "isClosed"   BOOLEAN     NOT NULL DEFAULT false,
    "version"    INTEGER     NOT NULL DEFAULT 1,
    "createdAt"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "location_hours_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "location_hours_dayOfWeek_check" CHECK ("dayOfWeek" BETWEEN 0 AND 6)
);

-- One row per location per day — idempotent upserts replace the full week.
CREATE UNIQUE INDEX "location_hours_locationId_dayOfWeek_key"
  ON "location_hours"("locationId", "dayOfWeek");

CREATE INDEX "location_hours_locationId_idx"
  ON "location_hours"("locationId");

ALTER TABLE "location_hours"
  ADD CONSTRAINT "location_hours_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── location_service_mode ────────────────────────────────────────────────────
-- Composite PK: a location has at most one row per ServiceMode.
-- Cascade: removing a location removes its service-mode config.
CREATE TABLE "location_service_mode" (
    "locationId" UUID          NOT NULL,
    "mode"       "ServiceMode" NOT NULL,
    "isEnabled"  BOOLEAN       NOT NULL DEFAULT true,
    "updatedAt"  TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "location_service_mode_pkey" PRIMARY KEY ("locationId", "mode")
);

CREATE INDEX "location_service_mode_locationId_idx"
  ON "location_service_mode"("locationId");

ALTER TABLE "location_service_mode"
  ADD CONSTRAINT "location_service_mode_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
