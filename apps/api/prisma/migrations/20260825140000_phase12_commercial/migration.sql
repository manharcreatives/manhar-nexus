-- Phase 12 — Commercial / Add-on Management
-- Platform-level commercial data: offerings, price books, bundles, client
-- account metadata, activation request workflow, deployment checklists.
-- No monetary constants in code; all amounts live in this schema (ADR-026).

-- ─── Enums ───────────────────────────────────────────────────────────────────

CREATE TYPE "CommercialStatus" AS ENUM (
  'PROSPECT',
  'TRIAL',
  'ACTIVE',
  'SUSPENDED',
  'CHURNED'
);

CREATE TYPE "OfferingType" AS ENUM (
  'SETUP_FEE',
  'RECURRING',
  'ONE_TIME',
  'TRIAL'
);

CREATE TYPE "ActivationStatus" AS ENUM (
  'REQUESTED',
  'QUOTED',
  'APPROVED',
  'PENDING_SETUP',
  'ACTIVE',
  'SUSPENDED',
  'REMOVED'
);

-- ─── Extend Business with commercial account fields ───────────────────────────

ALTER TABLE "business"
  ADD COLUMN "commercialStatus" "CommercialStatus" NOT NULL DEFAULT 'PROSPECT',
  ADD COLUMN "accountNotes"     TEXT,
  ADD COLUMN "assignedTo"       TEXT;

-- ─── Offering catalog ────────────────────────────────────────────────────────
-- What Manhar sells: setup fees, recurring subscriptions, one-time add-ons, trials.

