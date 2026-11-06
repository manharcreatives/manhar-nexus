-- Payment links are now priced from the shared plan catalog; keep what they were priced from.
-- Additive only: four nullable/defaulted columns on registration_payment.

-- AlterTable
ALTER TABLE "registration_payment" ADD COLUMN "planKey" TEXT,
ADD COLUMN "billingCycle" TEXT,
ADD COLUMN "quote" JSONB,
ADD COLUMN "source" TEXT NOT NULL DEFAULT 'STAFF';
