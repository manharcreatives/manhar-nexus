/**
 * Demo trading history — 14 days of closed table visits per location.
 *
 * Why Prisma writes and not the live services: every service stamps
 * `new Date()` (sentAt, finalisedAt, capturedAt, closedAt…), so it cannot
 * record a visit that happened last Tuesday. Instead this module writes the
 * exact rows the services would have written, while REUSING the services'
 * own logic wherever it matters for correctness:
 *
 *   - Invoice totals / per-line tax rounding / tax breakdown come from
 *     InvoiceService.computeTotals itself (called directly, it is pure).
 *   - Invoice + service-request numbers are taken from the real
 *     NumberingSeries rows under the same per-business advisory lock
 *     (lockBusiness) NumberingService uses, so the series' nextValue moves
 *     forward and the next live invoice can never collide.
 *   - Status/version/timestamp progressions mirror the services
 *     (DRAFT→FINALISED→PAID, SENT→ACCEPTED→PREPARING→READY→SERVED,
 *     session OPEN→CLOSED, CASH change, UPI reference capture, refunds).
 *
 * No audit rows are written for history: AuditService always stamps "now",
 * and back-dated rows appended after newer ones would make the activity log
 * lie. The hash chain is therefore untouched by this module.
 *
 * Idempotency: every row id (and idempotency key) is a UUID derived from a
 * stable key such as `history/v1/main/2026-10-20/7/session`. Each run plans
 * the same bills, looks up which session ids already exist, and inserts only
 * the missing bills. For TODAY only bills already closed by "now" are
 * inserted, so a later run the same day tops today up with the newer bills.
 */
 
import { Prisma, PrismaClient } from '@prisma/client';
import { InvoiceService } from '../../src/checkout/invoice/invoice.service';
import { lockBusiness } from '../../src/common/locks';
import { Rng, addMinutes, formatNumber, istDate, istDayOfWeek, istInstant, uuidFrom } from './util';

// ── Inputs ────────────────────────────────────────────────────────────────────

export interface DemoTable {
  id: string;
  code: string;
  capacity: number;
}

export interface DemoLocation {
  /** Stable key used in deterministic ids — never change once seeded. */
  key: 'main' | 'riverside';
  id: string;
  name: string;
  tables: DemoTable[];
}

interface CatalogOption {
  id: string;
  name: string;
  adj: number;
  isDefault: boolean;
}
interface CatalogGroup {
  name: string;
  selectionType: 'SINGLE' | 'MULTIPLE';
  isRequired: boolean;
  maxSelections: number | null;
  options: CatalogOption[];
}
interface CatalogEntry {
  id: string;
  name: string;
  basePrice: number;
  taxRate: Prisma.Decimal;
  taxName: string | null;
  variants: { id: string; name: string; adj: number }[];
  groups: CatalogGroup[];
}
type Catalog = Map<string, CatalogEntry>;

// ── Plan types ────────────────────────────────────────────────────────────────

interface PlannedModifier {
  id: string;
  optionId: string;
  name: string;
  adj: number;
}
interface PlannedLine {
  id: string;
  catalogItemId: string;
  variantId: string | null;
  itemName: string;
  variantName: string | null;
  unitPrice: number;
  taxRate: Prisma.Decimal;
  taxName: string | null;
  quantity: number;
  kitchenNote: string | null;
  createdAt: Date;
  modifiers: PlannedModifier[];
}
interface PlannedRound {
  id: string;
  idempotencyKey: string;
  roundNumber: number;
  createdAt: Date;
  sentAt: Date;
  acceptedAt: Date;
  preparedAt: Date;
  servedAt: Date;
  lines: PlannedLine[];
}
interface PlannedBill {
  k: number;
  sessionId: string;
  partySize: number;
  openedAt: Date;
  closedAt: Date;
  tableId: string;
  rounds: PlannedRound[];
  /** Present when this visit had a bill voided and re-issued. */
  voided?: { invoiceId: string; createdAt: Date; finalisedAt: Date; voidedAt: Date; reason: string };
  invoiceId: string;
  invoiceCreatedAt: Date;
  finalisedAt: Date;
  method: 'CASH' | 'UPI';
  paymentId: string;
  paymentIdempotencyKey: string;
  paymentCreatedAt: Date;
  capturedAt: Date;
  upiReference: string | null;
  /** Uniform roll deciding how the guest tendered cash (see cashTendered). */
  cashRoll: number;
  refund?: { id: string; reason: string; at: Date };
}

