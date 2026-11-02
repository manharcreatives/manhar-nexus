import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ServiceRequestStatus } from '@prisma/client';
import type { Subscription } from 'rxjs';
import { DomainError } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeBus } from '../realtime/realtime.bus';
import type { RealtimeTopic } from '../realtime/realtime.types';
import { GuestOrderService } from './guest-order.service';
import { guestStatusOf } from './guest-status';
import { caps } from './guestmenu.config';
import { fingerprint } from './guestmenu.tokens';
import { MenuService } from './menu.service';
import { TableContextService } from './table-context.service';

/** A live guest stream. `write` must never throw. */
export interface HubConn {
  id: number;
  businessId: string;
  tableId: string;
  token: string;
  write(event: string, data: unknown): void;
  end(): void;
  snap?: TableSnap;
}

interface TableSnap {
  open: boolean;
  menuEtag: string;
  orders: Map<string, string>;
  billSig: string;
  /** Id of the table's newest OPEN waiter call ('' = none). A different id = a new call. */
  callId: string;
}

/** Bus topics that can change what a guest sees. */
const RELEVANT: ReadonlySet<RealtimeTopic> = new Set<RealtimeTopic>(['orders', 'kitchen', 'tables', 'sessions', 'invoices', 'payments']);

/**
 * Fan-out of live changes to guest streams (SSE). The staff app already publishes "something changed" events on the
 * RealtimeBus (ADR-032); this hub listens per business ONLY while a guest stream is open, debounces bursts, recomputes a
 * small PUBLIC-SAFE snapshot per table and sends just the differences:
 *
 *   menu.changed {etag}   table.updated {open}   order.updated {orderId,status}   bill.updated {}   waiter.call {}   waiter.ack {}
 *
 * Events are hints: they carry ids and statuses only, never names, items or amounts, because a stream is addressed by the
 * table token alone (EventSource cannot send the guest token). The page re-reads /state with its guest token.
 *
 * Menu edits made through this API process call notifyMenu() directly. A slow safety sweep (every 25 s) also compares
 * snapshots, so a change made on another API instance still reaches open streams within seconds.
 */
