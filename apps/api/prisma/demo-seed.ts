/**
 * Demo/Pilot Seed — Manhar Nexus
 *
 * Creates a complete synthetic restaurant ready for demonstration or pilot testing.
 * Guards:
 *   - Requires NEXUS_DEMO_SEED=true (never runs in production accidentally)
 *   - Idempotent: safe to re-run (upsert on unique keys / skip-if-exists)
 *   - Never modifies existing non-demo records
 *
 * Data created (all clearly synthetic):
 *   Business:  "The Pilot Kitchen"
 *   Location:  "Main Location"
 *   Modules:   restaurant, catalog, checkout, costs (all ACTIVE)
 *   Users:     demo.owner / demo.cashier / demo.kitchen / demo.waiter
 *   Catalog:   3 tax categories, 4 menu categories, 12 menu items
 *   Dining:    2 areas (Main Hall, Outdoor), 6 tables (T1–T6)
 *   Expenses:  4 expense categories (Rent, Utilities, Wages, Supplies)
 *
 * Usage:
 *   NEXUS_DEMO_SEED=true npx ts-node -P tsconfig.json -r tsconfig-paths/register prisma/demo-seed.ts
 *
 * Or via npm script:
 *   npm run demo:seed -w @nexus/api
 */
/* eslint-disable no-console -- CLI script; console output is intended */
import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';
import { Algorithm, hash } from '@node-rs/argon2';

if (process.env.NEXUS_DEMO_SEED !== 'true') {
  console.error('[demo-seed] Aborted: NEXUS_DEMO_SEED must be "true" to run this script.');
  console.error('[demo-seed] Set NEXUS_DEMO_SEED=true in your environment to proceed.');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  console.error('[demo-seed] Aborted: demo seed MUST NOT run in production (NODE_ENV=production detected).');
  process.exit(1);
}

const prisma = new PrismaClient();

