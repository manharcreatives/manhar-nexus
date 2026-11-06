-- The payer secret now belongs to the registration (minted when the form is submitted), not to a payment link.
-- registration_payment."payerSecretHash" stays in place but is no longer written or read.
ALTER TABLE "registration_request" ADD COLUMN "payerSecretHash" TEXT, ADD COLUMN "payLockedAt" TIMESTAMPTZ(6);
