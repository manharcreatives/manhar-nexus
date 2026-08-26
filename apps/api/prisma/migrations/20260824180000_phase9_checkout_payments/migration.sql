-- Phase 9: Checkout & Payments
-- Manual migration (bypasses shadow database ordering issue from earlier migrations).
-- Applied via: prisma db execute --file ... --url $DATABASE_URL
-- Then resolved: prisma migrate resolve --applied 20260824180000_phase9_checkout_payments

-- Enums
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'FINALISED', 'PAID', 'VOIDED');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CAPTURED', 'FAILED', 'CANCELLED');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'UPI', 'CARD', 'OTHER');
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

-- Invoice
CREATE TABLE "invoice" (
  "id"                    UUID        NOT NULL DEFAULT gen_random_uuid(),
  "businessId"            UUID        NOT NULL,
  "locationId"            UUID        NOT NULL,
  "sessionId"             UUID,
  "invoiceNumber"         TEXT,
  "status"                "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "currencyCode"          TEXT        NOT NULL DEFAULT 'INR',
  "subtotalMinorUnits"    INTEGER     NOT NULL,
  "totalTaxMinorUnits"    INTEGER     NOT NULL,
  "grandTotalMinorUnits"  INTEGER     NOT NULL,
  "roundingMinorUnits"    INTEGER     NOT NULL DEFAULT 0,
  "taxBreakdown"          JSONB       NOT NULL DEFAULT '[]',
  "notes"                 TEXT,
  "voidReason"            TEXT,
  "version"               INTEGER     NOT NULL DEFAULT 1,
  "createdAt"             TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updatedAt"             TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "finalisedAt"           TIMESTAMPTZ(6),
  "paidAt"                TIMESTAMPTZ(6),
  "voidedAt"              TIMESTAMPTZ(6),
  CONSTRAINT "invoice_pkey" PRIMARY KEY ("id")
);

-- At most one active (non-voided) invoice per session (DB-level guard)
CREATE UNIQUE INDEX "invoice_session_active_unique"
  ON "invoice"("sessionId")
  WHERE "status" IN ('DRAFT', 'FINALISED', 'PAID');

-- InvoiceLine
CREATE TABLE "invoice_line" (
  "id"                      UUID        NOT NULL DEFAULT gen_random_uuid(),
  "invoiceId"               UUID        NOT NULL,
  "businessId"              UUID        NOT NULL,
  "serviceRequestLineId"    UUID,
  "itemNameSnapshot"        TEXT        NOT NULL,
  "variantNameSnapshot"     TEXT,
  "modifiersSummary"        TEXT,
  "quantity"                INTEGER     NOT NULL,
  "unitPriceMinorUnits"     INTEGER     NOT NULL,
  "modifiersMinorUnits"     INTEGER     NOT NULL DEFAULT 0,
  "taxRateSnapshot"         DECIMAL(6,4) NOT NULL,
  "taxCategoryName"         TEXT,
  "lineSubtotalMinorUnits"  INTEGER     NOT NULL,
  "lineTaxMinorUnits"       INTEGER     NOT NULL,
  "lineTotalMinorUnits"     INTEGER     NOT NULL,
  CONSTRAINT "invoice_line_pkey" PRIMARY KEY ("id")
);

-- Payment
CREATE TABLE "payment" (
  "id"                      UUID        NOT NULL DEFAULT gen_random_uuid(),
  "businessId"              UUID        NOT NULL,
  "locationId"              UUID        NOT NULL,
  "invoiceId"               UUID        NOT NULL,
  "idempotencyKey"          UUID        NOT NULL,
  "method"                  "PaymentMethod" NOT NULL,
  "status"                  "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "amountMinorUnits"        INTEGER     NOT NULL,
  "currencyCode"            TEXT        NOT NULL DEFAULT 'INR',
  "cashReceivedMinorUnits"  INTEGER,
  "changeMinorUnits"        INTEGER,
  "referenceCode"           TEXT,
  "providerOrderId"         TEXT,
  "providerTransactionId"   TEXT,
  "notes"                   TEXT,
  "failureReason"           TEXT,
  "version"                 INTEGER     NOT NULL DEFAULT 1,
  "createdAt"               TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updatedAt"               TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "capturedAt"              TIMESTAMPTZ(6),
  "failedAt"                TIMESTAMPTZ(6),
  "cancelledAt"             TIMESTAMPTZ(6),
  CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- Refund
CREATE TABLE "refund" (
  "id"                UUID        NOT NULL DEFAULT gen_random_uuid(),
  "businessId"        UUID        NOT NULL,
  "paymentId"         UUID        NOT NULL,
  "reason"            TEXT        NOT NULL,
  "amountMinorUnits"  INTEGER     NOT NULL,
  "status"            "RefundStatus" NOT NULL DEFAULT 'PENDING',
  "notes"             TEXT,
  "providerRefundId"  TEXT,
  "version"           INTEGER     NOT NULL DEFAULT 1,
  "createdAt"         TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "updatedAt"         TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  "processedAt"       TIMESTAMPTZ(6),
  "failedAt"          TIMESTAMPTZ(6),
  CONSTRAINT "refund_pkey" PRIMARY KEY ("id")
);

-- Foreign keys: invoice
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "guest_session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: invoice_line
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_line" ADD CONSTRAINT "invoice_line_serviceRequestLineId_fkey"
  FOREIGN KEY ("serviceRequestLineId") REFERENCES "service_request_line"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys: payment
ALTER TABLE "payment" ADD CONSTRAINT "payment_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment" ADD CONSTRAINT "payment_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment" ADD CONSTRAINT "payment_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign keys: refund
ALTER TABLE "refund" ADD CONSTRAINT "refund_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refund" ADD CONSTRAINT "refund_paymentId_fkey"
  FOREIGN KEY ("paymentId") REFERENCES "payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Indexes: invoice
CREATE INDEX "invoice_businessId_idx"       ON "invoice"("businessId");
CREATE INDEX "invoice_locationId_status_idx" ON "invoice"("locationId", "status");
CREATE INDEX "invoice_sessionId_idx"         ON "invoice"("sessionId");

-- Indexes: invoice_line
CREATE INDEX "invoice_line_invoiceId_idx"  ON "invoice_line"("invoiceId");
CREATE INDEX "invoice_line_businessId_idx" ON "invoice_line"("businessId");

-- Indexes: payment
CREATE UNIQUE INDEX "payment_businessId_idempotencyKey_key" ON "payment"("businessId", "idempotencyKey");
CREATE INDEX "payment_businessId_idx" ON "payment"("businessId");
CREATE INDEX "payment_invoiceId_idx"  ON "payment"("invoiceId");

-- Indexes: refund
CREATE INDEX "refund_businessId_idx" ON "refund"("businessId");
CREATE INDEX "refund_paymentId_idx"  ON "refund"("paymentId");
