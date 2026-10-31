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
 *   Modules:   restaurant, catalog, checkout, reports, costs (all ACTIVE)
 *   Users:     demo.owner / demo.cashier / demo.kitchen / demo.waiter
 *   Catalog:   3 tax categories, 4 menu categories, 12 menu items
 *   Dining:    2 areas (Main Hall, Outdoor), 6 tables (T1–T6)
 *   Expenses:  4 expense categories (Rent, Utilities, Wages, Supplies)
 *   Location 2: "Riverside" (Asia/Kolkata) - areas River View (R1-R4) and
 *              Garden (G1-G3); invoice series "RV-0001...", tickets "RV-K001..."
 *   History:   14 days (today included, up to "now") of closed table visits per
 *              location - lunch/dinner peaks, variants & modifiers, CASH (with
 *              change) and UPI (with reference), 3 partial cash refunds, 1
 *              voided-and-reissued bill - see prisma/demo/history.ts
 *   Expenses:  2 weeks per location: approved, pending, and 1 rejected
 *   Live:      3 tables (2 Riverside, 1 Main) occupied with kitchen tickets at
 *              SENT / ACCEPTED / PREPARING / READY: seated 12-50 min ago, tickets
 *              3-14 min old - always relative to the moment the seed runs.
 *              SELF-HEALING: on every run, (1) any live-scenario session from an
 *              earlier run (GuestSession.notes = 'demo:live-scenario') and (2)
 *              any other session OPEN for more than 6 hours is closed through the
 *              real services (cancel/serve rounds, void unpaid bill, close or
 *              void the session, reset the table - audited, never deleted), then
 *              the scenario is recreated. Open sessions younger than 6h that are
 *              not live-scenario sessions are left alone.
 *              See prisma/demo/live.ts
 *
 * Location access: all four demo users hold allLocations=true role grants, so
 * every demo user (owner, cashier, kitchen, waiter) can switch between
 * "Main Location" and "Riverside". Restricting a user to one location is done
 * per role grant (UserRole.allLocations=false + UserRoleLocation rows).
 *
 * Idempotency of history: every history row id is a UUID derived from a stable
 * key (location/date/bill index), so re-runs insert only what is missing.
 * Audit: history writes NO audit rows (services always stamp "now"); actions
 * performed at seed time go through the real services and are chain-appended.
 * The audit chain is re-verified at the end of every run.
 *
 * --reset-demo-history is deliberately NOT supported: history consists of
 * finalised, numbered invoices; deleting them would leave permanent gaps in
 * the gapless invoice series (ADR-016) that cannot be rewound.
 *
 * Usage:
 *   NEXUS_DEMO_SEED=true npx ts-node -P tsconfig.json -r tsconfig-paths/register prisma/demo-seed.ts
 *
 * Or via npm script:
 *   npm run demo:seed -w @nexus/api
 */
/* eslint-disable no-console -- CLI script; console output is intended */
import 'reflect-metadata';
import { Algorithm, hash } from '@node-rs/argon2';
import { PrismaService } from '../src/prisma/prisma.service';
import { loadCatalog, seedHistory, type DemoLocation } from './demo/history';
import { seedExpenses } from './demo/expenses';
import { seedQrMenu } from './demo/qr-menu';
import { buildServices, closePaidOpenSessions, ensureSeries, openLiveTables, retireStaleSessions, userScope } from './demo/live';

if (process.env.NEXUS_DEMO_SEED !== 'true') {
  console.error('[demo-seed] Aborted: NEXUS_DEMO_SEED must be "true" to run this script.');
  console.error('[demo-seed] Set NEXUS_DEMO_SEED=true in your environment to proceed.');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  console.error('[demo-seed] Aborted: demo seed MUST NOT run in production (NODE_ENV=production detected).');
  process.exit(1);
}

if (process.argv.includes('--reset-demo-history')) {
  console.error('[demo-seed] --reset-demo-history is not supported: demo history contains finalised,');
  console.error('[demo-seed] numbered invoices and deleting them would leave gaps in the gapless invoice');
  console.error('[demo-seed] series (ADR-016). History is idempotent - re-running only adds missing bills.');
  process.exit(1);
}

