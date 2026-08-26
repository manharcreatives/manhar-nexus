-- Phase 10: Printing & Hardware
-- PrintAgent · PrinterProfile · PrintTemplate · PrintJob
-- Applied manually (shadow-DB ordering workaround — same as Phases 8/9).

-- ─── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE "PrintPurpose" AS ENUM ('RECEIPT', 'KOT');
CREATE TYPE "PrintJobStatus" AS ENUM ('QUEUED', 'SENT', 'PRINTED', 'FAILED', 'OFFLINE', 'CANCELLED');
CREATE TYPE "PrintJobSourceType" AS ENUM ('INVOICE', 'SERVICE_REQUEST', 'MANUAL');
CREATE TYPE "PrinterConnectionType" AS ENUM ('NETWORK_ESC_POS', 'USB_ESC_POS');

-- ─── PrintAgent ──────────────────────────────────────────────────────────────

CREATE TABLE "print_agent" (
  "id"          UUID        NOT NULL DEFAULT gen_random_uuid(),
  "businessId"  UUID        NOT NULL,
  "locationId"  UUID        NOT NULL,
  "name"        TEXT        NOT NULL,
  "secretHash"  TEXT        NOT NULL,
  "lastSeenAt"  TIMESTAMPTZ,
  "isActive"    BOOLEAN     NOT NULL DEFAULT true,
  "version"     INTEGER     NOT NULL DEFAULT 1,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "print_agent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "print_agent_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT,
  CONSTRAINT "print_agent_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "location"("id") ON DELETE RESTRICT
);

CREATE INDEX "print_agent_businessId_idx" ON "print_agent"("businessId");
CREATE INDEX "print_agent_locationId_idx" ON "print_agent"("locationId");

-- ─── PrinterProfile ──────────────────────────────────────────────────────────

CREATE TABLE "printer_profile" (
  "id"             UUID                    NOT NULL DEFAULT gen_random_uuid(),
  "businessId"     UUID                    NOT NULL,
  "locationId"     UUID                    NOT NULL,
  "agentId"        UUID,
  "name"           TEXT                    NOT NULL,
  "purpose"        "PrintPurpose"          NOT NULL,
  "connectionType" "PrinterConnectionType" NOT NULL,
  "deviceConfig"   JSONB                   NOT NULL DEFAULT '{}',
  "isActive"       BOOLEAN                 NOT NULL DEFAULT true,
  "version"        INTEGER                 NOT NULL DEFAULT 1,
  "createdAt"      TIMESTAMPTZ             NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ             NOT NULL DEFAULT now(),

  CONSTRAINT "printer_profile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "printer_profile_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT,
  CONSTRAINT "printer_profile_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "location"("id") ON DELETE RESTRICT,
  CONSTRAINT "printer_profile_agentId_fkey"
    FOREIGN KEY ("agentId") REFERENCES "print_agent"("id") ON DELETE SET NULL
);

CREATE INDEX "printer_profile_businessId_idx" ON "printer_profile"("businessId");
CREATE INDEX "printer_profile_locationId_idx" ON "printer_profile"("locationId");
CREATE INDEX "printer_profile_business_purpose_active_idx"
  ON "printer_profile"("businessId", "purpose", "isActive");

-- ─── PrintTemplate ───────────────────────────────────────────────────────────

CREATE TABLE "print_template" (
  "id"         UUID           NOT NULL DEFAULT gen_random_uuid(),
  "businessId" UUID           NOT NULL,
  "locationId" UUID,
  "purpose"    "PrintPurpose" NOT NULL,
  "name"       TEXT           NOT NULL,
  "config"     JSONB          NOT NULL DEFAULT '{}',
  "isDefault"  BOOLEAN        NOT NULL DEFAULT false,
  "version"    INTEGER        NOT NULL DEFAULT 1,
  "createdAt"  TIMESTAMPTZ    NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMPTZ    NOT NULL DEFAULT now(),

  CONSTRAINT "print_template_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "print_template_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT,
  CONSTRAINT "print_template_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "location"("id") ON DELETE SET NULL
);

CREATE INDEX "print_template_businessId_idx" ON "print_template"("businessId");
CREATE INDEX "print_template_business_purpose_idx" ON "print_template"("businessId", "purpose");

-- Partial unique index: at most one default template per (business, purpose)
-- at business scope (locationId IS NULL).
CREATE UNIQUE INDEX "print_template_business_default_unique"
  ON "print_template"("businessId", "purpose")
  WHERE "isDefault" = true AND "locationId" IS NULL;

-- Partial unique index: at most one default template per (business, location, purpose).
CREATE UNIQUE INDEX "print_template_location_default_unique"
  ON "print_template"("businessId", "locationId", "purpose")
  WHERE "isDefault" = true AND "locationId" IS NOT NULL;

-- ─── PrintJob ────────────────────────────────────────────────────────────────

CREATE TABLE "print_job" (
  "id"               UUID                 NOT NULL DEFAULT gen_random_uuid(),
  "businessId"       UUID                 NOT NULL,
  "locationId"       UUID                 NOT NULL,
  "printerId"        UUID,
  "idempotencyKey"   UUID                 NOT NULL,
  "purpose"          "PrintPurpose"       NOT NULL,
  "status"           "PrintJobStatus"     NOT NULL DEFAULT 'QUEUED',
  "sourceType"       "PrintJobSourceType" NOT NULL,
  "sourceId"         TEXT                 NOT NULL,
  "payload"          JSONB                NOT NULL,
  "retryCount"       INTEGER              NOT NULL DEFAULT 0,
  "maxRetries"       INTEGER              NOT NULL DEFAULT 3,
  "parentJobId"      UUID,
  "requestedById"    UUID,
  "requestedByLabel" TEXT,
  "failureReason"    TEXT,
  "sentAt"           TIMESTAMPTZ,
  "printedAt"        TIMESTAMPTZ,
  "failedAt"         TIMESTAMPTZ,
  "cancelledAt"      TIMESTAMPTZ,
  "version"          INTEGER              NOT NULL DEFAULT 1,
  "createdAt"        TIMESTAMPTZ          NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMPTZ          NOT NULL DEFAULT now(),

  CONSTRAINT "print_job_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "print_job_businessId_idempotencyKey_key"
    UNIQUE ("businessId", "idempotencyKey"),
  CONSTRAINT "print_job_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT,
  CONSTRAINT "print_job_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "location"("id") ON DELETE RESTRICT,
  CONSTRAINT "print_job_printerId_fkey"
    FOREIGN KEY ("printerId") REFERENCES "printer_profile"("id") ON DELETE SET NULL,
  CONSTRAINT "print_job_parentJobId_fkey"
    FOREIGN KEY ("parentJobId") REFERENCES "print_job"("id") ON DELETE SET NULL
);

CREATE INDEX "print_job_businessId_idx" ON "print_job"("businessId");
CREATE INDEX "print_job_location_status_idx" ON "print_job"("locationId", "status");
CREATE INDEX "print_job_printer_status_idx" ON "print_job"("printerId", "status");
CREATE INDEX "print_job_source_idx" ON "print_job"("businessId", "sourceType", "sourceId");
