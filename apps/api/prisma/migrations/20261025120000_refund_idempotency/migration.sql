-- Refund idempotency (additive only).
-- Optional client-generated key; uniqueness scoped per business exactly like
-- payment."idempotencyKey". Existing rows keep NULL, and NULLs never collide
-- in a Postgres UNIQUE index, so this is safe on populated tables.

-- AlterTable
ALTER TABLE "refund" ADD COLUMN "idempotencyKey" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "refund_businessId_idempotencyKey_key" ON "refund"("businessId", "idempotencyKey");
