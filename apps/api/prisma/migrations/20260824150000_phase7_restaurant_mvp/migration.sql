-- Phase 7: Restaurant MVP Foundation
-- Catalog (tax categories, categories, items, variants, modifier groups/options, item-modifier links)
-- Dining Space (dining areas, dining tables)
-- People (staff profiles, guests)
-- Bookings (manual table reservations)
--
-- Column names: camelCase (matching Prisma's default field→column mapping without @map).
-- Tenant isolation: businessId NOT NULL on every tenant-scoped table (ADR-002).
-- Money: prices stored as integer minor units (paise for INR) per ADR-015.

-- ─── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE "ModifierGroupType" AS ENUM ('SINGLE', 'MULTIPLE');
CREATE TYPE "DiningTableStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING');
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'SEATED', 'NO_SHOW', 'CANCELLED');

-- ─── Tax category ─────────────────────────────────────────────────────────────

CREATE TABLE "tax_category" (
    "id"          UUID         NOT NULL DEFAULT gen_random_uuid(),
    "businessId"  UUID         NOT NULL,
    "name"        TEXT         NOT NULL,
    -- rate as decimal 0.0000–1.0000 (e.g. 0.0500 = 5 %).
    "rate"        NUMERIC(6,4) NOT NULL DEFAULT 0,
    "isDefault"   BOOLEAN      NOT NULL DEFAULT FALSE,
    "isActive"    BOOLEAN      NOT NULL DEFAULT TRUE,
    "version"     INTEGER      NOT NULL DEFAULT 1,
    "createdAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updatedAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "tax_category_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tax_category_business_fk"
        FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT
);
CREATE INDEX "tax_category_businessId_idx" ON "tax_category" ("businessId");

-- ─── Catalog category ─────────────────────────────────────────────────────────

CREATE TABLE "catalog_category" (
    "id"          UUID    NOT NULL DEFAULT gen_random_uuid(),
    "businessId"  UUID    NOT NULL,
    "name"        TEXT    NOT NULL,
    "description" TEXT,
    "sortOrder"   INTEGER NOT NULL DEFAULT 0,
    "isActive"    BOOLEAN NOT NULL DEFAULT TRUE,
    "version"     INTEGER NOT NULL DEFAULT 1,
    "createdAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updatedAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "catalog_category_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "catalog_category_business_fk"
        FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT
);
CREATE INDEX "catalog_category_businessId_idx" ON "catalog_category" ("businessId");

-- ─── Catalog item ─────────────────────────────────────────────────────────────

CREATE TABLE "catalog_item" (
    "id"                    UUID    NOT NULL DEFAULT gen_random_uuid(),
    "businessId"            UUID    NOT NULL,
    "categoryId"            UUID    NOT NULL,
    "taxCategoryId"         UUID,
    "name"                  TEXT    NOT NULL,
    "description"           TEXT,
    -- ADR-015: money as minor integer units (paise for INR).
    "basePriceMinorUnits"   INTEGER NOT NULL DEFAULT 0,
    "isAvailable"           BOOLEAN NOT NULL DEFAULT TRUE,   -- sold-out flag
    "isActive"              BOOLEAN NOT NULL DEFAULT TRUE,
    "sortOrder"             INTEGER NOT NULL DEFAULT 0,
    "version"               INTEGER NOT NULL DEFAULT 1,
    "createdAt"             TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updatedAt"             TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "catalog_item_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "catalog_item_business_fk"
        FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT,
    CONSTRAINT "catalog_item_category_fk"
        FOREIGN KEY ("categoryId") REFERENCES "catalog_category"("id") ON DELETE RESTRICT,
    CONSTRAINT "catalog_item_tax_fk"
        FOREIGN KEY ("taxCategoryId") REFERENCES "tax_category"("id") ON DELETE SET NULL
);
CREATE INDEX "catalog_item_businessId_idx" ON "catalog_item" ("businessId");
CREATE INDEX "catalog_item_categoryId_idx" ON "catalog_item" ("categoryId");

-- ─── Catalog variant (size/type variants of an item) ──────────────────────────

CREATE TABLE "catalog_variant" (
    "id"                  UUID    NOT NULL DEFAULT gen_random_uuid(),
    "catalogItemId"       UUID    NOT NULL,
    "businessId"          UUID    NOT NULL,
    "name"                TEXT    NOT NULL,
    "priceAdjMinorUnits"  INTEGER NOT NULL DEFAULT 0,
    "isAvailable"         BOOLEAN NOT NULL DEFAULT TRUE,
    "sortOrder"           INTEGER NOT NULL DEFAULT 0,
    "version"             INTEGER NOT NULL DEFAULT 1,
    "createdAt"           TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updatedAt"           TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "catalog_variant_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "catalog_variant_item_fk"
        FOREIGN KEY ("catalogItemId") REFERENCES "catalog_item"("id") ON DELETE CASCADE,
    CONSTRAINT "catalog_variant_business_fk"
        FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT
);
CREATE INDEX "catalog_variant_catalogItemId_idx" ON "catalog_variant" ("catalogItemId");
CREATE INDEX "catalog_variant_businessId_idx" ON "catalog_variant" ("businessId");