// ── Location profiles ─────────────────────────────────────────────────────────

const PROFILES = {
  main: {
    weekday: [18, 26] as const,
    weekend: [26, 34] as const,
    slots: [['lunch', 45], ['dinner', 47], ['snack', 8]] as const,
    upiShare: 0.55,
  },
  riverside: {
    weekday: [15, 21] as const,
    weekend: [21, 28] as const,
    slots: [['lunch', 38], ['dinner', 42], ['snack', 20]] as const,
    upiShare: 0.62,
  },
} as const;

type Slot = 'lunch' | 'dinner' | 'snack';

/** Hand-picked one-off events so the history includes corrections. */
const SPECIAL_EVENTS: Record<string, { kind: 'void' | 'refund'; reason: string }> = {
  'main:-5:6': { kind: 'void', reason: 'Billed to wrong table — re-issued' },
  'main:-3:4': { kind: 'refund', reason: 'Dish returned — too spicy' },
  'main:-10:9': { kind: 'refund', reason: 'Late service — goodwill refund' },
  'riverside:-6:3': { kind: 'refund', reason: 'Wrong item served' },
};

const ITEM_WEIGHTS = {
  starters: [['Paneer Tikka', 5], ['Spring Rolls', 3], ['Veg Soup', 2]],
  mains: [['Paneer Butter Masala', 5], ['Dal Makhani', 5]],
  beverages: {
    main: [['Masala Chai', 3], ['Lassi', 3], ['Cold Coffee', 3]],
    riverside: [['Masala Chai', 3], ['Lassi', 2], ['Cold Coffee', 5]],
  },
  desserts: [['Gulab Jamun', 3], ['Ice Cream Scoop', 2]],
  snackBites: [['Spring Rolls', 3], ['Veg Soup', 2], ['Paneer Tikka', 1]],
} as const;

const KITCHEN_NOTES = ['No onion, no garlic', 'Less oil please', 'Extra crispy', 'Serve together', 'Jain — no root veg'];

// ── computeTotals: the invoice service's own pure calculation ─────────────────

type TotalsInputLine = {
  id: string;
  itemNameSnapshot: string;
  variantNameSnapshot: string | null;
  quantity: number;
  unitPriceMinorUnits: number;
  taxRateSnapshot: { toNumber(): number };
  taxCategoryNameSnapshot: string | null;
  modifiers: Array<{ optionNameSnapshot: string; priceAdjMinorUnits: number }>;
};
type TotalsResult = {
  subtotalMinorUnits: number;
  totalTaxMinorUnits: number;
  grandTotalMinorUnits: number;
  taxBreakdown: unknown[];
  lines: Array<{
    serviceRequestLineId: string;
    itemNameSnapshot: string;
    variantNameSnapshot?: string;
    modifiersSummary?: string;
    quantity: number;
    unitPriceMinorUnits: number;
    modifiersMinorUnits: number;
    taxRateSnapshot: number;
    taxCategoryName?: string;
    lineSubtotalMinorUnits: number;
    lineTaxMinorUnits: number;
    lineTotalMinorUnits: number;
  }>;
};

const computeTotals = (
  InvoiceService.prototype as unknown as { computeTotals: (lines: TotalsInputLine[]) => TotalsResult }
).computeTotals;
if (typeof computeTotals !== 'function') {
  throw new Error('InvoiceService.computeTotals not found — demo history must reuse the service calculation');
}

function totalsFor(bill: PlannedBill): TotalsResult {
  const lines = bill.rounds.flatMap((r) => r.lines);
  return computeTotals(
    lines.map((l) => ({
      id: l.id,
      itemNameSnapshot: l.itemName,
      variantNameSnapshot: l.variantName,
      quantity: l.quantity,
      unitPriceMinorUnits: l.unitPrice,
      taxRateSnapshot: l.taxRate,
      taxCategoryNameSnapshot: l.taxName,
      modifiers: l.modifiers.map((m) => ({ optionNameSnapshot: m.name, priceAdjMinorUnits: m.adj })),
    })),
  );
}

// ── Catalog loading ───────────────────────────────────────────────────────────