@Injectable()
export class GuestHub implements OnModuleDestroy {
  private readonly log = new Logger(GuestHub.name);
  private readonly conns = new Map<string, Set<HubConn>>();
  private readonly subs = new Map<string, Subscription>();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly sweeper: NodeJS.Timeout;
  private seq = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly bus: RealtimeBus,
    private readonly contexts: TableContextService,
    private readonly menu: MenuService,
    private readonly orders: GuestOrderService,
  ) {
    this.sweeper = setInterval(() => {
      for (const businessId of this.conns.keys()) this.schedule(businessId);
    }, 25_000);
    this.sweeper.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.sweeper);
    for (const t of this.timers.values()) clearTimeout(t);
    for (const s of this.subs.values()) s.unsubscribe();
    this.subs.clear();
    this.timers.clear();
  }

  nextId(): number {
    this.seq += 1;
    return this.seq;
  }

  connectionCount(): number {
    let n = 0;
    for (const set of this.conns.values()) n += set.size;
    return n;
  }

  /** Registers a stream; returns the unregister function. The first snapshot is taken immediately (no diff is sent for it). */
  register(conn: HubConn): () => void {
    let set = this.conns.get(conn.businessId);
    if (!set) {
      set = new Set();
      this.conns.set(conn.businessId, set);
    }
    set.add(conn);
    if (!this.subs.has(conn.businessId)) {
      this.subs.set(
        conn.businessId,
        this.bus.subscribe(conn.businessId).subscribe((ev) => {
          if (RELEVANT.has(ev.topic)) this.schedule(conn.businessId);
        }),
      );
    }
    void this.baseline(conn);
    return () => {
      const cur = this.conns.get(conn.businessId);
      cur?.delete(conn);
      if (cur && cur.size === 0) {
        this.conns.delete(conn.businessId);
        this.subs.get(conn.businessId)?.unsubscribe();
        this.subs.delete(conn.businessId);
        const t = this.timers.get(conn.businessId);
        if (t) clearTimeout(t);
        this.timers.delete(conn.businessId);
      }
    };
  }

  /** In-process menu/policy edit: drop caches and push `menu.changed` to this business's open streams. */
  notifyMenu(businessId: string): void {
    this.menu.invalidate(businessId);
    this.contexts.invalidateBusiness(businessId);
    this.schedule(businessId);
  }

  /** Ends every stream opened with this table token (token rotated / table disabled). */
  dropToken(token: string): void {
    for (const set of this.conns.values()) {
      for (const c of [...set]) {
        if (c.token === token) {
          c.write('bye', { reason: 'token-changed' });
          c.end();
        }
      }
    }
  }

  private schedule(businessId: string): void {
    if (!this.conns.has(businessId) || this.timers.has(businessId)) return;
    this.timers.set(
      businessId,
      setTimeout(() => {
        this.timers.delete(businessId);
        void this.flush(businessId);
      }, caps.hubDebounceMs()),
    );
  }

  private async baseline(conn: HubConn): Promise<void> {
    try {
      const ctx = await this.contexts.resolve(conn.token);
      conn.snap = await this.snapshot(ctx);
    } catch {
      /* the first flush will sort it out */
    }
  }

  private async flush(businessId: string): Promise<void> {
    const set = this.conns.get(businessId);
    if (!set || set.size === 0) return;
    const byToken = new Map<string, HubConn[]>();
    for (const c of set) byToken.set(c.token, [...(byToken.get(c.token) ?? []), c]);

    for (const [token, list] of byToken) {
      try {
        const ctx = await this.contexts.resolve(token);
        const snap = await this.snapshot(ctx);
        for (const c of list) {
          if (c.snap) this.diff(c, c.snap, snap);
          c.snap = snap;
        }
      } catch (err) {
        if (err instanceof DomainError) {
          // Token rotated, table or menu switched off: tell the page to re-read the menu (it will see 404/403) and let go.
          for (const c of list) {
            c.write('menu.changed', { etag: '' });
            c.write('bye', { reason: 'unavailable' });
            c.end();
          }
        } else {
          this.log.warn(`guest stream flush failed: ${(err as Error).message}`);
        }
      }
    }
  }

  private async snapshot(ctx: Awaited<ReturnType<TableContextService['resolve']>>): Promise<TableSnap> {
    const session = await this.contexts.openSession(ctx);
    const open = !!session;
    const [menuEtag, requests, bill, call] = await Promise.all([
      this.menu.etagFor(ctx, open),
      session
        ? this.prisma.serviceRequest.findMany({
            where: { businessId: ctx.businessId, sessionId: session.id },
            select: { id: true, status: true, editCount: true, version: true, guestOrder: { select: { decision: true } } },
            take: 200,
          })
        : Promise.resolve([]),
      session ? this.orders.bill(ctx, session.id) : Promise.resolve(null),
      this.orders.openCall(ctx.tableId),
    ]);
    const orders = new Map<string, string>();
    for (const r of requests) {
      if (r.status === ServiceRequestStatus.DRAFT && !r.guestOrder) continue; // a waiter's private draft
      // status:editCount:version. A waiter's edit BEFORE confirmation (a DRAFT) changes lines, note and total but neither
      // the guest status nor editCount (that one only counts kitchen-visible edits), so the row version is part of the
      // signature: every edit bumps it and the guest page re-reads /state at once. The event payload keeps only the status.
      orders.set(r.id, `${guestStatusOf(r)}:${r.editCount}:${r.version}`);
    }
    return { open, menuEtag, orders, billSig: fingerprint(bill), callId: call?.id ?? '' };
  }

  private diff(c: HubConn, before: TableSnap, after: TableSnap): void {
    if (before.menuEtag !== after.menuEtag) c.write('menu.changed', { etag: after.menuEtag });
    if (before.open !== after.open) c.write('table.updated', { open: after.open });
    for (const [id, sig] of after.orders) {
      if (before.orders.get(id) !== sig) c.write('order.updated', { orderId: id, status: sig.split(':')[0] });
    }
    if (before.billSig !== after.billSig) c.write('bill.updated', {});
    if (after.callId && before.callId !== after.callId) c.write('waiter.call', {});
    else if (before.callId && !after.callId) c.write('waiter.ack', {});
  }
}
