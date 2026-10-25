/**
 * Seed: reference data + IAM bootstrap. Idempotent (safe to re-run).
 *   1. BusinessType catalog (verticals) — Master §1–§3.
 *   2. System roles + their permission grants (Restaurant Module B) — ADR-021.
 *   3. First platform admin user (ADR-022) — replaces the retired shared-token
 *      internal-admin bridge (ADR-020). Credentials come from env.
 * NOT tenant data. The platform user's password is set only on first creation
 * (never reset on re-run, so a rotated password is preserved).
 */
/* eslint-disable no-console -- seed is a CLI script; console output is intended */
import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';
import { Algorithm, hash } from '@node-rs/argon2';
import { SYSTEM_ROLES } from '../src/iam/system-roles.catalog';
import {
  DEV_BOOTSTRAP_EMAIL,
  DEV_BOOTSTRAP_PASSWORD,
  PROD_MIN_BOOTSTRAP_PASSWORD_LENGTH,
} from '../src/config/configuration';

const prisma = new PrismaClient();

const BUSINESS_TYPES = [
  { key: 'restaurant', name: 'Restaurant', description: 'Dine-in restaurants', sortOrder: 10 },
  { key: 'cafe', name: 'Café', description: 'Cafés and coffee shops', sortOrder: 20 },
  { key: 'qsr', name: 'Quick Service (QSR)', description: 'Counter/fast service outlets', sortOrder: 30 },
  { key: 'cloud-kitchen', name: 'Cloud Kitchen', description: 'Delivery-only kitchens', sortOrder: 40 },
  { key: 'hotel', name: 'Hotel', description: 'Hotels and lodging', sortOrder: 50 },
  { key: 'resort', name: 'Resort', description: 'Resorts and hospitality estates', sortOrder: 60 },
  { key: 'banquet', name: 'Banquet', description: 'Banquet and event venues', sortOrder: 70 },
  { key: 'retail', name: 'Retail', description: 'Retail stores', sortOrder: 80 },
  { key: 'manufacturing', name: 'Manufacturing', description: 'Factories and production units', sortOrder: 90 },
  { key: 'service', name: 'Service Business', description: 'Service and field businesses', sortOrder: 100 },
];

async function seedBusinessTypes(): Promise<void> {
  for (const bt of BUSINESS_TYPES) {
    await prisma.businessType.upsert({
      where: { key: bt.key },
      update: { name: bt.name, description: bt.description, sortOrder: bt.sortOrder },
      create: bt,
    });
  }
}

async function seedSystemRoles(): Promise<void> {
  for (const def of SYSTEM_ROLES) {
    // System-role keys use a partial unique index (businessId IS NULL) that
    // Prisma upsert can't target, so find-then-create/update.
    const existing = await prisma.role.findFirst({ where: { key: def.key, businessId: null } });
    const role = existing
      ? await prisma.role.update({
          where: { id: existing.id },
          data: { name: def.name, description: def.description },
        })
      : await prisma.role.create({
          data: { key: def.key, name: def.name, description: def.description, isSystem: true },
        });

    // Replace permission grants so they always match the catalog exactly.
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    for (const permissionKey of def.permissions) {
      await prisma.rolePermission.create({ data: { roleId: role.id, permissionKey } });
    }
  }
}

async function seedPlatformAdmin(): Promise<void> {
  const email = (process.env.PLATFORM_BOOTSTRAP_EMAIL ?? DEV_BOOTSTRAP_EMAIL).toLowerCase();
  const password = process.env.PLATFORM_BOOTSTRAP_PASSWORD ?? DEV_BOOTSTRAP_PASSWORD;

  const existing = await prisma.user.findFirst({ where: { email } });
  if (existing) {
    console.log(`Platform admin already exists (${email}); leaving password untouched.`);
    return;
  }

  // Never create a production platform admin with development credentials.
  if (process.env.NODE_ENV === 'production') {
    if (email === DEV_BOOTSTRAP_EMAIL || password === DEV_BOOTSTRAP_PASSWORD) {
      throw new Error(
        'Refusing to create the platform admin with development bootstrap credentials in production. ' +
          'Set PLATFORM_BOOTSTRAP_EMAIL and PLATFORM_BOOTSTRAP_PASSWORD.',
      );
    }
    if (password.length < PROD_MIN_BOOTSTRAP_PASSWORD_LENGTH) {
      throw new Error(
        `PLATFORM_BOOTSTRAP_PASSWORD must be at least ${PROD_MIN_BOOTSTRAP_PASSWORD_LENGTH} characters in production.`,
      );
    }
  }

  const passwordHash = await hash(password, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  const user = await prisma.user.create({
    data: {
      realm: 'PLATFORM',
      businessId: null,
      email,
      passwordHash,
      displayName: 'Platform Admin',
      status: 'ACTIVE',
    },
  });
  const role = await prisma.role.findFirst({ where: { key: 'platform-admin', businessId: null } });
  if (!role) throw new Error('platform-admin role missing — seed roles first');
  await prisma.userRole.create({
    data: { userId: user.id, roleId: role.id, businessId: null, allLocations: true },
  });
  console.log(`Created platform admin: ${email}`);
}

async function main(): Promise<void> {
  await seedBusinessTypes();
  await seedSystemRoles();
  await seedPlatformAdmin();
  const [types, roles, users] = await Promise.all([
    prisma.businessType.count(),
    prisma.role.count({ where: { isSystem: true } }),
    prisma.user.count(),
  ]);
  console.log(`Seed complete: ${types} business types, ${roles} system roles, ${users} user(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