export async function loadCatalog(prisma: PrismaClient, businessId: string): Promise<Catalog> {
  const items = await prisma.catalogItem.findMany({
    where: { businessId, isActive: true },
    include: {
      taxCategory: true,
      variants: { orderBy: { sortOrder: 'asc' } },
      modifierGroups: {
        include: { modifierGroup: { include: { options: { orderBy: { sortOrder: 'asc' } } } } },
      },
    },
  });
  const map: Catalog = new Map();
  for (const it of items) {
    map.set(it.name, {
      id: it.id,
      name: it.name,
      basePrice: it.basePriceMinorUnits,
      taxRate: it.taxCategory?.rate ?? new Prisma.Decimal(0),
      taxName: it.taxCategory?.name ?? null,
      variants: it.variants.map((v) => ({ id: v.id, name: v.name, adj: v.priceAdjMinorUnits })),
      groups: it.modifierGroups
        .map((link) => link.modifierGroup)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((g) => ({
          name: g.name,
          selectionType: g.selectionType as 'SINGLE' | 'MULTIPLE',
          isRequired: g.isRequired,
          maxSelections: g.maxSelections,
          options: g.options.map((o) => ({ id: o.id, name: o.name, adj: o.priceAdjMinorUnits, isDefault: o.isDefault })),
        })),
    });
  }
  return map;
}

// ── Planning ──────────────────────────────────────────────────────────────────

interface DraftLine {
  item: CatalogEntry;
  variantId: string | null;
  variantName: string | null;
  variantAdj: number;
  options: CatalogOption[];
  quantity: number;
  kitchenNote: string | null;
}

function draftLine(rng: Rng, catalog: Catalog, itemName: string, quantity: number): DraftLine | null {
  const item = catalog.get(itemName);
  if (!item) return null;

  let variant: { id: string; name: string; adj: number } | null = null;
  if (item.variants.length > 0) {
    // Full/Regular portions are the default order; half/large a minority.
    const weights = item.variants.map((v) => [v, /half|large/i.test(v.name) ? 0.4 : 0.6] as const);
    variant = rng.weighted(weights);
  }

  const options: CatalogOption[] = [];
  for (const g of item.groups) {
    if (g.selectionType === 'SINGLE') {
      if (g.isRequired) {
        options.push(rng.weighted(g.options.map((o) => [o, o.isDefault ? 2 : 1] as const)));
      } else if (rng.chance(0.4)) {
        options.push(rng.pick(g.options));
      }
    } else {
      const max = g.maxSelections ?? g.options.length;
      const n = rng.chance(0.25) ? (rng.chance(0.2) && max >= 2 ? 2 : 1) : 0;
      const pool = [...g.options];
      for (let i = 0; i < n && pool.length > 0; i++) {
        options.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
      }
    }
  }

  return {
    item,
    variantId: variant?.id ?? null,
    variantName: variant?.name ?? null,
    variantAdj: variant?.adj ?? 0,
    options,
    quantity,
    kitchenNote: rng.chance(0.07) ? rng.pick(KITCHEN_NOTES) : null,
  };
}

function composeRound(
  rng: Rng,
  catalog: Catalog,
  loc: DemoLocation['key'],
  slot: Slot,
  party: number,
  roundNumber: number,
): DraftLine[] {
  const out: (DraftLine | null)[] = [];
  const add = (name: string, qty: number): void => {
    if (qty > 0) out.push(draftLine(rng, catalog, name, qty));
  };
  const bev = ITEM_WEIGHTS.beverages[loc];

  if (roundNumber === 1 && slot === 'snack') {
    for (let i = 0; i < party; i++) add(rng.weighted(i === 0 ? bev : [['Masala Chai', 4], ...bev]), 1);
    if (rng.chance(0.65)) add(rng.weighted(ITEM_WEIGHTS.snackBites), Math.max(1, Math.round(party / 2)));
    if (rng.chance(0.3)) add(rng.weighted(ITEM_WEIGHTS.desserts), 1);
  } else if (roundNumber === 1) {
    if (rng.chance(0.6)) {
      for (let i = 0; i < Math.ceil(party / 3); i++) add(rng.weighted(ITEM_WEIGHTS.starters), 1);
    }
    const mains = Math.max(1, Math.round(party * 0.7 + rng.range(-0.3, 0.3)));
    for (let i = 0; i < mains; i++) add(rng.weighted(ITEM_WEIGHTS.mains), 1);
    const rice = rng.chance(0.5) ? Math.ceil(party / 3) : 0;
    add('Jeera Rice', rice);
    add('Butter Naan', Math.max(1, party + rng.int(0, Math.ceil(party / 2)) - rice));
    for (let i = 0; i < party; i++) if (rng.chance(0.45)) add(rng.weighted(bev), 1);
  } else {
    for (let i = 0; i < Math.ceil(party / 2); i++) add(rng.weighted(ITEM_WEIGHTS.desserts), 1);
    if (rng.chance(0.4)) add('Masala Chai', rng.int(1, party));
    if (rng.chance(0.3)) add('Butter Naan', rng.int(1, 2));
  }

  // Merge identical lines (same item, variant, modifier set and note).
  const merged = new Map<string, DraftLine>();
  for (const l of out) {
    if (!l) continue;
    const key = [l.item.id, l.variantId, l.options.map((o) => o.id).sort().join('+'), l.kitchenNote].join('|');
    const ex = merged.get(key);
    if (ex) ex.quantity += l.quantity;
    else merged.set(key, l);
  }
  return [...merged.values()];
}

