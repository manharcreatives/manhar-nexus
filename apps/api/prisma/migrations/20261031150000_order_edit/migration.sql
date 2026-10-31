-- Order edit before the kitchen starts (update round 2, S2). Additive only.
-- Hand-written to match `prisma migrate diff` output (schema engine unavailable in the authoring sandbox).
-- No existing row is modified except default column values on service_request / service_request_line.

-- AlterTable
ALTER TABLE "service_request" ADD COLUMN "editCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastEditedAt" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "service_request_line" ADD COLUMN "editedAt" TIMESTAMPTZ(6),
ADD COLUMN "editKind" TEXT;

-- CreateTable
CREATE TABLE "service_request_edit" (
    "id" UUID NOT NULL,
    "businessId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "serviceRequestId" UUID NOT NULL,
    "idempotencyKey" UUID NOT NULL,
    "editNumber" INTEGER NOT NULL,
    "fromVersion" INTEGER NOT NULL,
    "toVersion" INTEGER NOT NULL,
    "statusAtEdit" "ServiceRequestStatus" NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorId" TEXT,
    "actorLabel" TEXT,
    "reason" TEXT,
    "changes" JSONB NOT NULL,
    "totalBeforeMinorUnits" INTEGER NOT NULL,
    "totalAfterMinorUnits" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_request_edit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_request_edit_businessId_idempotencyKey_key" ON "service_request_edit"("businessId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "service_request_edit_serviceRequestId_editNumber_key" ON "service_request_edit"("serviceRequestId", "editNumber");

-- CreateIndex
CREATE INDEX "service_request_edit_businessId_serviceRequestId_idx" ON "service_request_edit"("businessId", "serviceRequestId");

-- AddForeignKey
ALTER TABLE "service_request_edit" ADD CONSTRAINT "service_request_edit_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "service_request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
