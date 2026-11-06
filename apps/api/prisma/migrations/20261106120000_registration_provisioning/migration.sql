-- Resumable "create the restaurant account" job per registration request.
-- Additive only: one new table, one unique index and one foreign key. Nothing existing is altered.

-- CreateTable
CREATE TABLE "registration_provisioning" (
    "id" UUID NOT NULL,
    "registrationId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "completedSteps" TEXT[],
    "currentStep" TEXT,
    "businessId" UUID,
    "input" JSONB NOT NULL,
    "lastError" TEXT,
    "lockedAt" TIMESTAMPTZ(6),
    "startedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "registration_provisioning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "registration_provisioning_registrationId_key" ON "registration_provisioning"("registrationId");

-- AddForeignKey
ALTER TABLE "registration_provisioning" ADD CONSTRAINT "registration_provisioning_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "registration_request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