/** How many visits a location-day plans (before any are turned away). */
function billCount(key: DemoLocation['key'], date: string): number {
  const profile = PROFILES[key];
  const dow = istDayOfWeek(date);
  const [lo, hi] = dow === 0 || dow === 5 || dow === 6 ? profile.weekend : profile.weekday;
  return new Rng(`history/v1/${key}/${date}`).int(lo, hi);
}

/** Every session id the history may use for a location-day. */
function historySessionIds(key: DemoLocation['key'], date: string): Set<string> {
  const ids = new Set<string>();
  for (let k = 0; k < billCount(key, date); k++) ids.add(uuidFrom(`history/v1/${key}/${date}/${k}/session`));
  return ids;
}

/** Plan every bill of one location-day (deterministic; table assignment aside). */
function planDay(
  catalog: Catalog,
  loc: DemoLocation,
  date: string,
  dayOffset: number,
  busy: Map<string, Array<[number, number]>>,
): PlannedBill[] {
  const profile = PROFILES[loc.key];
  const count = billCount(loc.key, date);

  const bills: PlannedBill[] = [];
  for (let k = 0; k < count; k++) {
    const base = `history/v1/${loc.key}/${date}/${k}`;
    const rng = new Rng(base);
    const special = SPECIAL_EVENTS[`${loc.key}:${dayOffset}:${k}`];

    const slot = rng.weighted(profile.slots) as Slot;
    const party = slot === 'snack'
      ? rng.weighted([[1, 3], [2, 5], [3, 2]] as const)
      : rng.weighted([[1, 8], [2, 34], [3, 20], [4, 22], [5, 9], [6, 7]] as const);

    let openMin =
      slot === 'lunch' ? 720 + ((rng.next() + rng.next()) / 2) * 200
      : slot === 'dinner' ? 1140 + ((rng.next() + rng.next()) / 2) * 200
      : 960 + rng.next() * 140;

    // Relative minute offsets from table opening.
    const rounds: Array<{ created: number; sent: number; accepted: number; prepared: number; served: number; lines: DraftLine[] }> = [];
    const twoRounds = slot !== 'snack' && party >= 2 && rng.chance(0.35);
    let t = rng.range(2, 6);
    for (let r = 1; r <= (twoRounds ? 2 : 1); r++) {
      const created = t;
      const sent = created + rng.range(0.3, 1.5);
      const accepted = sent + rng.range(0.5, 3);
      const prepared = accepted + rng.range(0.5, 3);
      const served = prepared + (r === 1 && slot !== 'snack' ? rng.range(9, 20) : rng.range(4, 10));
      rounds.push({ created, sent, accepted, prepared, served, lines: composeRound(rng, catalog, loc.key, slot, party, r) });
      t = served + rng.range(12, 30);
    }
    const lastServed = rounds[rounds.length - 1].served;

    let voidTimes: { created: number; finalised: number; voided: number } | undefined;
    let invoiceCreated = lastServed + rng.range(8, 25);
    if (special?.kind === 'void') {
      const created = invoiceCreated;
      const finalised = created + rng.range(0.3, 1.5);
      const voided = finalised + rng.range(1.5, 4);
      voidTimes = { created, finalised, voided };
      invoiceCreated = voided + rng.range(0.5, 2);
    }
    const finalised = invoiceCreated + rng.range(0.3, 1.5);
    const paymentCreated = finalised + rng.range(0.5, 3);
    const method: 'CASH' | 'UPI' = special?.kind === 'refund' ? 'CASH' : rng.chance(profile.upiShare) ? 'UPI' : 'CASH';
    const captured = method === 'UPI' ? paymentCreated + rng.range(0.5, 2.5) : paymentCreated;
    const closed = captured + rng.range(1, 6);

    // Keep the whole visit inside the IST calendar day (service ends ~23:50).
    if (openMin + closed > 23 * 60 + 50) openMin = 23 * 60 + 50 - closed;
    const at = (m: number): Date => istInstant(date, openMin + m);

    const plannedRounds: PlannedRound[] = rounds.map((r, idx) => ({
      id: uuidFrom(`${base}/r${idx + 1}`),
      idempotencyKey: uuidFrom(`${base}/r${idx + 1}/idem`),
      roundNumber: idx + 1,
      createdAt: at(r.created),
      sentAt: at(r.sent),
      acceptedAt: at(r.accepted),
      preparedAt: at(r.prepared),
      servedAt: at(r.served),
      lines: r.lines.map((l, li) => {
        const lineId = uuidFrom(`${base}/r${idx + 1}/l${li}`);
        return {
          id: lineId,
          catalogItemId: l.item.id,
          variantId: l.variantId,
          itemName: l.item.name,
          variantName: l.variantName,
          // Same contract as OrderService: unit price = base + variant + modifier
          // adjustments; computeTotals multiplies it by quantity.
          unitPrice: l.item.basePrice + l.variantAdj + l.options.reduce((sum, o) => sum + o.adj, 0),
          taxRate: l.item.taxRate,
          taxName: l.item.taxName,
          quantity: l.quantity,
          kitchenNote: l.kitchenNote,
          createdAt: addMinutes(at(r.created), li / 60_000),
          modifiers: l.options.map((o, mi) => ({
            id: uuidFrom(`${base}/r${idx + 1}/l${li}/m${mi}`),
            optionId: o.id,
            name: o.name,
            adj: o.adj,
          })),
        };
      }),
    }));

    const bill: PlannedBill = {
      k,
      sessionId: uuidFrom(`${base}/session`),
      partySize: party,
      openedAt: at(0),
      closedAt: at(closed),
      tableId: '',
      rounds: plannedRounds,
      invoiceId: uuidFrom(`${base}/invoice`),
      invoiceCreatedAt: at(invoiceCreated),
      finalisedAt: at(finalised),
      method,
      paymentId: uuidFrom(`${base}/payment`),
      paymentIdempotencyKey: uuidFrom(`${base}/payment/idem`),
      paymentCreatedAt: at(paymentCreated),
      capturedAt: at(captured),
      upiReference: null,
      cashRoll: rng.next(),
    };
    if (voidTimes && special) {
      bill.voided = {
        invoiceId: uuidFrom(`${base}/invoice-voided`),
        createdAt: at(voidTimes.created),
        finalisedAt: at(voidTimes.finalised),
        voidedAt: at(voidTimes.voided),
        reason: special.reason,
      };
    }
    if (special?.kind === 'refund') {
      bill.refund = { id: uuidFrom(`${base}/refund`), reason: special.reason, at: addMinutes(at(closed), rng.range(15, 40)) };
    }
    if (method === 'UPI') {
      let ref = String(rng.int(3, 5));
      for (let i = 0; i < 11; i++) ref += String(rng.int(0, 9));
      bill.upiReference = ref;
    }
    bills.push(bill);
  }

  // Table assignment: earliest-opened first, smallest free table that fits,
  // respecting intervals already occupied by real (non-demo) sessions. When
  // every table is taken the party waits for the next table to free up (the
  // whole visit shifts later); if that pushes it past closing it is dropped.
  // A table is therefore never double-booked.
  bills.sort((a, b) => a.openedAt.getTime() - b.openedAt.getTime());
  const tables = [...loc.tables].sort((a, b) => a.capacity - b.capacity || a.code.localeCompare(b.code));
  const tRng = new Rng(`history/v1/${loc.key}/${date}/tables`);
  const dayEnd = istInstant(date, 23 * 60 + 55).getTime();
  const turnover = 2 * 60_000; // table reset between parties
  const isFree = (tb: DemoTable, s: number, e: number): boolean =>
    !(busy.get(tb.id) ?? []).some(([bs, be]) => bs < e + turnover && s < be + turnover);
  const choose = (s: number, e: number, party: number): DemoTable | undefined => {
    const free = tables.filter((tb) => isFree(tb, s, e));
    return free.find((tb) => tb.capacity >= party) ?? free[free.length - 1];
  };

  const seated: PlannedBill[] = [];
  for (const bill of bills) {
    const s = bill.openedAt.getTime();
    const dur = bill.closedAt.getTime() - s;
    let start = s;
    let table = choose(start, start + dur, bill.partySize);
    if (!table) {
      const releases = [...new Set([...busy.values()].flat().map(([, be]) => be + turnover))]
        .filter((t) => t > s)
        .sort((a, b) => a - b);
      for (const r of releases) {
        const candidate = r + tRng.int(1, 5) * 60_000;
        table = choose(candidate, candidate + dur, bill.partySize);
        if (table) {
          start = candidate;
          break;
        }
      }
    }
    if (!table || start + dur > dayEnd) continue; // walked away / kitchen closed
    if (start !== s) shiftBill(bill, start - s);
    bill.tableId = table.id;
    const list = busy.get(table.id) ?? [];
    list.push([start, start + dur]);
    busy.set(table.id, list);
    seated.push(bill);
  }
  return seated;
}

