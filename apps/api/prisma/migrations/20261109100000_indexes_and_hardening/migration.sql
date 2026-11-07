CREATE INDEX IF NOT EXISTS "registration_payment_registrationId_status_idx" ON "registration_payment"("registrationId", "status");
CREATE INDEX IF NOT EXISTS "registration_provisioning_status_idx" ON "registration_provisioning"("status");
CREATE INDEX IF NOT EXISTS "registration_subscription_status_idx" ON "registration_subscription"("status");