// PrismaService is a plain PrismaClient subclass; using it lets the real
// services (AuditService, SessionService, ...) share this connection.
const prisma = new PrismaService();

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

// ── Second location ───────────────────────────────────────────────────────────
const RIVERSIDE_NAME = 'Riverside';
const RIVERSIDE_AREAS = [
  { name: 'River View', sortOrder: 10, tables: [{ code: 'R1', capacity: 2 }, { code: 'R2', capacity: 4 }, { code: 'R3', capacity: 4 }, { code: 'R4', capacity: 6 }] },
  { name: 'Garden', sortOrder: 20, tables: [{ code: 'G1', capacity: 2 }, { code: 'G2', capacity: 4 }, { code: 'G3', capacity: 8 }] },
];

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
        status: 'ACTIVE',
      },
    });
    console.log(`[2] Location created: "${DEMO_LOCATION_NAME}" (${location.id})`);
  } else {
    console.log(`[2] Location exists: "${DEMO_LOCATION_NAME}" (${location.id})`);
  }
  const locationId = location.id;

  // ── 3. Module activations (restaurant → catalog → checkout → costs) ──────────
  const MODULES_TO_ACTIVATE = ['restaurant', 'catalog', 'checkout', 'reports', 'costs'];
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
      data: { businessId, name: tc.name, rate: (tc.rateMinorUnits / 10000).toFixed(4), isActive: true },
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

  // ── 8b. Variants and modifier groups (idempotent: skip-if-exists by name) ─────
  const VARIANTS: Record<string, { name: string; adj: number }[]> = {
    'Paneer Tikka': [{ name: 'Half (4 pcs)', adj: -8000 }, { name: 'Full (8 pcs)', adj: 0 }],
    'Dal Makhani': [{ name: 'Half', adj: -7000 }, { name: 'Full', adj: 0 }],
    'Cold Coffee': [{ name: 'Regular', adj: 0 }, { name: 'Large', adj: 3000 }],
  };
  let variantCount = 0;
  for (const [itemName, defs] of Object.entries(VARIANTS)) {
    const item = await prisma.catalogItem.findFirst({ where: { businessId, name: itemName } });
    if (!item) continue;
    for (const [idx, v] of defs.entries()) {
      const ex = await prisma.catalogVariant.findFirst({ where: { catalogItemId: item.id, name: v.name } });
      if (!ex) {
        await prisma.catalogVariant.create({
          data: { catalogItemId: item.id, businessId, name: v.name, priceAdjMinorUnits: v.adj, sortOrder: idx },
        });
        variantCount++;
      }
    }
  }

  const MODIFIER_GROUPS: {
    name: string;
    selectionType: 'SINGLE' | 'MULTIPLE';
    isRequired: boolean;
    minSelections: number;
    maxSelections: number | null;
    options: { name: string; adj: number; isDefault?: boolean }[];
    items: string[];
  }[] = [
    {
      name: 'Spice level',
      selectionType: 'SINGLE',
      isRequired: true,
      minSelections: 1,
      maxSelections: 1,
      options: [
        { name: 'Mild', adj: 0 },
        { name: 'Medium', adj: 0, isDefault: true },
        { name: 'Hot', adj: 0 },
      ],
      items: ['Paneer Tikka', 'Paneer Butter Masala', 'Dal Makhani'],
    },
    {
      name: 'Extra toppings',
      selectionType: 'MULTIPLE',
      isRequired: false,
      minSelections: 0,
      maxSelections: 2,
      options: [
        { name: 'Extra cheese', adj: 3000 },
        { name: 'Extra butter', adj: 2000 },
        { name: 'Chopped onion', adj: 0 },
      ],
      items: ['Paneer Tikka', 'Butter Naan'],
    },
    {
      name: 'Sugar level',
      selectionType: 'SINGLE',
      isRequired: false,
      minSelections: 0,
      maxSelections: 1,
      options: [
        { name: 'No sugar', adj: 0 },
        { name: 'Less sugar', adj: 0 },
        { name: 'Extra sweet', adj: 0 },
      ],
      items: ['Masala Chai', 'Cold Coffee'],
    },
  ];
  let groupCount = 0;
  for (const g of MODIFIER_GROUPS) {
    let group = await prisma.modifierGroup.findFirst({ where: { businessId, name: g.name } });
    if (!group) {
      group = await prisma.modifierGroup.create({
        data: {
          businessId,
          name: g.name,
          selectionType: g.selectionType,
          isRequired: g.isRequired,
          minSelections: g.minSelections,
          maxSelections: g.maxSelections,
        },
      });
      groupCount++;
    }
    for (const [idx, o] of g.options.entries()) {
      const ex = await prisma.modifierOption.findFirst({ where: { modifierGroupId: group.id, name: o.name } });
      if (!ex) {
        await prisma.modifierOption.create({
          data: {
            modifierGroupId: group.id,
            businessId,
            name: o.name,
            priceAdjMinorUnits: o.adj,
            isDefault: o.isDefault ?? false,
            sortOrder: idx,
          },
        });
      }
    }
    for (const itemName of g.items) {
      const item = await prisma.catalogItem.findFirst({ where: { businessId, name: itemName } });
      if (!item) continue;
      await prisma.catalogItemModifierGroup.upsert({
        where: { catalogItemId_modifierGroupId: { catalogItemId: item.id, modifierGroupId: group.id } },
        create: { catalogItemId: item.id, modifierGroupId: group.id },
        update: {},
      });
    }
  }
  console.log(`[8b] Variants: ${variantCount} created; modifier groups: ${groupCount} created`);

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
      const existing = await prisma.diningTable.findFirst({ where: { diningAreaId: area.id, code: tableDef.code } });
      if (!existing) {
        await prisma.diningTable.create({
          data: {
            businessId,
            locationId,
            diningAreaId: area.id,
            code: tableDef.code,
            capacity: tableDef.seatingCapacity,
            status: 'AVAILABLE',
          },
        });
      }
    }
    const tableCount = (await prisma.diningTable.count({ where: { businessId, diningAreaId: area.id } }));
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

  // ── 11. Second location "Riverside" with its own areas and tables ────────────
  let riverside = await prisma.location.findFirst({ where: { businessId, name: RIVERSIDE_NAME } });
  if (!riverside) {
    riverside = await prisma.location.create({
      data: { businessId, name: RIVERSIDE_NAME, timezone: 'Asia/Kolkata', status: 'ACTIVE' },
    });
    console.log(`[11] Location created: "${RIVERSIDE_NAME}" (${riverside.id})`);
  } else {
    console.log(`[11] Location exists: "${RIVERSIDE_NAME}" (${riverside.id})`);
  }
  for (const areaDef of RIVERSIDE_AREAS) {
    let area = await prisma.diningArea.findFirst({ where: { businessId, locationId: riverside.id, name: areaDef.name } });
    if (!area) {
      area = await prisma.diningArea.create({
        data: { businessId, locationId: riverside.id, name: areaDef.name, sortOrder: areaDef.sortOrder, isActive: true },
      });
    }
    for (const t of areaDef.tables) {
      const ex = await prisma.diningTable.findFirst({ where: { diningAreaId: area.id, code: t.code } });
      if (!ex) {
        await prisma.diningTable.create({
          data: { businessId, locationId: riverside.id, diningAreaId: area.id, code: t.code, capacity: t.capacity, status: 'AVAILABLE' },
        });
      }
    }
  }
  console.log(`[11] Riverside areas: ${RIVERSIDE_AREAS.map((a) => `${a.name} (${a.tables.map((t) => t.code).join(',')})`).join('; ')}`);

  // ── 12. Real services + actor scopes ──────────────────────────────────────────
  const svc = buildServices(prisma);
  const ownerScope = await userScope(prisma, businessId, 'demo.owner@pilot.nexus');
  const waiterScope = await userScope(prisma, businessId, 'demo.waiter@pilot.nexus');
  const kitchenScope = await userScope(prisma, businessId, 'demo.kitchen@pilot.nexus');
  const cashierScope = await userScope(prisma, businessId, 'demo.cashier@pilot.nexus');

  // Riverside numbering gets a distinct prefix (configured via NumberingService,
  // audited) before its first allocation. Main keeps its existing series.
  const invSeries = await ensureSeries(prisma, svc, ownerScope, riverside.id, 'invoice', 'RV-', 4);
  const kotSeries = await ensureSeries(prisma, svc, ownerScope, riverside.id, 'service_request', 'RV-K', 3);
  console.log(`[12] Riverside numbering: invoice ${invSeries}, service_request ${kotSeries}`);

  // ── 13. Tidy hand-made test sessions whose bill is already PAID ───────────────
  const tidied = await closePaidOpenSessions(prisma, svc, ownerScope, locationId);
  console.log(`[13] Closed paid-but-open test sessions at Main: ${tidied.length ? tidied.join(', ') : 'none'}`);

  // ── 14. Trading history (14 days, both locations) ─────────────────────────────
  const catalog = await loadCatalog(prisma, businessId);
  const demoLocations: DemoLocation[] = [];
  for (const [key, loc] of [['main', location], ['riverside', riverside]] as const) {
    const tables = await prisma.diningTable.findMany({
      where: { businessId, locationId: loc.id, isActive: true },
      select: { id: true, code: true, capacity: true },
    });
    demoLocations.push({ key, id: loc.id, name: loc.name, tables });
  }
  for (const dl of demoLocations) {
    const r = await seedHistory(prisma, businessId, dl, catalog, NOW);
    console.log(`[14] History "${r.location}": ${r.inserted} bills inserted, ${r.existing} already present (${r.days} days)`);
  }

  // ── 15. Expenses (2 weeks, both locations) ────────────────────────────────────
  for (const dl of demoLocations) {
    const r = await seedExpenses(prisma, svc, ownerScope, cashierScope.actor.id!, dl, NOW);
    console.log(`[15] Expenses "${dl.name}": ${r.inserted} inserted, ${r.existing} already present, ${r.rejected} rejected now`);
  }

  // ── 16. Live tables at Riverside (real services) ──────────────────────────────
  const retired = await retireStaleSessions(prisma, svc, ownerScope, NOW);
  console.log(`[16a] Retired stale / previous live-scenario sessions: ${retired.length ? retired.join(', ') : 'none'}`);
  const live = await openLiveTables(prisma, svc, waiterScope, kitchenScope, { main: demoLocations[0], riverside: demoLocations[1] }, NOW);
  console.log(`[16b] Live tables (relative to now): ${live.length ? live.join('; ') : 'none (tables busy)'}`);

  // ── 16c. QR digital menu: QR codes, policy, dish marks, pictures (ADR-035) ─────
  const qr = await seedQrMenu(prisma, businessId);
  console.log(`[16c] QR menu: ${qr.qrCodes} new QR code(s), ${qr.dishesMarked} dish(es) marked, ${qr.pictures} picture(s) set${qr.mediaDir ? ` (media: ${qr.mediaDir})` : ' (no MEDIA_DIR: pictures skipped)'}. Set a UPI ID in Settings > Checkout to enable "Pay by UPI".`);

  // ── 17. Integrity check ───────────────────────────────────────────────────────
  const chain = await svc.audit.verifyChain(ownerScope);
  console.log(`[17] Audit chain: ${chain.valid ? 'VALID' : `BROKEN at ${chain.brokenAtSequence} (${chain.reason})`} - ${chain.count} events`);
  if (!chain.valid) process.exitCode = 1;

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
  console.log(`Location ID : ${locationId}  (Main Location)`);
  console.log(`Location ID : ${riverside.id}  (Riverside)`);
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
