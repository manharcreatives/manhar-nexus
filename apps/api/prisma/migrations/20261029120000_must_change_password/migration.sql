-- Forced first-login password change (additive only).
-- A provisioned owner or an admin-reset user carries a temporary password; while
-- this flag is true the API only allows /auth/me, /auth/logout* and /auth/change-password.
-- AlterTable
ALTER TABLE "app_user" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
