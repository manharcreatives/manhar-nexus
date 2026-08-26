-- CreateEnum
CREATE TYPE "UserRealm" AS ENUM ('PLATFORM', 'BUSINESS');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING');

-- CreateTable
CREATE TABLE "app_user" (
    "id" UUID NOT NULL,
    "realm" "UserRealm" NOT NULL,
    "businessId" UUID,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "displayName" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(6),
    "lastLoginAt" TIMESTAMPTZ(6),
    "staffProfileId" UUID,
    "totpSecret" TEXT,
    "totpEnabledAt" TIMESTAMPTZ(6),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" UUID NOT NULL,
    "businessId" UUID,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permission" (
    "id" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_role" (
    "id" UUID NOT NULL,
    "businessId" UUID,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "allLocations" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_role_location" (
    "userRoleId" UUID NOT NULL,
    "locationId" UUID NOT NULL,

    CONSTRAINT "user_role_location_pkey" PRIMARY KEY ("userRoleId","locationId")
);

-- CreateTable
CREATE TABLE "session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "businessId" UUID,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "deviceId" UUID,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "revokedAt" TIMESTAMPTZ(6),
    "revokedReason" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_token" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "familyId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "issuedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "rotatedTo" UUID,
    "revokedAt" TIMESTAMPTZ(6),

    CONSTRAINT "refresh_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_event" (
    "id" UUID NOT NULL,
    "businessId" UUID,
    "userId" UUID,
    "emailTried" TEXT,
    "outcome" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "app_user_businessId_idx" ON "app_user"("businessId");

-- CreateIndex
CREATE INDEX "app_user_realm_idx" ON "app_user"("realm");

-- CreateIndex
CREATE INDEX "role_businessId_idx" ON "role"("businessId");

-- CreateIndex
CREATE INDEX "role_permission_permissionKey_idx" ON "role_permission"("permissionKey");

-- CreateIndex
CREATE UNIQUE INDEX "role_permission_roleId_permissionKey_key" ON "role_permission"("roleId", "permissionKey");

-- CreateIndex
CREATE INDEX "user_role_userId_idx" ON "user_role"("userId");

-- CreateIndex
CREATE INDEX "user_role_businessId_idx" ON "user_role"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "user_role_userId_roleId_key" ON "user_role"("userId", "roleId");

-- CreateIndex
CREATE INDEX "user_role_location_locationId_idx" ON "user_role_location"("locationId");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "session_revokedAt_idx" ON "session"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_token_tokenHash_key" ON "refresh_token"("tokenHash");

-- CreateIndex
CREATE INDEX "refresh_token_sessionId_idx" ON "refresh_token"("sessionId");

-- CreateIndex
CREATE INDEX "refresh_token_familyId_idx" ON "refresh_token"("familyId");

-- CreateIndex
CREATE INDEX "login_event_userId_createdAt_idx" ON "login_event"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "login_event_createdAt_idx" ON "login_event"("createdAt");

-- AddForeignKey
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role" ADD CONSTRAINT "role_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_location" ADD CONSTRAINT "user_role_location_userRoleId_fkey" FOREIGN KEY ("userRoleId") REFERENCES "user_role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_location" ADD CONSTRAINT "user_role_location_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Realm/businessId coherence: PLATFORM users have no business; BUSINESS users must.
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_realm_business_ck"
  CHECK (("realm" = 'PLATFORM' AND "businessId" IS NULL)
      OR ("realm" = 'BUSINESS' AND "businessId" IS NOT NULL));

-- Email globally unique, case-insensitive (MVP; ADR-022).
CREATE UNIQUE INDEX "app_user_email_uq" ON "app_user" (lower("email"));

-- Role key uniqueness: system roles globally, custom roles per business.
CREATE UNIQUE INDEX "role_system_key_uq" ON "role" ("key") WHERE "businessId" IS NULL;
CREATE UNIQUE INDEX "role_custom_key_uq" ON "role" ("businessId", "key") WHERE "businessId" IS NOT NULL;
