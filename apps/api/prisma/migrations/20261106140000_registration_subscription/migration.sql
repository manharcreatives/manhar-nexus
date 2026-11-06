-- UPI AutoPay mandates and their debits for registration requests.
-- Additive only: two new tables, their indexes and foreign keys. Nothing existing is altered.

-- CreateTable
CREATE TABLE "registration_subscription" (
    "id" UUID NOT NULL,
    "registrationId" UUID NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "cfSubscriptionId" TEXT,
    "authToken" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INITIALIZED',
    "planKey" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "quote" JSONB NOT NULL,
    "firstChargeAt" TIMESTAMPTZ(6),
    "activatedAt" TIMESTAMPTZ(6),
    "cancelledAt" TIMESTAMPTZ(6),
    "lastChargeStatus" TEXT,
    "lastChargeAt" TIMESTAMPTZ(6),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "registration_subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_subscription_charge" (
    "id" UUID NOT NULL,
    "subscriptionRowId" UUID NOT NULL,
    "cfPaymentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "failureReason" TEXT,
    "occurredAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_subscription_charge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "registration_subscription_subscriptionId_key" ON "registration_subscription"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "registration_subscription_authToken_key" ON "registration_subscription"("authToken");

-- CreateIndex
CREATE INDEX "registration_subscription_registrationId_createdAt_idx" ON "registration_subscription"("registrationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "registration_subscription_charge_cfPaymentId_key" ON "registration_subscription_charge"("cfPaymentId");

-- CreateIndex
CREATE INDEX "registration_subscription_charge_subscriptionRowId_occurredAt_idx" ON "registration_subscription_charge"("subscriptionRowId", "occurredAt");

-- AddForeignKey
ALTER TABLE "registration_subscription" ADD CONSTRAINT "registration_subscription_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "registration_request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_subscription_charge" ADD CONSTRAINT "registration_subscription_charge_subscriptionRowId_fkey" FOREIGN KEY ("subscriptionRowId") REFERENCES "registration_subscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