/** Move every timestamp of a planned visit by `ms`. */
function shiftBill(bill: PlannedBill, ms: number): void {
  const sh = (d: Date): Date => new Date(d.getTime() + ms);
  bill.openedAt = sh(bill.openedAt);
  bill.closedAt = sh(bill.closedAt);
  bill.invoiceCreatedAt = sh(bill.invoiceCreatedAt);
  bill.finalisedAt = sh(bill.finalisedAt);
  bill.paymentCreatedAt = sh(bill.paymentCreatedAt);
  bill.capturedAt = sh(bill.capturedAt);
  if (bill.voided) {
    bill.voided.createdAt = sh(bill.voided.createdAt);
    bill.voided.finalisedAt = sh(bill.voided.finalisedAt);
    bill.voided.voidedAt = sh(bill.voided.voidedAt);
  }
  if (bill.refund) bill.refund.at = sh(bill.refund.at);
  for (const r of bill.rounds) {
    r.createdAt = sh(r.createdAt);
    r.sentAt = sh(r.sentAt);
    r.acceptedAt = sh(r.acceptedAt);
    r.preparedAt = sh(r.preparedAt);
    r.servedAt = sh(r.servedAt);
    for (const l of r.lines) l.createdAt = sh(l.createdAt);
  }
}

function cashTendered(total: number, roll: number): number {
  if (roll < 0.3) return total; // exact change
  const step = roll < 0.7 ? 10_000 : 50_000; // ₹100 or ₹500 notes
  return Math.ceil(total / step) * step;
}