CREATE TABLE "offering" (
  "id"          UUID          NOT NULL DEFAULT gen_random_uuid(),
  "key"         TEXT          NOT NULL,
  "name"        TEXT          NOT NULL,
  "description" TEXT,
  "type"        "OfferingType" NOT NULL,
  "moduleKeys"  TEXT[]        NOT NULL DEFAULT '{}',
  "isActive"    BOOLEAN       NOT NULL DEFAULT true,
  "sortOrder"   INTEGER       NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "offering_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "offering_key_unique" ON "offering"("key");

-- ─── Price book ──────────────────────────────────────────────────────────────
-- Named collection of prices; effective-dated; currencyCode per book.

CREATE TABLE "price_book" (
  "id"           UUID          NOT NULL DEFAULT gen_random_uuid(),
  "name"         TEXT          NOT NULL,
  "description"  TEXT,
  "currencyCode" TEXT          NOT NULL DEFAULT 'INR',
  "isDefault"    BOOLEAN       NOT NULL DEFAULT false,
  "validFrom"    TIMESTAMPTZ(6),
  "validTo"      TIMESTAMPTZ(6),
  "isActive"     BOOLEAN       NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "price_book_pkey" PRIMARY KEY ("id")
);

-- At most one default price book at a time (platform-wide).
CREATE UNIQUE INDEX "price_book_default_unique"
  ON "price_book"("isDefault")
  WHERE "isDefault" = true AND "isActive" = true;

-- ─── Price book entry ─────────────────────────────────────────────────────────
-- One price per offering within a price book. amountMinorUnits (paise/cents).

CREATE TABLE "price_book_entry" (
  "id"                UUID    NOT NULL DEFAULT gen_random_uuid(),
  "priceBookId"       UUID    NOT NULL,
  "offeringId"        UUID    NOT NULL,
  "amountMinorUnits"  INTEGER NOT NULL,
  "billingPeriodDays" INTEGER,
  "createdAt"         TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updatedAt"         TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "price_book_entry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "price_book_entry_priceBookId_fkey"
    FOREIGN KEY ("priceBookId") REFERENCES "price_book"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "price_book_entry_offeringId_fkey"
    FOREIGN KEY ("offeringId") REFERENCES "offering"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "price_book_entry_unique"
  ON "price_book_entry"("priceBookId", "offeringId");
CREATE INDEX "price_book_entry_priceBookId_idx"
  ON "price_book_entry"("priceBookId");

-- ─── Client price override ───────────────────────────────────────────────────
-- Effective-dated per-client price that supersedes the price book for this offering.

CREATE TABLE "client_price_override" (
  "id"               UUID          NOT NULL DEFAULT gen_random_uuid(),
  "businessId"       UUID          NOT NULL,
  "offeringId"       UUID          NOT NULL,
  "amountMinorUnits" INTEGER       NOT NULL,
  "currencyCode"     TEXT          NOT NULL DEFAULT 'INR',
  "effectiveFrom"    TIMESTAMPTZ(6) NOT NULL,
  "effectiveTo"      TIMESTAMPTZ(6),
  "reason"           TEXT,
  "createdAt"        TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updatedAt"        TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "client_price_override_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "client_price_override_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "business"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "client_price_override_offeringId_fkey"
    FOREIGN KEY ("offeringId") REFERENCES "offering"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "client_price_override_businessId_idx"
  ON "client_price_override"("businessId");
CREATE INDEX "client_price_override_biz_offering_idx"
  ON "client_price_override"("businessId", "offeringId");

-- ─── Bundle ───────────────────────────────────────────────────────────────────
-- A named group of offerings sold together (e.g. "Restaurant Starter Pack").

CREATE TABLE "bundle" (
  "id"          UUID    NOT NULL DEFAULT gen_random_uuid(),
  "key"         TEXT    NOT NULL,
  "name"        TEXT    NOT NULL,
  "description" TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "bundle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bundle_key_unique" ON "bundle"("key");

-- ─── Bundle item ─────────────────────────────────────────────────────────────
-- Composite PK: each offering can appear at most once per bundle.

CREATE TABLE "bundle_item" (
  "bundleId"   UUID NOT NULL,
  "offeringId" UUID NOT NULL,
  CONSTRAINT "bundle_item_pkey" PRIMARY KEY ("bundleId", "offeringId"),
  CONSTRAINT "bundle_item_bundleId_fkey"
    FOREIGN KEY ("bundleId") REFERENCES "bundle"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "bundle_item_offeringId_fkey"
    FOREIGN KEY ("offeringId") REFERENCES "offering"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ─── Activation request ──────────────────────────────────────────────────────
-- The onboarding workflow for granting a client access to a bundle/module set.
-- State machine: REQUESTED→QUOTED→APPROVED→PENDING_SETUP→ACTIVE→SUSPENDED|REMOVED

CREATE TABLE "activation_request" (
  "id"           UUID               NOT NULL DEFAULT gen_random_uuid(),
  "businessId"   UUID               NOT NULL,
  "bundleId"     UUID,
  "moduleKeys"   TEXT[]             NOT NULL DEFAULT '{}',
  "status"       "ActivationStatus" NOT NULL DEFAULT 'REQUESTED',
  "requestedBy"  TEXT,
  "assignedTo"   TEXT,
  "notes"        TEXT,
  "quotedAmount" INTEGER,
  "currencyCode" TEXT               NOT NULL DEFAULT 'INR',
  "quotedAt"     TIMESTAMPTZ(6),
  "approvedAt"   TIMESTAMPTZ(6),
  "setupAt"      TIMESTAMPTZ(6),
  "goLiveAt"     TIMESTAMPTZ(6),
  "removedAt"    TIMESTAMPTZ(6),
  "version"      INTEGER            NOT NULL DEFAULT 1,
  "createdAt"    TIMESTAMPTZ(6)     NOT NULL DEFAULT NOW(),
  "updatedAt"    TIMESTAMPTZ(6)     NOT NULL DEFAULT NOW(),
  CONSTRAINT "activation_request_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "activation_request_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "business"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "activation_request_bundleId_fkey"
    FOREIGN KEY ("bundleId") REFERENCES "bundle"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "activation_request_businessId_idx"
  ON "activation_request"("businessId");
CREATE INDEX "activation_request_status_idx"
  ON "activation_request"("status");

-- ─── Activation request event ────────────────────────────────────────────────
-- Immutable state-change log; every transition appends a row.

CREATE TABLE "activation_request_event" (
  "id"                  UUID               NOT NULL DEFAULT gen_random_uuid(),
  "activationRequestId" UUID               NOT NULL,
  "fromStatus"          "ActivationStatus",
  "toStatus"            "ActivationStatus" NOT NULL,
  "note"                TEXT,
  "actorId"             TEXT,
  "actorLabel"          TEXT,
  "createdAt"           TIMESTAMPTZ(6)     NOT NULL DEFAULT NOW(),
  CONSTRAINT "activation_request_event_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "activation_request_event_requestId_fkey"
    FOREIGN KEY ("activationRequestId") REFERENCES "activation_request"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "activation_request_event_requestId_idx"
  ON "activation_request_event"("activationRequestId", "createdAt");

-- ─── Deployment checklist ─────────────────────────────────────────────────────
-- One checklist per activation request; tracks go-live progress.

CREATE TABLE "deployment_checklist" (
  "id"                  UUID           NOT NULL DEFAULT gen_random_uuid(),
  "activationRequestId" UUID           NOT NULL,
  "businessId"          UUID           NOT NULL,
  "completedAt"         TIMESTAMPTZ(6),
  "createdAt"           TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updatedAt"           TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "deployment_checklist_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "deployment_checklist_request_unique" UNIQUE ("activationRequestId"),
  CONSTRAINT "deployment_checklist_requestId_fkey"
    FOREIGN KEY ("activationRequestId") REFERENCES "activation_request"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "deployment_checklist_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "business"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "deployment_checklist_businessId_idx"
  ON "deployment_checklist"("businessId");

-- ─── Deployment checklist item ────────────────────────────────────────────────

CREATE TABLE "deployment_checklist_item" (
  "id"          UUID           NOT NULL DEFAULT gen_random_uuid(),
  "checklistId" UUID           NOT NULL,
  "key"         TEXT           NOT NULL,
  "label"       TEXT           NOT NULL,
  "completed"   BOOLEAN        NOT NULL DEFAULT false,
  "completedAt" TIMESTAMPTZ(6),
  "sortOrder"   INTEGER        NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updatedAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "deployment_checklist_item_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "deployment_checklist_item_key_unique" UNIQUE ("checklistId", "key"),
  CONSTRAINT "deployment_checklist_item_checklistId_fkey"
    FOREIGN KEY ("checklistId") REFERENCES "deployment_checklist"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "deployment_checklist_item_checklistId_idx"
  ON "deployment_checklist_item"("checklistId");
