ALTER TABLE "business" ADD COLUMN "planKey" TEXT, ADD COLUMN "billingCycle" TEXT, ADD COLUMN "paidUntil" TIMESTAMPTZ(6), ADD COLUMN "billingSource" TEXT, ADD COLUMN "registrationId" UUID, ADD COLUMN "subscriptionId" TEXT;
CREATE UNIQUE INDEX "business_registrationId_key" ON "business"("registrationId");
ALTER TABLE "registration_payment" ADD COLUMN "payerSecretHash" TEXT;
CREATE TABLE "credential_token" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "registrationId" UUID,
  "businessId" UUID,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "usedAt" TIMESTAMPTZ(6),
  "revokedAt" TIMESTAMPTZ(6),
  "issuedBy" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "credential_token_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "credential_token_tokenHash_key" ON "credential_token"("tokenHash");
CREATE INDEX "credential_token_userId_createdAt_idx" ON "credential_token"("userId", "createdAt");
