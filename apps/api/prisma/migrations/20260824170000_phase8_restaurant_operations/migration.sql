-- Phase 8 — Restaurant Operations
-- Adds: GuestSessionStatus, ServiceRequestStatus, ServiceLineStatus enums;
-- production_area, guest_session, service_request, service_request_line,
-- service_request_line_modifier tables; productionAreaId column on catalog_item.
--
-- Financial snapshots on lines/modifiers are immutable after creation (ADR-016).
-- idempotencyKey UNIQUE(businessId) prevents duplicate sends on retry (ADR-017).
-- requestNumber allocated at SENT time via NumberingSeries (gapless).

-- ─── New Enums ────────────────────────────────────────────────────────────────

CREATE TYPE "GuestSessionStatus" AS ENUM ('OPEN', 'CLOSED', 'VOID');

CREATE TYPE "ServiceRequestStatus" AS ENUM (
  'DRAFT', 'SENT', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'CLOSED', 'CANCELLED'
);

CREATE TYPE "ServiceLineStatus" AS ENUM ('PENDING', 'PREPARING', 'READY', 'SERVED', 'CANCELLED');

-- ─── Production Area ──────────────────────────────────────────────────────────

CREATE TABLE "production_area" (
  "id"         UUID         NOT NULL DEFAULT gen_random_uuid(),
  "businessId" UUID         NOT NULL,
  "locationId" UUID         NOT NULL,
  "name"       TEXT         NOT NULL,
  "isActive"   BOOLEAN      NOT NULL DEFAULT true,
  "sortOrder"  INTEGER      NOT NULL DEFAULT 0,
  "version"    INTEGER      NOT NULL DEFAULT 1,
  "createdAt"  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "production_area_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "production_area_businessId_idx" ON "production_area"("businessId");
CREATE INDEX "production_area_locationId_idx" ON "production_area"("locationId");

ALTER TABLE "production_area"
  ADD CONSTRAINT "production_area_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "production_area"
  ADD CONSTRAINT "production_area_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── Production Area → CatalogItem routing column ─────────────────────────────

ALTER TABLE "catalog_item"
  ADD COLUMN "productionAreaId" UUID;

ALTER TABLE "catalog_item"
  ADD CONSTRAINT "catalog_item_productionAreaId_fkey"
  FOREIGN KEY ("productionAreaId") REFERENCES "production_area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Guest Session ─────────────────────────────────────────────────────────────

CREATE TABLE "guest_session" (
  "id"              UUID               NOT NULL DEFAULT gen_random_uuid(),
  "businessId"      UUID               NOT NULL,
  "locationId"      UUID               NOT NULL,
  "diningTableId"   UUID               NOT NULL,
  "bookingId"       UUID,
  "guestId"         UUID,
  "assignedStaffId" UUID,
  "partySize"       INTEGER            NOT NULL DEFAULT 1,
  "status"          "GuestSessionStatus" NOT NULL DEFAULT 'OPEN',
  "openedAt"        TIMESTAMPTZ(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt"        TIMESTAMPTZ(6),
  "notes"           TEXT,
  "version"         INTEGER            NOT NULL DEFAULT 1,
  "createdAt"       TIMESTAMPTZ(6)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMPTZ(6)     NOT NULL,
  CONSTRAINT "guest_session_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "guest_session_businessId_idx"            ON "guest_session"("businessId");
CREATE INDEX "guest_session_locationId_status_idx"     ON "guest_session"("locationId", "status");
CREATE INDEX "guest_session_diningTableId_status_idx"  ON "guest_session"("diningTableId", "status");

ALTER TABLE "guest_session"
  ADD CONSTRAINT "guest_session_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "guest_session"
  ADD CONSTRAINT "guest_session_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "guest_session"
  ADD CONSTRAINT "guest_session_diningTableId_fkey"
  FOREIGN KEY ("diningTableId") REFERENCES "dining_table"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "guest_session"
  ADD CONSTRAINT "guest_session_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "guest_session"
  ADD CONSTRAINT "guest_session_guestId_fkey"
  FOREIGN KEY ("guestId") REFERENCES "guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "guest_session"
  ADD CONSTRAINT "guest_session_assignedStaffId_fkey"
  FOREIGN KEY ("assignedStaffId") REFERENCES "staff_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Service Request ───────────────────────────────────────────────────────────

CREATE TABLE "service_request" (
  "id"             UUID                   NOT NULL DEFAULT gen_random_uuid(),
  "businessId"     UUID                   NOT NULL,
  "locationId"     UUID                   NOT NULL,
  "sessionId"      UUID                   NOT NULL,
  "staffId"        UUID,
  "roundNumber"    INTEGER                NOT NULL DEFAULT 1,
  "requestNumber"  TEXT,
  "status"         "ServiceRequestStatus" NOT NULL DEFAULT 'DRAFT',
  "idempotencyKey" UUID                   NOT NULL,
  "notes"          TEXT,
  "cancelReason"   TEXT,
  "sentAt"         TIMESTAMPTZ(6),
  "acceptedAt"     TIMESTAMPTZ(6),
  "preparedAt"     TIMESTAMPTZ(6),
  "servedAt"       TIMESTAMPTZ(6),
  "version"        INTEGER                NOT NULL DEFAULT 1,
  "createdAt"      TIMESTAMPTZ(6)         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMPTZ(6)         NOT NULL,
  CONSTRAINT "service_request_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_request_businessId_idempotencyKey_key"
  ON "service_request"("businessId", "idempotencyKey");
CREATE INDEX "service_request_businessId_idx"        ON "service_request"("businessId");
CREATE INDEX "service_request_sessionId_idx"         ON "service_request"("sessionId");
CREATE INDEX "service_request_businessId_status_idx" ON "service_request"("businessId", "status");
CREATE INDEX "service_request_locationId_status_idx" ON "service_request"("locationId", "status");

ALTER TABLE "service_request"
  ADD CONSTRAINT "service_request_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_request"
  ADD CONSTRAINT "service_request_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_request"
  ADD CONSTRAINT "service_request_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "guest_session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_request"
  ADD CONSTRAINT "service_request_staffId_fkey"
  FOREIGN KEY ("staffId") REFERENCES "staff_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Service Request Line ──────────────────────────────────────────────────────

CREATE TABLE "service_request_line" (
  "id"                      UUID                NOT NULL DEFAULT gen_random_uuid(),
  "serviceRequestId"        UUID                NOT NULL,
  "businessId"              UUID                NOT NULL,
  "catalogItemId"           UUID,
  "variantId"               UUID,
  "itemNameSnapshot"        TEXT                NOT NULL,
  "variantNameSnapshot"     TEXT,
  "unitPriceMinorUnits"     INTEGER             NOT NULL,
  "taxRateSnapshot"         DECIMAL(6,4)        NOT NULL,
  "taxCategoryNameSnapshot" TEXT,
  "quantity"                INTEGER             NOT NULL DEFAULT 1,
  "notes"                   TEXT,
  "kitchenNote"             TEXT,
  "status"                  "ServiceLineStatus" NOT NULL DEFAULT 'PENDING',
  "cancelReason"            TEXT,
  "version"                 INTEGER             NOT NULL DEFAULT 1,
  "createdAt"               TIMESTAMPTZ(6)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMPTZ(6)      NOT NULL,
  CONSTRAINT "service_request_line_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "service_request_line_serviceRequestId_idx" ON "service_request_line"("serviceRequestId");
CREATE INDEX "service_request_line_businessId_idx"       ON "service_request_line"("businessId");

ALTER TABLE "service_request_line"
  ADD CONSTRAINT "service_request_line_serviceRequestId_fkey"
  FOREIGN KEY ("serviceRequestId") REFERENCES "service_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_request_line"
  ADD CONSTRAINT "service_request_line_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_request_line"
  ADD CONSTRAINT "service_request_line_catalogItemId_fkey"
  FOREIGN KEY ("catalogItemId") REFERENCES "catalog_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "service_request_line"
  ADD CONSTRAINT "service_request_line_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "catalog_variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Service Request Line Modifier ────────────────────────────────────────────

CREATE TABLE "service_request_line_modifier" (
  "id"                 UUID    NOT NULL DEFAULT gen_random_uuid(),
  "lineId"             UUID    NOT NULL,
  "businessId"         UUID    NOT NULL,
  "modifierOptionId"   UUID,
  "optionNameSnapshot" TEXT    NOT NULL,
  "priceAdjMinorUnits" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "service_request_line_modifier_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "service_request_line_modifier_lineId_idx"     ON "service_request_line_modifier"("lineId");
CREATE INDEX "service_request_line_modifier_businessId_idx" ON "service_request_line_modifier"("businessId");

ALTER TABLE "service_request_line_modifier"
  ADD CONSTRAINT "service_request_line_modifier_lineId_fkey"
  FOREIGN KEY ("lineId") REFERENCES "service_request_line"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_request_line_modifier"
  ADD CONSTRAINT "service_request_line_modifier_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_request_line_modifier"
  ADD CONSTRAINT "service_request_line_modifier_modifierOptionId_fkey"
  FOREIGN KEY ("modifierOptionId") REFERENCES "modifier_option"("id") ON DELETE SET NULL ON UPDATE CASCADE;
