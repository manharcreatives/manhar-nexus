-- CreateEnum
CREATE TYPE "BusinessStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "LocationStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('INTERNAL_ADMIN', 'USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "SettingValueType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON');

-- CreateTable
CREATE TABLE "business_type" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "business_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "businessTypeId" UUID NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'INR',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "status" "BusinessStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "timezone" TEXT,
    "status" "LocationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setting" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "locationId" UUID,
    "namespace" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "valueType" "SettingValueType" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_event" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "sequence" BIGINT NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorId" TEXT,
    "actorLabel" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "locationId" UUID,
    "metadata" JSONB NOT NULL,
    "prevHash" TEXT,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "numbering_series" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "locationId" UUID,
    "key" TEXT NOT NULL,
    "prefix" TEXT,
    "nextValue" BIGINT NOT NULL DEFAULT 1,
    "padding" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "numbering_series_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_type_key_key" ON "business_type"("key");

-- CreateIndex
CREATE INDEX "business_businessTypeId_idx" ON "business"("businessTypeId");

-- CreateIndex
CREATE INDEX "location_businessId_idx" ON "location"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "location_businessId_code_key" ON "location"("businessId", "code");

-- CreateIndex
CREATE INDEX "setting_businessId_idx" ON "setting"("businessId");

-- CreateIndex
CREATE INDEX "setting_businessId_locationId_namespace_idx" ON "setting"("businessId", "locationId", "namespace");

-- CreateIndex
CREATE INDEX "audit_event_businessId_createdAt_idx" ON "audit_event"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_event_businessId_resourceType_resourceId_idx" ON "audit_event"("businessId", "resourceType", "resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "audit_event_businessId_sequence_key" ON "audit_event"("businessId", "sequence");

-- CreateIndex
CREATE INDEX "numbering_series_businessId_idx" ON "numbering_series"("businessId");

-- AddForeignKey
ALTER TABLE "business" ADD CONSTRAINT "business_businessTypeId_fkey" FOREIGN KEY ("businessTypeId") REFERENCES "business_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location" ADD CONSTRAINT "location_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setting" ADD CONSTRAINT "setting_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "setting" ADD CONSTRAINT "setting_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "numbering_series" ADD CONSTRAINT "numbering_series_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Partial unique indexes for scoped uniqueness (Prisma cannot express NULL-aware
-- partial uniqueness). A setting/series is unique per (business, key) at business
-- scope (location NULL) and per (business, location, key) at location scope.

-- CreateIndex
CREATE UNIQUE INDEX "setting_business_scope_key" ON "setting"("businessId", "namespace", "key") WHERE "locationId" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "setting_location_scope_key" ON "setting"("businessId", "locationId", "namespace", "key") WHERE "locationId" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "numbering_series_business_scope_key" ON "numbering_series"("businessId", "key") WHERE "locationId" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "numbering_series_location_scope_key" ON "numbering_series"("businessId", "locationId", "key") WHERE "locationId" IS NOT NULL;
