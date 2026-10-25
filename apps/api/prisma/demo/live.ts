/**
 * "Right now" demo state, written through the REAL services.
 *
 * Unlike history, these actions genuinely happen at seed time, so they go
 * through SessionService / OrderService / NumberingService / CostsService
 * exactly as the HTTP API would — including audit-chain appends (the Activity
 * page therefore shows them, and /admin/audit/verify stays valid).
 */
 
import { randomUUID } from 'node:crypto';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { AuditService } from '../../src/core/audit/audit.service';
import { NumberingService } from '../../src/core/numbering/numbering.service';
import { SessionService } from '../../src/restaurant/session/session.service';
import { OrderService } from '../../src/restaurant/order/order.service';
import { CostsService } from '../../src/costs/costs.service';
import type { TenantScope } from '../../src/common/tenant-scope';
import { closeSessionSchema, openSessionSchema } from '../../src/restaurant/session/session.dto';
import { createDraftSchema } from '../../src/restaurant/order/order.dto';
import type { DemoLocation } from './history';

export interface DemoServices {
  audit: AuditService;
  numbering: NumberingService;
  sessions: SessionService;
  orders: OrderService;
  costs: CostsService;
}

export function buildServices(db: PrismaService): DemoServices {
  const audit = new AuditService(db);
  const numbering = new NumberingService(db, audit);
  return {
    audit,
    numbering,
    sessions: new SessionService(db, audit),
    orders: new OrderService(db, audit, numbering),
    costs: new CostsService(db, audit),
  };
}

export async function userScope(
  db: PrismaService,
  businessId: string,
  email: string,
  locationId?: string,
): Promise<TenantScope> {
  const u = await db.user.findFirst({ where: { email, businessId } });
  if (!u) throw new Error(`Demo user ${email} not found`);
  return { businessId, locationId, actor: { type: 'USER', id: u.id, label: u.displayName } };
}

/** Configure a location's numbering prefix once, before anything is allocated. */
export async function ensureSeries(
  db: PrismaService,
  svc: DemoServices,
  scope: TenantScope,
  locationId: string,
  key: string,
  prefix: string,
  padding: number,
): Promise<'configured' | 'exists'> {
  const existing = await db.numberingSeries.findFirst({ where: { businessId: scope.businessId, locationId, key } });
  if (existing) return 'exists';
  await svc.numbering.configure(scope, key, { prefix, padding, locationId });
  return 'configured';
}

/**
 * Hand-made browser-test sessions left OPEN after their bill was PAID are
 * closed and their tables reset — via the real services (audited), never by
 * deleting anything. Sessions with an unpaid bill or open tickets are left as-is.
 */
export async function closePaidOpenSessions(
  db: PrismaService,
  svc: DemoServices,
  scope: TenantScope,
  locationId: string,
): Promise<string[]> {
  const open = await db.guestSession.findMany({
    where: { businessId: scope.businessId, locationId, status: 'OPEN' },
    include: {
      diningTable: { select: { code: true } },
      invoices: { where: { status: { not: 'VOIDED' } }, select: { status: true } },
    },
  });
  const closed: string[] = [];
  for (const s of open) {
    if (s.invoices.length !== 1 || s.invoices[0].status !== 'PAID') continue;
    await svc.sessions.closeSession(scope, s.id, closeSessionSchema.parse({}));
    await svc.sessions.resetTable(scope, s.diningTableId);
    closed.push(s.diningTable.code);
  }
  return closed;
}

interface LiveLine {
  item: string;
  variant?: string;
  modifiers?: string[];
  quantity: number;
  kitchenNote?: string;
}

