-- QR Digital Menu ("Nexus Menu", ADR-035, update round 2 / Q-API). Additive only (ADR-019):
-- 6 enums, 5 new tables, new nullable/defaulted columns on catalog_category, catalog_item and service_request.
-- No existing row is modified except the new column defaults (service_request.source = 'STAFF').
-- Hand-written to match `prisma migrate diff` output (the schema engine could not be downloaded in the authoring
-- sandbox; see docs/landing/reports/14_QAPI_REPORT.md). The partial unique index on waiter_call cannot be expressed in
-- schema.prisma (same situation as the active-invoice index of phase 9) and is therefore SQL-only.

-- CreateEnum
CREATE TYPE "ServiceRequestSource" AS ENUM ('STAFF', 'GUEST');

-- CreateEnum
CREATE TYPE "MenuDietType" AS ENUM ('VEG', 'NONVEG', 'EGG');

-- CreateEnum
CREATE TYPE "QrOrderingMode" AS ENUM ('OFF', 'CONFIRM', 'AUTO');

-- CreateEnum
CREATE TYPE "GuestOrderDecision" AS ENUM ('PENDING', 'CONFIRMED', 'AUTO_CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WaiterCallReason" AS ENUM ('CALL', 'BILL', 'WATER', 'OTHER');

-- CreateEnum
CREATE TYPE "WaiterCallStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED');

-- AlterTable
ALTER TABLE "catalog_category" ADD COLUMN "imageUrl" TEXT,
ADD COLUMN "imageBlur" TEXT,
ADD COLUMN "imageColor" TEXT;

-- AlterTable
ALTER TABLE "catalog_item" ADD COLUMN "imageUrl" TEXT,
ADD COLUMN "imageThumbUrl" TEXT,
ADD COLUMN "imageBlur" TEXT,
ADD COLUMN "imageColor" TEXT,
ADD COLUMN "dietType" "MenuDietType",
ADD COLUMN "menuTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "spiceLevel" INTEGER;

-- AlterTable
ALTER TABLE "service_request" ADD COLUMN "source" "ServiceRequestSource" NOT NULL DEFAULT 'STAFF';

-- CreateTable
CREATE TABLE "table_qr_code" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "diningTableId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "orderingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "rotationCount" INTEGER NOT NULL DEFAULT 0,
    "rotatedAt" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "table_qr_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qr_menu_setting" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "orderingMode" "QrOrderingMode" NOT NULL DEFAULT 'CONFIRM',
    "callWaiter" BOOLEAN NOT NULL DEFAULT true,
    "upiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "tagline" TEXT,
    "accentColor" TEXT,
    "logoUrl" TEXT,
    "logoBlur" TEXT,
    "coverUrl" TEXT,
    "coverBlur" TEXT,
    "coverColor" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "qr_menu_setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_menu_token" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "diningTableId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "displayName" TEXT,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "lastSeenAt" TIMESTAMPTZ(6),
    "revokedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_menu_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_order" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "serviceRequestId" UUID NOT NULL,
    "guestTokenId" UUID,
    "guestName" TEXT,
    "mode" "QrOrderingMode" NOT NULL,
    "decision" "GuestOrderDecision" NOT NULL DEFAULT 'PENDING',
    "requestHash" TEXT NOT NULL,
    "decidedAt" TIMESTAMPTZ(6),
    "decidedByUserId" UUID,
    "decidedByLabel" TEXT,
    "rejectReason" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waiter_call" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "diningTableId" UUID NOT NULL,
    "sessionId" UUID,
    "guestTokenId" UUID,
    "reason" "WaiterCallReason" NOT NULL,
    "status" "WaiterCallStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMPTZ(6),
    "acknowledgedByUserId" UUID,

    CONSTRAINT "waiter_call_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "table_qr_code_diningTableId_key" ON "table_qr_code"("diningTableId");

-- CreateIndex
CREATE UNIQUE INDEX "table_qr_code_token_key" ON "table_qr_code"("token");

-- CreateIndex
CREATE INDEX "table_qr_code_businessId_idx" ON "table_qr_code"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "qr_menu_setting_businessId_key" ON "qr_menu_setting"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "guest_menu_token_tokenHash_key" ON "guest_menu_token"("tokenHash");

-- CreateIndex
CREATE INDEX "guest_menu_token_sessionId_idx" ON "guest_menu_token"("sessionId");

-- CreateIndex
CREATE INDEX "guest_menu_token_businessId_diningTableId_idx" ON "guest_menu_token"("businessId", "diningTableId");

-- CreateIndex
CREATE UNIQUE INDEX "guest_order_serviceRequestId_key" ON "guest_order"("serviceRequestId");

-- CreateIndex
CREATE INDEX "guest_order_businessId_decision_createdAt_idx" ON "guest_order"("businessId", "decision", "createdAt");

-- CreateIndex
CREATE INDEX "guest_order_guestTokenId_createdAt_idx" ON "guest_order"("guestTokenId", "createdAt");

-- CreateIndex
CREATE INDEX "waiter_call_businessId_status_createdAt_idx" ON "waiter_call"("businessId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "waiter_call_diningTableId_status_idx" ON "waiter_call"("diningTableId", "status");

-- At most ONE open call per table and reason: pressing "call waiter" twice cannot flood the staff inbox, even with
-- concurrent requests. SQL-only (Prisma cannot model partial indexes).
CREATE UNIQUE INDEX "waiter_call_open_table_reason_key" ON "waiter_call"("diningTableId", "reason") WHERE "status" = 'OPEN';

-- AddForeignKey
ALTER TABLE "table_qr_code" ADD CONSTRAINT "table_qr_code_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "table_qr_code" ADD CONSTRAINT "table_qr_code_diningTableId_fkey" FOREIGN KEY ("diningTableId") REFERENCES "dining_table"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_menu_setting" ADD CONSTRAINT "qr_menu_setting_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_menu_token" ADD CONSTRAINT "guest_menu_token_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_menu_token" ADD CONSTRAINT "guest_menu_token_diningTableId_fkey" FOREIGN KEY ("diningTableId") REFERENCES "dining_table"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_menu_token" ADD CONSTRAINT "guest_menu_token_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "guest_session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_order" ADD CONSTRAINT "guest_order_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_order" ADD CONSTRAINT "guest_order_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "service_request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_order" ADD CONSTRAINT "guest_order_guestTokenId_fkey" FOREIGN KEY ("guestTokenId") REFERENCES "guest_menu_token"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waiter_call" ADD CONSTRAINT "waiter_call_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waiter_call" ADD CONSTRAINT "waiter_call_diningTableId_fkey" FOREIGN KEY ("diningTableId") REFERENCES "dining_table"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waiter_call" ADD CONSTRAINT "waiter_call_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "guest_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "waiter_call" ADD CONSTRAINT "waiter_call_guestTokenId_fkey" FOREIGN KEY ("guestTokenId") REFERENCES "guest_menu_token"("id") ON DELETE SET NULL ON UPDATE CASCADE;