// ── Number reservation (same lock + series rows as NumberingService) ─────────

async function reserveNumbers(
  tx: Prisma.TransactionClient,
  businessId: string,
  locationId: string,
  key: string,
  count: number,
): Promise<string[]> {
  if (count === 0) return [];
  await lockBusiness(tx, businessId);
  const series =
    (await tx.numberingSeries.findFirst({ where: { businessId, locationId, key } })) ??
    (await tx.numberingSeries.create({ data: { businessId, locationId, key } }));
  const start = series.nextValue;
  await tx.numberingSeries.update({ where: { id: series.id }, data: { nextValue: start + BigInt(count) } });
  return Array.from({ length: count }, (_, i) => formatNumber(series.prefix, series.padding, start + BigInt(i)));
}

// ── Persistence ───────────────────────────────────────────────────────────────

async function insertBills(
  prisma: PrismaClient,
  businessId: string,
  loc: DemoLocation,
  bills: PlannedBill[],
): Promise<void> {
  const rounds = bills
    .flatMap((b) => b.rounds.map((r) => ({ b, r })))
    .sort((x, y) => x.r.sentAt.getTime() - y.r.sentAt.getTime());
  const invoiceSlots = bills
    .flatMap((b) => [
      ...(b.voided ? [{ id: b.voided.invoiceId, at: b.voided.finalisedAt }] : []),
      { id: b.invoiceId, at: b.finalisedAt },
    ])
    .sort((x, y) => x.at.getTime() - y.at.getTime());

  await prisma.$transaction(
    async (tx) => {
      const requestNumbers = await reserveNumbers(tx, businessId, loc.id, 'service_request', rounds.length);
      const invoiceNumbers = await reserveNumbers(tx, businessId, loc.id, 'invoice', invoiceSlots.length);
      const reqNo = new Map(rounds.map(({ r }, i) => [r.id, requestNumbers[i]]));
      const invNo = new Map(invoiceSlots.map((s, i) => [s.id, invoiceNumbers[i]]));

      await tx.guestSession.createMany({
        data: bills.map((b) => ({
          id: b.sessionId,
          businessId,
          locationId: loc.id,
          diningTableId: b.tableId,
          partySize: b.partySize,
          status: 'CLOSED' as const,
          openedAt: b.openedAt,
          closedAt: b.closedAt,
          version: 2,
          createdAt: b.openedAt,
          updatedAt: b.closedAt,
        })),
      });

      await tx.serviceRequest.createMany({
        data: rounds.map(({ b, r }) => ({
          id: r.id,
          businessId,
          locationId: loc.id,
          sessionId: b.sessionId,
          roundNumber: r.roundNumber,
          requestNumber: reqNo.get(r.id)!,
          status: 'SERVED' as const,
          idempotencyKey: r.idempotencyKey,
          sentAt: r.sentAt,
          acceptedAt: r.acceptedAt,
          preparedAt: r.preparedAt,
          servedAt: r.servedAt,
          version: 6,
          createdAt: r.createdAt,
          updatedAt: r.servedAt,
        })),
      });

      const lines = rounds.flatMap(({ r }) => r.lines.map((l) => ({ r, l })));
      await tx.serviceRequestLine.createMany({
        data: lines.map(({ r, l }) => ({
          id: l.id,
          serviceRequestId: r.id,
          businessId,
          catalogItemId: l.catalogItemId,
          variantId: l.variantId,
          itemNameSnapshot: l.itemName,
          variantNameSnapshot: l.variantName,
          unitPriceMinorUnits: l.unitPrice,
          taxRateSnapshot: l.taxRate,
          taxCategoryNameSnapshot: l.taxName,
          quantity: l.quantity,
          kitchenNote: l.kitchenNote,
          status: 'SERVED' as const,
          createdAt: l.createdAt,
          updatedAt: r.servedAt,
        })),
      });
      const mods = lines.flatMap(({ l }) => l.modifiers.map((m) => ({ l, m })));
      if (mods.length > 0) {
        await tx.serviceRequestLineModifier.createMany({
          data: mods.map(({ l, m }) => ({
            id: m.id,
            lineId: l.id,
            businessId,
            modifierOptionId: m.optionId,
            optionNameSnapshot: m.name,
            priceAdjMinorUnits: m.adj,
          })),
        });
      }

      const invoices: Prisma.InvoiceCreateManyInput[] = [];
      const invoiceLines: Prisma.InvoiceLineCreateManyInput[] = [];
      const payments: Prisma.PaymentCreateManyInput[] = [];
      const refunds: Prisma.RefundCreateManyInput[] = [];

      for (const b of bills) {
        const totals = totalsFor(b);
        const invoiceRows = [
          ...(b.voided
            ? [{
                id: b.voided.invoiceId,
                status: 'VOIDED' as const,
                createdAt: b.voided.createdAt,
                finalisedAt: b.voided.finalisedAt,
                paidAt: null,
                voidedAt: b.voided.voidedAt,
                voidReason: b.voided.reason,
                updatedAt: b.voided.voidedAt,
              }]
            : []),
          {
            id: b.invoiceId,
            status: 'PAID' as const,
            createdAt: b.invoiceCreatedAt,
            finalisedAt: b.finalisedAt,
            paidAt: b.capturedAt,
            voidedAt: null,
            voidReason: null,
            updatedAt: b.capturedAt,
          },
        ];
        for (const inv of invoiceRows) {
          invoices.push({
            ...inv,
            businessId,
            locationId: loc.id,
            sessionId: b.sessionId,
            invoiceNumber: invNo.get(inv.id)!,
            currencyCode: 'INR',
            subtotalMinorUnits: totals.subtotalMinorUnits,
            totalTaxMinorUnits: totals.totalTaxMinorUnits,
            grandTotalMinorUnits: totals.grandTotalMinorUnits,
            taxBreakdown: totals.taxBreakdown as Prisma.InputJsonValue,
            version: 3,
          });
          totals.lines.forEach((l, i) => {
            invoiceLines.push({
              id: uuidFrom(`invoice-line/${inv.id}/${i}`),
              invoiceId: inv.id,
              businessId,
              serviceRequestLineId: l.serviceRequestLineId,
              itemNameSnapshot: l.itemNameSnapshot,
              variantNameSnapshot: l.variantNameSnapshot ?? null,
              modifiersSummary: l.modifiersSummary ?? null,
              quantity: l.quantity,
              unitPriceMinorUnits: l.unitPriceMinorUnits,
              modifiersMinorUnits: l.modifiersMinorUnits,
              taxRateSnapshot: l.taxRateSnapshot,
              taxCategoryName: l.taxCategoryName ?? null,
              lineSubtotalMinorUnits: l.lineSubtotalMinorUnits,
              lineTaxMinorUnits: l.lineTaxMinorUnits,
              lineTotalMinorUnits: l.lineTotalMinorUnits,
            });
          });
        }

        const total = totals.grandTotalMinorUnits;
        const cash = b.method === 'CASH' ? cashTendered(total, b.cashRoll) : null;
        payments.push({
          id: b.paymentId,
          businessId,
          locationId: loc.id,
          invoiceId: b.invoiceId,
          idempotencyKey: b.paymentIdempotencyKey,
          method: b.method,
          status: 'CAPTURED',
          amountMinorUnits: total,
          currencyCode: 'INR',
          cashReceivedMinorUnits: cash,
          changeMinorUnits: cash !== null ? cash - total : null,
          referenceCode: b.upiReference,
          providerTransactionId: b.upiReference,
          version: b.method === 'UPI' ? 2 : 1,
          createdAt: b.paymentCreatedAt,
          capturedAt: b.capturedAt,
          updatedAt: b.capturedAt,
        });

        if (b.refund) {
          // Refund one unit of the priciest line (tax-inclusive), cash → PROCESSED.
          const priciest = [...totals.lines].sort(
            (x, y) => y.lineTotalMinorUnits / y.quantity - x.lineTotalMinorUnits / x.quantity,
          )[0];
          const amount = Math.round(priciest.lineTotalMinorUnits / priciest.quantity);
          refunds.push({
            id: b.refund.id,
            businessId,
            paymentId: b.paymentId,
            reason: b.refund.reason,
            amountMinorUnits: Math.min(amount, total),
            status: 'PROCESSED',
            notes: `${priciest.itemNameSnapshot} × 1`,
            processedAt: b.refund.at,
            createdAt: b.refund.at,
            updatedAt: b.refund.at,
          });
        }
      }

      await tx.invoice.createMany({ data: invoices });
      await tx.invoiceLine.createMany({ data: invoiceLines });
      await tx.payment.createMany({ data: payments });
      if (refunds.length > 0) await tx.refund.createMany({ data: refunds });
    },
    { timeout: 120_000, maxWait: 30_000 },
  );
}