-- ─── Modifier group ───────────────────────────────────────────────────────────

CREATE TABLE "modifier_group" (
    "id"              UUID                NOT NULL DEFAULT gen_random_uuid(),
    "businessId"      UUID                NOT NULL,
    "name"            TEXT                NOT NULL,
    "selectionType"   "ModifierGroupType" NOT NULL DEFAULT 'SINGLE',
    "isRequired"      BOOLEAN             NOT NULL DEFAULT FALSE,
    "minSelections"   INTEGER             NOT NULL DEFAULT 0,
    -- NULL = unlimited
    "maxSelections"   INTEGER,
    "sortOrder"       INTEGER             NOT NULL DEFAULT 0,
    "isActive"        BOOLEAN             NOT NULL DEFAULT TRUE,
    "version"         INTEGER             NOT NULL DEFAULT 1,
    "createdAt"       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updatedAt"       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "modifier_group_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "modifier_group_business_fk"
        FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT
);
CREATE INDEX "modifier_group_businessId_idx" ON "modifier_group" ("businessId");

-- ─── Modifier option ──────────────────────────────────────────────────────────

CREATE TABLE "modifier_option" (
    "id"                  UUID    NOT NULL DEFAULT gen_random_uuid(),
    "modifierGroupId"     UUID    NOT NULL,
    "businessId"          UUID    NOT NULL,
    "name"                TEXT    NOT NULL,
    "priceAdjMinorUnits"  INTEGER NOT NULL DEFAULT 0,
    "isDefault"           BOOLEAN NOT NULL DEFAULT FALSE,
    "isAvailable"         BOOLEAN NOT NULL DEFAULT TRUE,
    "sortOrder"           INTEGER NOT NULL DEFAULT 0,
    "version"             INTEGER NOT NULL DEFAULT 1,
    "createdAt"           TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updatedAt"           TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "modifier_option_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "modifier_option_group_fk"
        FOREIGN KEY ("modifierGroupId") REFERENCES "modifier_group"("id") ON DELETE CASCADE,
    CONSTRAINT "modifier_option_business_fk"
        FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT
);
CREATE INDEX "modifier_option_modifierGroupId_idx" ON "modifier_option" ("modifierGroupId");
CREATE INDEX "modifier_option_businessId_idx" ON "modifier_option" ("businessId");

-- ─── Catalog item ↔ modifier group (junction) ─────────────────────────────────

CREATE TABLE "catalog_item_modifier_group" (
    "catalogItemId"    UUID    NOT NULL,
    "modifierGroupId"  UUID    NOT NULL,
    "sortOrder"        INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "catalog_item_modifier_group_pkey"
        PRIMARY KEY ("catalogItemId", "modifierGroupId"),
    CONSTRAINT "catalog_item_modifier_group_item_fk"
        FOREIGN KEY ("catalogItemId") REFERENCES "catalog_item"("id") ON DELETE CASCADE,
    CONSTRAINT "catalog_item_modifier_group_group_fk"
        FOREIGN KEY ("modifierGroupId") REFERENCES "modifier_group"("id") ON DELETE CASCADE
);
CREATE INDEX "cimg_modifierGroupId_idx" ON "catalog_item_modifier_group" ("modifierGroupId");

-- ─── Dining area ──────────────────────────────────────────────────────────────

CREATE TABLE "dining_area" (
    "id"          UUID    NOT NULL DEFAULT gen_random_uuid(),
    "businessId"  UUID    NOT NULL,
    "locationId"  UUID    NOT NULL,
    "name"        TEXT    NOT NULL,
    "isActive"    BOOLEAN NOT NULL DEFAULT TRUE,
    "sortOrder"   INTEGER NOT NULL DEFAULT 0,
    "version"     INTEGER NOT NULL DEFAULT 1,
    "createdAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updatedAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "dining_area_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "dining_area_business_fk"
        FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT,
    CONSTRAINT "dining_area_location_fk"
        FOREIGN KEY ("locationId") REFERENCES "location"("id") ON DELETE RESTRICT
);
CREATE INDEX "dining_area_businessId_idx" ON "dining_area" ("businessId");
CREATE INDEX "dining_area_locationId_idx" ON "dining_area" ("locationId");

