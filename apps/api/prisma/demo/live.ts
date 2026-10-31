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
import { RealtimeBus } from '../../src/realtime/realtime.bus';
import { SessionService } from '../../src/restaurant/session/session.service';
import { OrderService } from '../../src/restaurant/order/order.service';
import { CostsService } from '../../src/costs/costs.service';
import { InvoiceService } from '../../src/checkout/invoice/invoice.service';
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
  invoices: InvoiceService;
}

export function buildServices(db: PrismaService): DemoServices {
  const audit = new AuditService(db);
  const numbering = new NumberingService(db, audit);
  return {
    audit,
    numbering,
    // The bus has no subscribers in a one-shot script; it only has to exist (SessionService publishes to it, ADR-032).
    sessions: new SessionService(db, audit, new RealtimeBus()),
    orders: new OrderService(db, audit, numbering),
    costs: new CostsService(db, audit),
    invoices: new InvoiceService(db, audit, numbering),
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

/** Marker stored in GuestSession.notes: this session belongs to the "live now" scenario. */
export const LIVE_MARKER = 'demo:live-scenario';
/** Any open session older than this that is NOT a live-scenario session is stale. */
export const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

const minutesAgo = (now: Date, m: number) => new Date(now.getTime() - m * 60_000);

/**
 * Retire open sessions through the real services (audited, never deleted):
 *   - live-scenario sessions (LIVE_MARKER): always, so the scenario is rebuilt
 *     relative to NOW on every run;
 *   - any other session OPEN for more than 6 hours (forgotten test sessions).
 * Per session: cancel unsent/unaccepted rounds, serve cooking/ready rounds,
 * void a non-paid invoice, close the session and reset its table. Sessions
 * younger than 6h that are not live-scenario sessions are left untouched.
 */
export async function retireStaleSessions(
  db: PrismaService,
  svc: DemoServices,
  scope: TenantScope,
  now: Date,
): Promise<string[]> {
  const open = await db.guestSession.findMany({
    where: { businessId: scope.businessId, status: 'OPEN' },
    include: {
      diningTable: { select: { code: true } },
      serviceRequests: { select: { id: true, status: true } },
      invoices: { where: { status: { notIn: ['VOIDED', 'PAID'] } }, select: { id: true } },
    },
  });
  const retired: string[] = [];
  for (const s of open) {
    const isLive = s.notes === LIVE_MARKER;
    const stale = now.getTime() - s.openedAt.getTime() > STALE_AFTER_MS;
    if (!isLive && !stale) continue;
    const reason = isLive ? 'Demo live scenario refreshed' : 'Stale demo session cleaned up';
    for (const r of s.serviceRequests) {
      if (r.status === 'DRAFT' || r.status === 'SENT' || r.status === 'ACCEPTED') {
        await svc.orders.cancelRequest(scope, r.id, { reason });
      } else if (r.status === 'PREPARING') {
        await svc.orders.markReady(scope, r.id);
        await svc.orders.markServed(scope, r.id);
      } else if (r.status === 'READY') {
        await svc.orders.markServed(scope, r.id);
      }
    }
    for (const inv of s.invoices) {
      await svc.invoices.voidInvoice(scope, inv.id, { reason });
    }
    const hasServed = s.serviceRequests.some((r) => r.status === 'PREPARING' || r.status === 'READY' || r.status === 'SERVED');
    const hasPaid = (await db.invoice.count({ where: { sessionId: s.id, status: 'PAID' } })) > 0;
    if (!hasServed && !hasPaid) {
      // Nothing was served: a void is the accurate record (cancelled rounds are allowed).
      await svc.sessions.voidSession(scope, s.id, { reason });
    } else {
      await svc.sessions.closeSession(scope, s.id, closeSessionSchema.parse({}));
      await svc.sessions.resetTable(scope, s.diningTableId);
    }
    retired.push(`${s.diningTable.code}${isLive ? ' (live)' : ' (stale)'}`);
  }
  return retired;
}

/**
 * Seat three tables with kitchen tickets at different stages, timed relative
 * to NOW: seated 12-50 minutes ago, tickets 3-14 minutes old. Real services do
 * the work; afterwards the timestamps are shifted back (the services stamp "now").
 * Call retireStaleSessions() first - it clears the previous run's scenario.
 */
export async function openLiveTables(
  db: PrismaService,
  svc: DemoServices,
  waiter: TenantScope,
  kitchen: TenantScope,
  locs: { main: DemoLocation; riverside: DemoLocation },
  now: Date,
): Promise<string[]> {
  interface Round { stage: Stage; ageMin: number; lines: LiveLine[] }
  interface Plan { loc: DemoLocation; table: string; party: number; seatedMin: number; rounds: Round[] }
  const plan: Plan[] = [
    {
      loc: locs.riverside,
      table: 'R3',
      party: 4,
      seatedMin: 50,
      rounds: [
        {
          stage: 'PREPARING',
          ageMin: 14,
          lines: [
            { item: 'Paneer Tikka', variant: 'Full (8 pcs)', modifiers: ['Medium', 'Chopped onion'], quantity: 1 },
            { item: 'Dal Makhani', variant: 'Full', modifiers: ['Mild'], quantity: 1 },
            { item: 'Paneer Butter Masala', modifiers: ['Hot'], quantity: 1, kitchenNote: 'Less oil please' },
            { item: 'Butter Naan', quantity: 5 },
            { item: 'Lassi', quantity: 2 },
          ],
        },
        { stage: 'SENT', ageMin: 3, lines: [{ item: 'Jeera Rice', quantity: 1 }, { item: 'Cold Coffee', variant: 'Regular', modifiers: ['Less sugar'], quantity: 2 }] },
      ],
    },
    {
      loc: locs.riverside,
      table: 'G1',
      party: 2,
      seatedMin: 31,
      rounds: [
        {
          stage: 'READY',
          ageMin: 9,
          lines: [
            { item: 'Spring Rolls', quantity: 1 },
            { item: 'Paneer Butter Masala', modifiers: ['Medium'], quantity: 1 },
            { item: 'Butter Naan', quantity: 3 },
          ],
        },
      ],
    },
    {
      loc: locs.main,
      table: 'T3',
      party: 3,
      seatedMin: 12,
      rounds: [{ stage: 'ACCEPTED', ageMin: 6, lines: [{ item: 'Spring Rolls', quantity: 2 }, { item: 'Lassi', quantity: 3 }] }],
    },
  ];

  const opened: string[] = [];
  for (const p of plan) {
    const table = p.loc.tables.find((t) => t.code === p.table);
    if (!table) continue;
    const tableRow = await db.diningTable.findUnique({ where: { id: table.id } });
    if (tableRow?.status !== 'AVAILABLE') continue; // a real, fresher session is using it

    const session = await svc.sessions.openSession(
      waiter,
      openSessionSchema.parse({ locationId: p.loc.id, diningTableId: table.id, partySize: p.party, notes: LIVE_MARKER }),
    );
    const seatedAt = minutesAgo(now, p.seatedMin);
    await db.guestSession.update({ where: { id: session.id }, data: { openedAt: seatedAt, createdAt: seatedAt } });

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
      if (r.stage !== 'SENT') await svc.orders.acceptRequest(kitchen, draft.id);
      if (r.stage === 'PREPARING' || r.stage === 'READY') await svc.orders.startPreparation(kitchen, draft.id);
      if (r.stage === 'READY') await svc.orders.markReady(kitchen, draft.id);

      // Spread the stage timestamps over the ticket's age (sent -> accepted -> cooking -> ready).
      const sentAt = minutesAgo(now, r.ageMin);
      const step = (r.ageMin * 60_000) / 4;
      const at = (n: number) => new Date(sentAt.getTime() + step * n);
      await db.serviceRequest.update({
        where: { id: draft.id },
        data: {
          createdAt: new Date(sentAt.getTime() - 60_000),
          sentAt,
          ...(r.stage !== 'SENT' ? { acceptedAt: at(1) } : {}),
          ...(r.stage === 'READY' ? { preparedAt: at(3) } : {}),
        },
      });
    }
    opened.push(`${p.loc.name} ${p.table} (${p.rounds.map((r) => r.stage).join(' + ')}, seated ${p.seatedMin}m ago)`);
  }
  return opened;
}