export interface HistoryResult {
  location: string;
  inserted: number;
  existing: number;
  days: number;
}

/**
 * Seed `days` days of history (today included) for one location. Returns how
 * many bills were inserted vs. already present.
 */
export async function seedHistory(
  prisma: PrismaClient,
  businessId: string,
  loc: DemoLocation,
  catalog: Catalog,
  now: Date,
  days = 14,
): Promise<HistoryResult> {
  // Sessions already in the DB occupy their tables; new history must not overlap them.
  const existingSessions = await prisma.guestSession.findMany({
    where: { businessId, locationId: loc.id },
    select: { id: true, diningTableId: true, openedAt: true, closedAt: true },
  });

  let inserted = 0;
  let existing = 0;
  const cutoff = now.getTime() - 60_000;

  for (let offset = -(days - 1); offset <= 0; offset++) {
    const date = istDate(now, offset);
    const dayIds = historySessionIds(loc.key, date);
    const presentIds = new Set(
      (
        await prisma.guestSession.findMany({
          where: { businessId, id: { in: [...dayIds] } },
          select: { id: true },
        })
      ).map((s) => s.id),
    );
    if (presentIds.size === dayIds.size) {
      existing += presentIds.size; // whole day already seeded
      continue;
    }
    // Every session already in the DB — real ones AND previously seeded demo
    // visits — is an obstacle, so bills added later (e.g. today's evening on a
    // re-run) can never double-book a table.
    const obstacles = new Map<string, Array<[number, number]>>();
    for (const s of existingSessions) {
      const list = obstacles.get(s.diningTableId) ?? [];
      list.push([s.openedAt.getTime(), s.closedAt?.getTime() ?? Number.POSITIVE_INFINITY]);
      obstacles.set(s.diningTableId, list);
    }
    const missing = planDay(catalog, loc, date, offset, obstacles).filter(
      (b) => !presentIds.has(b.sessionId) && b.closedAt.getTime() <= cutoff,
    );
    existing += presentIds.size;
    if (missing.length > 0) {
      await insertBills(prisma, businessId, loc, missing);
      inserted += missing.length;
    }
  }
  return { location: loc.name, inserted, existing, days };
}