-- ─── Dining table ─────────────────────────────────────────────────────────────

CREATE TABLE "dining_table" (
    "id"           UUID                NOT NULL DEFAULT gen_random_uuid(),
    "diningAreaId" UUID                NOT NULL,
    "businessId"   UUID                NOT NULL,
    "locationId"   UUID                NOT NULL,
    "code"         TEXT                NOT NULL,
    "capacity"     INTEGER             NOT NULL DEFAULT 4,
    "status"       "DiningTableStatus" NOT NULL DEFAULT 'AVAILABLE',
    "isActive"     BOOLEAN             NOT NULL DEFAULT TRUE,
    "version"      INTEGER             NOT NULL DEFAULT 1,
    "createdAt"    TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updatedAt"    TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "dining_table_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "dining_table_area_fk"
        FOREIGN KEY ("diningAreaId") REFERENCES "dining_area"("id") ON DELETE RESTRICT,
    CONSTRAINT "dining_table_business_fk"
        FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT,
    CONSTRAINT "dining_table_location_fk"
        FOREIGN KEY ("locationId") REFERENCES "location"("id") ON DELETE RESTRICT,
    CONSTRAINT "dining_table_area_code_unique"
        UNIQUE ("diningAreaId", "code")
);
CREATE INDEX "dining_table_businessId_idx" ON "dining_table" ("businessId");
CREATE INDEX "dining_table_diningAreaId_idx" ON "dining_table" ("diningAreaId");

-- ─── Staff profile ────────────────────────────────────────────────────────────

CREATE TABLE "staff_profile" (
    "id"          UUID    NOT NULL DEFAULT gen_random_uuid(),
    "businessId"  UUID    NOT NULL,
    "displayName" TEXT    NOT NULL,
    -- Informal role label (e.g. "waiter", "manager"). Not linked to RBAC Role yet (Phase 8).
    "roleTag"     TEXT    NOT NULL DEFAULT 'staff',
    "isActive"    BOOLEAN NOT NULL DEFAULT TRUE,
    "version"     INTEGER NOT NULL DEFAULT 1,
    "createdAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updatedAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "staff_profile_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "staff_profile_business_fk"
        FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT
);
CREATE INDEX "staff_profile_businessId_idx" ON "staff_profile" ("businessId");

-- ─── Guest ────────────────────────────────────────────────────────────────────

CREATE TABLE "guest" (
    "id"          UUID    NOT NULL DEFAULT gen_random_uuid(),
    "businessId"  UUID    NOT NULL,
    "displayName" TEXT    NOT NULL,
    "phone"       TEXT,
    "notes"       TEXT,
    "tags"        JSONB   NOT NULL DEFAULT '[]',
    "visitCount"  INTEGER NOT NULL DEFAULT 0,
    "lastVisitAt" TIMESTAMPTZ(6),
    "version"     INTEGER NOT NULL DEFAULT 1,
    "createdAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updatedAt"   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "guest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "guest_business_fk"
        FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT
);
CREATE INDEX "guest_businessId_idx" ON "guest" ("businessId");

-- ─── Booking ──────────────────────────────────────────────────────────────────

CREATE TABLE "booking" (
    "id"             UUID            NOT NULL DEFAULT gen_random_uuid(),
    "businessId"     UUID            NOT NULL,
    "locationId"     UUID            NOT NULL,
    -- nullable: table assigned later or walk-in
    "diningTableId"  UUID,
    -- nullable: walk-in (no guest record)
    "guestId"        UUID,
    "partySize"      INTEGER         NOT NULL DEFAULT 2,
    "scheduledAt"    TIMESTAMPTZ(6)  NOT NULL,
    "status"         "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "notes"          TEXT,
    "version"        INTEGER         NOT NULL DEFAULT 1,
    "createdAt"      TIMESTAMPTZ(6)  NOT NULL DEFAULT now(),
    "updatedAt"      TIMESTAMPTZ(6)  NOT NULL DEFAULT now(),

    CONSTRAINT "booking_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "booking_business_fk"
        FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT,
    CONSTRAINT "booking_location_fk"
        FOREIGN KEY ("locationId") REFERENCES "location"("id") ON DELETE RESTRICT,
    CONSTRAINT "booking_table_fk"
        FOREIGN KEY ("diningTableId") REFERENCES "dining_table"("id") ON DELETE SET NULL,
    CONSTRAINT "booking_guest_fk"
        FOREIGN KEY ("guestId") REFERENCES "guest"("id") ON DELETE SET NULL
);
CREATE INDEX "booking_businessId_idx" ON "booking" ("businessId");
CREATE INDEX "booking_locationId_scheduledAt_idx" ON "booking" ("locationId", "scheduledAt");
