/**
 * Demo expenses — two weeks of operating costs per location.
 *
 * Historical expenses are written with Prisma (CostsService.createExpense
 * stamps approvedAt = now, which would misdate a week-old approval) but follow
 * the service's rules exactly: categories that do not require approval are
 * APPROVED at creation by their creator; approval-required ones are either
 * approved later by the owner or still PENDING_APPROVAL. No audit rows are
 * written for history.
 *
 * One expense is rejected through the REAL CostsService.rejectExpense (an
 * audited action that genuinely happens at seed time).
 *
 * Idempotency: deterministic `idempotencyKey` (UNIQUE) per planned expense.
 */
import type { PrismaService } from '../../src/prisma/prisma.service';
import type { TenantScope } from '../../src/common/tenant-scope';
import type { DemoServices } from './live';
import { Rng, addMinutes, istDate, istInstant, uuidFrom } from './util';

interface PlannedExpense {
  key: string;
  category: string;
  offset: number;
  amount: number;
  description: string;
  vendor: string;
  recurring?: string;
  /** For approval-required categories: final state. */
  outcome?: 'approved' | 'pending' | 'reject';
  rejectionReason?: string;
}

const SUPPLY_VENDORS = [
  ['Sharma Vegetables', 'Fresh vegetables & herbs'],
  ['Metro Cash & Carry', 'Dry groceries — atta, rice, spices'],
  ['Amul Dairy Distributor', 'Paneer, cream & butter'],
  ['Gupta Packaging', 'Takeaway containers & napkins'],
  ['Shree Oil Traders', 'Cooking oil (15 L tins)'],
] as const;

function planExpenses(loc: 'main' | 'riverside'): PlannedExpense[] {
  const big = loc === 'main' ? 1 : 0.7;
  const out: PlannedExpense[] = [];
  for (let offset = -13; offset <= 0; offset++) {
    const rng = new Rng(`expense/v1/${loc}/${offset}`);
    if (rng.chance(0.7)) {
      const [vendor, description] = rng.pick(SUPPLY_VENDORS);
      out.push({
        key: `supplies/${offset}`,
        category: 'Kitchen Supplies',
        offset,
        amount: Math.round((rng.int(1800, 9500) * big) / 10) * 1000,
        description,
        vendor,
      });
    }
  }
  out.push(
    { key: 'electricity', category: 'Utilities', offset: -8, amount: Math.round(18_450 * big) * 100, description: 'Electricity bill — September cycle', vendor: 'State Electricity Board' },
    { key: 'lpg-1', category: 'Utilities', offset: -11, amount: 360_000, description: 'Commercial LPG cylinders × 2', vendor: 'Bharat Gas Agency' },
    { key: 'lpg-2', category: 'Utilities', offset: -4, amount: 360_000, description: 'Commercial LPG cylinders × 2', vendor: 'Bharat Gas Agency' },
    { key: 'water', category: 'Utilities', offset: -6, amount: 145_000, description: 'Water tanker & RO service', vendor: 'AquaPure Services' },
    { key: 'wages-week-1', category: 'Staff Wages', offset: -7, amount: Math.round(42_000 * big) * 100, description: 'Weekly wages — kitchen & floor staff', vendor: 'Staff payroll', recurring: 'Weekly, every Sunday', outcome: 'approved' },
    { key: 'wages-week-2', category: 'Staff Wages', offset: 0, amount: Math.round(42_000 * big) * 100, description: 'Weekly wages — kitchen & floor staff', vendor: 'Staff payroll', recurring: 'Weekly, every Sunday', outcome: 'pending' },
    { key: 'rent-nov', category: 'Rent', offset: -1, amount: loc === 'main' ? 12_500_000 : 8_500_000, description: 'November rent (paid in advance)', vendor: 'Landlord — property account', recurring: 'Monthly, 1st', outcome: loc === 'main' ? 'pending' : 'approved' },
  );
  if (loc === 'main') {
    out.push({
      key: 'overtime-claim',
      category: 'Staff Wages',
      offset: -4,
      amount: 680_000,
      description: 'Overtime — Saturday double shift',
      vendor: 'Staff payroll',
      outcome: 'reject',
      rejectionReason: 'Already included in the weekly wage entry — duplicate claim',
    });
    out.push({ key: 'helper-wages', category: 'Staff Wages', offset: -2, amount: 240_000, description: 'Casual helper — 3 days', vendor: 'Daily wage', outcome: 'pending' });
  }
  return out;
}

export async function seedExpenses(
  db: PrismaService,
  svc: DemoServices,
  ownerScope: TenantScope,
  cashierId: string,
  loc: { key: 'main' | 'riverside'; id: string },
  now: Date,
): Promise<{ inserted: number; existing: number; rejected: number }> {
  const businessId = ownerScope.businessId;
  const ownerId = ownerScope.actor.id!;
  const categories = await db.expenseCategory.findMany({ where: { businessId } });
  const byName = new Map(categories.map((c) => [c.name, c]));

  let inserted = 0;
  let existing = 0;
  let rejected = 0;
  for (const e of planExpenses(loc.key)) {
    const category = byName.get(e.category);
    if (!category) continue;
    const base = `expense/v1/${loc.key}/${e.key}`;
    const idempotencyKey = uuidFrom(`${base}/idem`);
    const rng = new Rng(base);

    const date = istDate(now, e.offset);
    let paidAt = istInstant(date, rng.int(10 * 60, 17 * 60) + rng.next());
    if (paidAt.getTime() > now.getTime() - 5 * 60_000) paidAt = addMinutes(now, -rng.int(20, 90));
    const createdAt = addMinutes(paidAt, rng.int(5, 150));
    const createdAtSafe = createdAt.getTime() < now.getTime() ? createdAt : addMinutes(now, -2);

    const found = await db.expense.findUnique({ where: { idempotencyKey } });
    let row = found;
    if (found) {
      existing++;
    } else {
      const manual = category.requiresApproval;
      const approved = !manual || e.outcome === 'approved';
      const approvedAt = !manual
        ? createdAtSafe
        : approved
          ? (() => {
              const a = istInstant(istDate(createdAtSafe, 1), rng.int(9 * 60 + 30, 11 * 60));
              return a.getTime() < now.getTime() ? a : addMinutes(now, -1);
            })()
          : null;
      const createdById = manual ? ownerId : cashierId;
      row = await db.expense.create({
        data: {
          id: uuidFrom(base),
          businessId,
          locationId: loc.id,
          expenseCategoryId: category.id,
          amountMinorUnits: e.amount,
          paidAt,
          description: e.description,
          vendorName: e.vendor,
          isRecurring: Boolean(e.recurring),
          recurringNote: e.recurring ?? null,
          idempotencyKey,
          status: approved ? 'APPROVED' : 'PENDING_APPROVAL',
          approvedAt,
          approvedById: approved ? (manual ? ownerId : createdById) : null,
          createdById,
          version: manual && approved ? 2 : 1,
          createdAt: createdAtSafe,
          updatedAt: approvedAt ?? createdAtSafe,
        },
      });
      inserted++;
    }

    if (e.outcome === 'reject' && row && row.status === 'PENDING_APPROVAL') {
      await svc.costs.rejectExpense(ownerScope, row.id, { rejectionReason: e.rejectionReason! }, ownerId);
      rejected++;
    }
  }
  return { inserted, existing, rejected };
}