async function resolveLines(db: PrismaService, businessId: string, lines: LiveLine[]) {
  const out = [];
  for (const l of lines) {
    const item = await db.catalogItem.findFirst({
      where: { businessId, name: l.item },
      include: { variants: true, modifierGroups: { include: { modifierGroup: { include: { options: true } } } } },
    });
    if (!item) throw new Error(`Catalog item ${l.item} missing`);
    const variant = l.variant ? item.variants.find((v) => v.name === l.variant) : undefined;
    const options = item.modifierGroups.flatMap((g) => g.modifierGroup.options);
    out.push({
      catalogItemId: item.id,
      ...(variant ? { variantId: variant.id } : {}),
      quantity: l.quantity,
      ...(l.kitchenNote ? { kitchenNote: l.kitchenNote } : {}),
      modifiers: (l.modifiers ?? []).map((name) => {
        const o = options.find((x) => x.name === name);
        if (!o) throw new Error(`Modifier ${name} missing on ${l.item}`);
        return { modifierOptionId: o.id };
      }),
    });
  }
  return out;
}

type Stage = 'SENT' | 'ACCEPTED' | 'PREPARING' | 'READY';

/**
 * Open two Riverside tables with kitchen tickets at different stages.
 * Idempotent: skipped while the location already has any OPEN session.
 * Only zero-priced modifiers are used here (see report: priced modifiers are
 * double-counted by OrderService.resolveLineSnapshots + computeTotals).
 */
export async function openLiveTables(
  db: PrismaService,
  svc: DemoServices,
  waiter: TenantScope,
  kitchen: TenantScope,
  loc: DemoLocation,
): Promise<string[]> {
  const openCount = await db.guestSession.count({
    where: { businessId: waiter.businessId, locationId: loc.id, status: 'OPEN' },
  });
  if (openCount > 0) return [];

  const plan: Array<{ table: string; party: number; rounds: Array<{ stage: Stage; lines: LiveLine[] }> }> = [
    {
      table: 'R3',
      party: 4,
      rounds: [
        {
          stage: 'PREPARING',
          lines: [
            { item: 'Paneer Tikka', variant: 'Full (8 pcs)', modifiers: ['Medium', 'Chopped onion'], quantity: 1 },
            { item: 'Dal Makhani', variant: 'Full', modifiers: ['Mild'], quantity: 1 },
            { item: 'Paneer Butter Masala', modifiers: ['Hot'], quantity: 1, kitchenNote: 'Less oil please' },
            { item: 'Butter Naan', quantity: 5 },
            { item: 'Lassi', quantity: 2 },
          ],
        },
        { stage: 'SENT', lines: [{ item: 'Jeera Rice', quantity: 1 }, { item: 'Cold Coffee', variant: 'Regular', modifiers: ['Less sugar'], quantity: 2 }] },
      ],
    },
    {
      table: 'G1',
      party: 2,
      rounds: [
        {
          stage: 'READY',
          lines: [
            { item: 'Spring Rolls', quantity: 1 },
            { item: 'Paneer Butter Masala', modifiers: ['Medium'], quantity: 1 },
            { item: 'Butter Naan', quantity: 3 },
          ],
        },
      ],
    },
  ];

  const opened: string[] = [];
  for (const p of plan) {
    const table = loc.tables.find((t) => t.code === p.table);
    if (!table) continue;
    const tableRow = await db.diningTable.findUnique({ where: { id: table.id } });
    if (tableRow?.status !== 'AVAILABLE') continue;

    const session = await svc.sessions.openSession(
      waiter,
      openSessionSchema.parse({ locationId: loc.id, diningTableId: table.id, partySize: p.party }),
    );
    for (const r of p.rounds) {
      // Same zod schema the HTTP controller validates with.
      const draft = await svc.orders.createDraft(
        waiter,
        createDraftSchema.parse({
          sessionId: session.id,
          idempotencyKey: randomUUID(),
          lines: await resolveLines(db, waiter.businessId, r.lines),
        }),
      );
      await svc.orders.sendToKitchen(waiter, draft.id, {});
      if (r.stage === 'SENT') continue;
      await svc.orders.acceptRequest(kitchen, draft.id);
      if (r.stage === 'ACCEPTED') continue;
      await svc.orders.startPreparation(kitchen, draft.id);
      if (r.stage === 'PREPARING') continue;
      await svc.orders.markReady(kitchen, draft.id);
    }
    opened.push(`${p.table} (${p.rounds.map((r) => r.stage).join(' + ')})`);
  }
  return opened;
}
