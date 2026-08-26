-- Phase 11 — Reports / Alerts / Audit
-- AlertNotification: in-app notification delivery per user.
-- Performance indexes: report queries on invoice/payment/audit_event tables.

-- ─── alert_notification ─────────────────────────────────────────────────────

CREATE TABLE "alert_notification" (
  "id"           UUID        NOT NULL DEFAULT gen_random_uuid(),
  "businessId"   UUID        NOT NULL,
  "userId"       UUID        NOT NULL,
  "alertRuleId"  UUID,
  "eventKey"     TEXT        NOT NULL,
  "title"        TEXT        NOT NULL,
  "body"         TEXT        NOT NULL,
  "resourceUrl"  TEXT,
  "isRead"       BOOLEAN     NOT NULL DEFAULT false,
  "readAt"       TIMESTAMPTZ(6),
  "createdAt"    TIMESTAMPTZ(6) NOT NULL DEFAULT NOW(),
  CONSTRAINT "alert_notification_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "alert_notification"
  ADD CONSTRAINT "alert_notification_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "business"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "alert_notification"
  ADD CONSTRAINT "alert_notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "app_user"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "alert_notification"
  ADD CONSTRAINT "alert_notification_alertRuleId_fkey"
  FOREIGN KEY ("alertRuleId") REFERENCES "alert_rule"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Fast unread lookup per user
CREATE INDEX "alert_notification_bus_user_read_ts_idx"
  ON "alert_notification"("businessId", "userId", "isRead", "createdAt" DESC);

-- Full history lookup per user (newest first)
CREATE INDEX "alert_notification_bus_user_ts_idx"
  ON "alert_notification"("businessId", "userId", "createdAt" DESC);

-- ─── Report performance indexes ──────────────────────────────────────────────
-- Note: Prisma uses camelCase column names (no @map on these models).

-- Daily closing: PAID invoices by business + paidAt
CREATE INDEX IF NOT EXISTS "invoice_businessId_paidAt_idx"
  ON "invoice"("businessId", "paidAt");

-- Voided invoice count by date
CREATE INDEX IF NOT EXISTS "invoice_businessId_voidedAt_idx"
  ON "invoice"("businessId", "voidedAt");

-- Payment breakdown by captured date
CREATE INDEX IF NOT EXISTS "payment_businessId_capturedAt_idx"
  ON "payment"("businessId", "capturedAt");

-- ─── Audit query indexes ──────────────────────────────────────────────────────

-- Filter by action (audit search)
CREATE INDEX IF NOT EXISTS "audit_event_businessId_action_idx"
  ON "audit_event"("businessId", action);

-- Filter by resourceType (audit search)
CREATE INDEX IF NOT EXISTS "audit_event_businessId_resourceType_idx"
  ON "audit_event"("businessId", "resourceType");
