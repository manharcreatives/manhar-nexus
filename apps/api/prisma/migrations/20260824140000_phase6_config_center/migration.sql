-- Phase 6: Configuration Center
-- Adds alert_rule table for per-business event notification rules.
-- Attachment/file service is deferred (blocked by BLOCKER-B01: no local MinIO).

-- Alert channel enum (IN_APP only for Phase 6; EMAIL/SMS arrive in Phase 11).
CREATE TYPE "AlertChannel" AS ENUM ('IN_APP');

-- Alert rules: each rule maps one event to one role for one delivery channel.
-- Multiple rules can target the same event (fan-out).
CREATE TABLE "alert_rule" (
    "id"           UUID NOT NULL DEFAULT gen_random_uuid(),
    "business_id"  UUID NOT NULL,
    "event_key"    TEXT NOT NULL,          -- e.g. "order.completed"
    "target_role_key" TEXT NOT NULL,       -- role key, e.g. "owner", "manager"
    "channel"      "AlertChannel" NOT NULL DEFAULT 'IN_APP',
    "enabled"      BOOLEAN NOT NULL DEFAULT TRUE,
    "version"      INTEGER NOT NULL DEFAULT 1,
    "created_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "updated_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),

    CONSTRAINT "alert_rule_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "alert_rule_business_fk" FOREIGN KEY ("business_id")
        REFERENCES "business"("id") ON DELETE RESTRICT,
    CONSTRAINT "alert_rule_business_event_role_channel_unique"
        UNIQUE ("business_id", "event_key", "target_role_key", "channel")
);

CREATE INDEX "alert_rule_business_id_idx" ON "alert_rule" ("business_id");
CREATE INDEX "alert_rule_business_event_idx" ON "alert_rule" ("business_id", "event_key");