// ── Argon2id params (same as main seed) ───────────────────────────────────────
async function hashPassword(password: string): Promise<string> {
  return hash(password, { algorithm: Algorithm.Argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

// ── Timestamps ────────────────────────────────────────────────────────────────
const NOW = new Date();

// ── Demo business identity ─────────────────────────────────────────────────────
const DEMO_BUSINESS_NAME = 'The Pilot Kitchen';
const DEMO_LOCATION_NAME = 'Main Location';

// ── Demo credentials (clearly synthetic) ─────────────────────────────────────
const DEMO_USERS = [
  { email: 'demo.owner@pilot.nexus', displayName: 'Demo Owner', password: 'PilotOwner@2024', roleKey: 'owner' },
  { email: 'demo.cashier@pilot.nexus', displayName: 'Demo Cashier', password: 'PilotCash@2024', roleKey: 'checkout-associate' },
  { email: 'demo.kitchen@pilot.nexus', displayName: 'Demo Kitchen', password: 'PilotKitchen@2024', roleKey: 'kitchen-team' },
  { email: 'demo.waiter@pilot.nexus', displayName: 'Demo Waiter', password: 'PilotWaiter@2024', roleKey: 'service-team' },
];

// ── Tax categories ────────────────────────────────────────────────────────────
const TAX_CATEGORIES = [
  { name: 'GST 5%', description: 'Standard GST for food items', rateMinorUnits: 500 },
  { name: 'GST 12%', description: 'Higher GST for processed items', rateMinorUnits: 1200 },
  { name: 'Exempt', description: 'Tax exempt items', rateMinorUnits: 0 },
];

// ── Menu categories ───────────────────────────────────────────────────────────
const MENU_CATEGORIES = [
  { name: 'Starters', description: 'Appetizers and soups', sortOrder: 10 },
  { name: 'Main Course', description: 'Rice, bread, and curries', sortOrder: 20 },
  { name: 'Beverages', description: 'Hot and cold drinks', sortOrder: 30 },
  { name: 'Desserts', description: 'Sweets and ice creams', sortOrder: 40 },
];

// ── Dining areas ──────────────────────────────────────────────────────────────
const DINING_AREAS = [
  { name: 'Main Hall', sortOrder: 10 },
  { name: 'Outdoor Terrace', sortOrder: 20 },
];

// ── Tables per area ───────────────────────────────────────────────────────────
const TABLES_BY_AREA: Record<string, { code: string; seatingCapacity: number }[]> = {
  'Main Hall': [
    { code: 'T1', seatingCapacity: 2 },
    { code: 'T2', seatingCapacity: 4 },
    { code: 'T3', seatingCapacity: 4 },
    { code: 'T4', seatingCapacity: 6 },
  ],
  'Outdoor Terrace': [
    { code: 'T5', seatingCapacity: 4 },
    { code: 'T6', seatingCapacity: 4 },
  ],
};

// ── Expense categories ────────────────────────────────────────────────────────
const EXPENSE_CATEGORIES = [
  { name: 'Rent', description: 'Monthly premises rent', requiresApproval: true, sortOrder: 10 },
  { name: 'Utilities', description: 'Electricity, water, gas', requiresApproval: false, sortOrder: 20 },
  { name: 'Staff Wages', description: 'Payroll and daily wages', requiresApproval: true, sortOrder: 30 },
  { name: 'Kitchen Supplies', description: 'Ingredients and packaging', requiresApproval: false, sortOrder: 40 },
];

async function main(): Promise<void> {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  Manhar Nexus — Demo Seed                ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('Creating synthetic pilot restaurant...');
  console.log('');

  // ── 1. Business ─────────────────────────────────────────────────────────────
  const restaurantType = await prisma.businessType.findFirst({ where: { key: 'restaurant' } });
  if (!restaurantType) {
    throw new Error('BusinessType "restaurant" not found. Run the main seed first: npm run db:seed');
  }

  let business = await prisma.business.findFirst({ where: { name: DEMO_BUSINESS_NAME } });
  if (!business) {
    business = await prisma.business.create({
      data: {
        name: DEMO_BUSINESS_NAME,
        businessTypeId: restaurantType.id,
        commercialStatus: 'ACTIVE',
      },
    });
    console.log(`[1] Business created: "${DEMO_BUSINESS_NAME}" (${business.id})`);
  } else {
    console.log(`[1] Business exists: "${DEMO_BUSINESS_NAME}" (${business.id})`);
  }
  const businessId = business.id;

  // ── 2. Location ──────────────────────────────────────────────────────────────
  let location = await prisma.location.findFirst({
    where: { businessId, name: DEMO_LOCATION_NAME },
  });
  if (!location) {
    location = await prisma.location.create({
      data: {
        businessId,
        name: DEMO_LOCATION_NAME,
        timezone: 'Asia/Kolkata',
        isActive: true,
      },
    });
    console.log(`[2] Location created: "${DEMO_LOCATION_NAME}" (${location.id})`);
  } else {
    console.log(`[2] Location exists: "${DEMO_LOCATION_NAME}" (${location.id})`);
  }
  const locationId = location.id;

  // ── 3. Module activations (restaurant → catalog → checkout → costs) ──────────
  const MODULES_TO_ACTIVATE = ['restaurant', 'catalog', 'checkout', 'costs'];
  for (const moduleKey of MODULES_TO_ACTIVATE) {
    await prisma.moduleActivation.upsert({
      where: { businessId_moduleKey: { businessId, moduleKey } },
      update: {},
      create: {
        businessId,
        moduleKey,
        status: 'ACTIVE',
        config: {},
        setupCompletedAt: NOW,
        activatedAt: NOW,
      },
    });
  }
  console.log(`[3] Modules activated: ${MODULES_TO_ACTIVATE.join(', ')}`);

  // ── 4. Users ─────────────────────────────────────────────────────────────────
  for (const def of DEMO_USERS) {
    const existing = await prisma.user.findFirst({ where: { email: def.email } });
    if (existing) {
      console.log(`[4] User exists: ${def.email}`);
      continue;
    }
    const passwordHash = await hashPassword(def.password);
    const user = await prisma.user.create({
      data: {
        realm: 'BUSINESS',
        businessId,
        email: def.email,
        displayName: def.displayName,
        passwordHash,
        status: 'ACTIVE',
      },
    });

    const role = await prisma.role.findFirst({ where: { key: def.roleKey, businessId: null } });
    if (!role) throw new Error(`System role "${def.roleKey}" not found. Run main seed first.`);

    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id,
        businessId,
        allLocations: true,
      },
    });
    console.log(`[4] User created: ${def.email} (role: ${def.roleKey})`);
  }

  // ── 5. Production area (kitchen routing) ─────────────────────────────────────
  let productionArea = await prisma.productionArea.findFirst({
    where: { businessId, name: 'Kitchen' },
  });
  if (!productionArea) {
    productionArea = await prisma.productionArea.create({
      data: { businessId, locationId, name: 'Kitchen', isActive: true },
    });
    console.log(`[5] Production area created: Kitchen (${productionArea.id})`);
  } else {
    console.log(`[5] Production area exists: Kitchen (${productionArea.id})`);
  }

  // ── 6. Tax categories ────────────────────────────────────────────────────────
  const taxCategoryMap: Record<string, string> = {};
  for (const tc of TAX_CATEGORIES) {
    const existing = await prisma.taxCategory.findFirst({ where: { businessId, name: tc.name } });
    const row = existing ?? await prisma.taxCategory.create({
      data: { businessId, name: tc.name, description: tc.description, rateMinorUnits: tc.rateMinorUnits, isActive: true },
    });
    taxCategoryMap[tc.name] = row.id;
  }
  console.log(`[6] Tax categories: ${Object.keys(taxCategoryMap).join(', ')}`);

  // ── 7. Catalog categories ─────────────────────────────────────────────────────
  const categoryMap: Record<string, string> = {};
  for (const cat of MENU_CATEGORIES) {
    const existing = await prisma.catalogCategory.findFirst({ where: { businessId, name: cat.name } });
    const row = existing ?? await prisma.catalogCategory.create({
      data: { businessId, name: cat.name, description: cat.description, sortOrder: cat.sortOrder, isActive: true },
    });
    categoryMap[cat.name] = row.id;
  }
  console.log(`[7] Menu categories: ${Object.keys(categoryMap).join(', ')}`);

  // ── 8. Menu items ─────────────────────────────────────────────────────────────
  const MENU_ITEMS = [
    // Starters
    { category: 'Starters', name: 'Paneer Tikka', price: 28000, tax: 'GST 5%' },
    { category: 'Starters', name: 'Veg Soup', price: 12000, tax: 'GST 5%' },
    { category: 'Starters', name: 'Spring Rolls', price: 18000, tax: 'GST 5%' },
    // Main Course
    { category: 'Main Course', name: 'Dal Makhani', price: 22000, tax: 'GST 5%' },
    { category: 'Main Course', name: 'Paneer Butter Masala', price: 29000, tax: 'GST 5%' },
    { category: 'Main Course', name: 'Butter Naan', price: 4000, tax: 'GST 5%' },
    { category: 'Main Course', name: 'Jeera Rice', price: 13000, tax: 'GST 5%' },
    // Beverages
    { category: 'Beverages', name: 'Masala Chai', price: 2500, tax: 'Exempt' },
    { category: 'Beverages', name: 'Lassi', price: 9000, tax: 'GST 5%' },
    { category: 'Beverages', name: 'Cold Coffee', price: 11000, tax: 'GST 12%' },
    // Desserts
    { category: 'Desserts', name: 'Gulab Jamun', price: 8000, tax: 'GST 5%' },
    { category: 'Desserts', name: 'Ice Cream Scoop', price: 7000, tax: 'GST 5%' },
  ];

  let itemCount = 0;
  for (const item of MENU_ITEMS) {
    const existing = await prisma.catalogItem.findFirst({
      where: { businessId, name: item.name },
    });
    if (!existing) {
      await prisma.catalogItem.create({
        data: {
          businessId,
          categoryId: categoryMap[item.category],
          taxCategoryId: taxCategoryMap[item.tax],
          productionAreaId: productionArea.id,
          name: item.name,
          basePriceMinorUnits: item.price,
          isAvailable: true,
          isActive: true,
        },
      });
      itemCount++;
    }
  }
  console.log(`[8] Menu items: ${itemCount} created (${MENU_ITEMS.length - itemCount} already existed)`);

  // ── 9. Dining areas and tables ────────────────────────────────────────────────
  for (const areaDef of DINING_AREAS) {
    let area = await prisma.diningArea.findFirst({ where: { businessId, name: areaDef.name } });
    if (!area) {
      area = await prisma.diningArea.create({
        data: { businessId, locationId, name: areaDef.name, sortOrder: areaDef.sortOrder, isActive: true },
      });
    }

    const tables = TABLES_BY_AREA[areaDef.name] ?? [];
    for (const tableDef of tables) {
      const existing = await prisma.diningTable.findFirst({ where: { businessId, code: tableDef.code } });
      if (!existing) {
        await prisma.diningTable.create({
          data: {
            businessId,
            locationId,
            areaId: area.id,
            code: tableDef.code,
            seatingCapacity: tableDef.seatingCapacity,
            status: 'AVAILABLE',
          },
        });
      }
    }
    const tableCount = (await prisma.diningTable.count({ where: { businessId, areaId: area.id } }));
    console.log(`[9] Area "${areaDef.name}": ${tableCount} tables`);
  }

  // ── 10. Expense categories ────────────────────────────────────────────────────
  for (const ec of EXPENSE_CATEGORIES) {
    const existing = await prisma.expenseCategory.findFirst({ where: { businessId, name: ec.name } });
    if (!existing) {
      await prisma.expenseCategory.create({
        data: { businessId, name: ec.name, description: ec.description, requiresApproval: ec.requiresApproval, sortOrder: ec.sortOrder, isActive: true },
      });
    }
  }
  console.log(`[10] Expense categories: ${EXPENSE_CATEGORIES.map((e) => e.name).join(', ')}`);

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  Demo seed complete!                     ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log('Login credentials (DEMO ONLY — change before real use):');
  for (const u of DEMO_USERS) {
    console.log(`  ${u.email.padEnd(35)} ${u.password}  (${u.roleKey})`);
  }
  console.log('');
  console.log(`Business ID : ${businessId}`);
  console.log(`Location ID : ${locationId}`);
  console.log('');
  console.log('API: http://localhost:3000');
  console.log('Web: http://localhost:5173');
}

main()
  .catch((err) => {
    console.error('[demo-seed] Error:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
