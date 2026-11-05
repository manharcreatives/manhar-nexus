-- Cashfree payment links created by Manhar staff for registration requests (owner subscription payments).
-- Additive only: one new table, its indexes and one foreign key. Nothing existing is altered.

-- CreateTable
CREATE TABLE "registration_payment" (
    "id" UUID NOT NULL,
    "registrationId" UUID NOT NULL,
    "linkId" TEXT NOT NULL,
    "cfLinkId" TEXT,
    "linkUrl" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "purpose" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "paidAmountPaise" INTEGER,
    "providerOrderId" TEXT,
    "expiresAt" TIMESTAMPTZ(6),
    "paidAt" TIMESTAMPTZ(6),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "registration_payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "registration_payment_linkId_key" ON "registration_payment"("linkId");

-- CreateIndex
CREATE INDEX "registration_payment_registrationId_createdAt_idx" ON "registration_payment"("registrationId", "createdAt");

-- AddForeignKey
ALTER TABLE "registration_payment" ADD CONSTRAINT "registration_payment_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "registration_request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
