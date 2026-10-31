-- Public registration requests (ADR-033). Additive only: one enum, one table, four indexes.
-- Hand-written to match `prisma migrate diff --from-schema-datamodel <previous> --to-schema-datamodel <current> --script`
-- (the schema engine could not be downloaded in the authoring sandbox; see docs/landing/reports/07_API_REPORT.md).
-- No data is read or modified; no existing object is touched.

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'REJECTED', 'SPAM');

-- CreateTable
CREATE TABLE "registration_request" (
    "id" UUID NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'NEW',
    "restaurantName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "businessKind" TEXT NOT NULL,
    "outlets" INTEGER NOT NULL,
    "planKey" TEXT NOT NULL,
    "billingCycle" TEXT NOT NULL,
    "message" TEXT,
    "consentVersion" TEXT NOT NULL,
    "consentAt" TIMESTAMPTZ(6) NOT NULL,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "assignedTo" TEXT,
    "internalNotes" TEXT,
    "businessId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "registration_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "registration_request_referenceCode_key" ON "registration_request"("referenceCode");

-- CreateIndex
CREATE INDEX "registration_request_status_createdAt_idx" ON "registration_request"("status", "createdAt");

-- CreateIndex
CREATE INDEX "registration_request_email_createdAt_idx" ON "registration_request"("email", "createdAt");

-- CreateIndex
CREATE INDEX "registration_request_ipHash_createdAt_idx" ON "registration_request"("ipHash", "createdAt");
