-- Phase 13 — Onboarding / Deployment
-- Adds OnboardingProgress per-business milestone tracking.
-- completedSteps is a TEXT[] array of OnboardingStep values.
-- SAFE: additive only, no column drops, no data modification.

CREATE TABLE "onboarding_progress" (
  "id"             UUID        NOT NULL DEFAULT gen_random_uuid(),
  "businessId"     UUID        NOT NULL,
  "completedSteps" TEXT[]      NOT NULL DEFAULT '{}',
  "currentStep"    TEXT        NOT NULL DEFAULT 'BUSINESS_CREATED',
  "notes"          TEXT,
  "startedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "completedAt"    TIMESTAMPTZ,
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "onboarding_progress_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "onboarding_progress_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "onboarding_progress_businessId_key"
  ON "onboarding_progress"("businessId");

CREATE INDEX "onboarding_progress_currentStep_idx"
  ON "onboarding_progress"("currentStep");
