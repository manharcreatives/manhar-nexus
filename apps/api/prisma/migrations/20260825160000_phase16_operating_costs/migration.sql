-- Phase 16: Operating Costs module (ADR-030)
-- Standalone module: expense categories (per-business) + expenses (per-location).
-- Approval workflow: category.requiresApproval gates PENDING_APPROVAL → APPROVED/REJECTED.

CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED');

-- Expense categories: per-business classification (rent, utilities, wages, …)
CREATE TABLE "expense_category" (
    "id"               UUID        NOT NULL DEFAULT gen_random_uuid(),
    "businessId"       UUID        NOT NULL,
    "name"             TEXT        NOT NULL,
    "description"      TEXT,
    "requiresApproval" BOOLEAN     NOT NULL DEFAULT false,
    "isActive"         BOOLEAN     NOT NULL DEFAULT true,
    "sortOrder"        INTEGER     NOT NULL DEFAULT 0,
    "version"          INTEGER     NOT NULL DEFAULT 1,
    "createdAt"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "expense_category_pkey" PRIMARY KEY ("id")
);

-- Expenses: per-location operating expense records
-- Amount in minor currency units (paise for INR, per ADR-015).
-- idempotencyKey prevents duplicate submissions from the UI (per ADR-017).
CREATE TABLE "expense" (
    "id"                UUID            NOT NULL DEFAULT gen_random_uuid(),
    "businessId"        UUID            NOT NULL,
    "locationId"        UUID            NOT NULL,
    "expenseCategoryId" UUID            NOT NULL,
    "amountMinorUnits"  INTEGER         NOT NULL,
    "paidAt"            TIMESTAMPTZ(6)  NOT NULL,
    "description"       TEXT,
    "vendorName"        TEXT,
    "status"            "ExpenseStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "approvedById"      UUID,
    "approvedAt"        TIMESTAMPTZ(6),
    "rejectionReason"   TEXT,
    "isRecurring"       BOOLEAN         NOT NULL DEFAULT false,
    "recurringNote"     TEXT,
    "idempotencyKey"    UUID            NOT NULL,
    "createdById"       UUID,
    "version"           INTEGER         NOT NULL DEFAULT 1,
    "createdAt"         TIMESTAMPTZ(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMPTZ(6)  NOT NULL,

    CONSTRAINT "expense_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
ALTER TABLE "expense_category" ADD CONSTRAINT "expense_category_businessId_name_key"
    UNIQUE ("businessId", "name");

ALTER TABLE "expense" ADD CONSTRAINT "expense_idempotencyKey_key"
    UNIQUE ("idempotencyKey");

-- Indexes
CREATE INDEX "expense_category_businessId_idx" ON "expense_category"("businessId");
CREATE INDEX "expense_businessId_idx" ON "expense"("businessId");
CREATE INDEX "expense_businessId_locationId_idx" ON "expense"("businessId", "locationId");
CREATE INDEX "expense_businessId_paidAt_idx" ON "expense"("businessId", "paidAt");

-- Foreign keys
ALTER TABLE "expense_category" ADD CONSTRAINT "expense_category_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "expense" ADD CONSTRAINT "expense_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "expense" ADD CONSTRAINT "expense_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "expense" ADD CONSTRAINT "expense_expenseCategoryId_fkey"
    FOREIGN KEY ("expenseCategoryId") REFERENCES "expense_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "expense" ADD CONSTRAINT "expense_approvedById_fkey"
    FOREIGN KEY ("approvedById") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "expense" ADD CONSTRAINT "expense_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
