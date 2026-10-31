import { Injectable } from '@nestjs/common';
import {
  GuestSessionStatus,
  InvoiceStatus,
  Prisma,
  ServiceLineStatus,
  ServiceRequestStatus,
  type ServiceRequestEdit,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictError, NotFoundError, ValidationError, VersionConflictError } from '../../common/errors';
import { TenantScopedRepository } from '../../common/tenant-scoped.repository';
import { AuditService } from '../../core/audit/audit.service';
import type { TenantScope } from '../../common/tenant-scope';
import { OrderService, type LineSnapshot } from './order.service';
import type { EditOrderDto } from './order-edit.dto';
import {
  type EditLockReason,
  type EditableLine,
  type PlannedOp,
  activeTotal,
  assertEditable,
  editLockReason,
  lockMessage,
  planEdit,
} from './order-edit.plan';

const WITH_LINES = {
  lines: { include: { modifiers: true }, orderBy: { createdAt: 'asc' as const } },
} satisfies Prisma.ServiceRequestInclude;

type RequestWithLines = Prisma.ServiceRequestGetPayload<{ include: typeof WITH_LINES }>;

export type EditResult = RequestWithLines & { edit: { id: string; editNumber: number; replayed: boolean } };

/** Thrown inside the transaction when the idempotency key turns out to be applied already. */
class ReplayHit extends Error {
  constructor(readonly edit: ServiceRequestEdit) {
    super('replay');
  }
}

export interface EditableState {
  allowed: boolean;
  reason?: EditLockReason;
  message?: string;
}

/**
 * Edit a service request before the kitchen starts it (update round 2, A2).
 *
 * Guarantees:
 *  - state guard (see order-edit.plan.ts): DRAFT/SENT only, nothing past PENDING, open session, no live invoice;
 *  - optimistic concurrency (ADR-017): `expectedVersion` is required and compared on fresh, row-locked data;
 *  - idempotency (ADR-017): `idempotencyKey` is unique per business; a replay returns the current order with
 *    `edit.replayed = true` and changes nothing, including when two identical requests race;
 *  - append-only history (ADR-016): every accepted edit adds one `service_request_edit` row (never updated or
 *    deleted) plus one hash-chained audit event, in the same transaction as the change;
 *  - no silent mutation of financial snapshots: a removed line is CANCELLED (kept, with a reason), a re-priced
 *    line is cancelled and replaced by a newly snapshotted line, quantity/notes change in place with the
 *    before/after recorded;
 *  - prices are always recomputed server-side from the live catalog (OrderService.resolveLineSnapshots).
 *
 * Lock order matches the kitchen transitions (lines first, then the request row, then the audit lock) so a
 * concurrent "Accept" and "Edit" serialise instead of deadlocking; whichever commits second re-validates.
 */
@Injectable()
export class OrderEditService extends TenantScopedRepository {
  constructor(
    prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly orders: OrderService,
  ) {
    super(prisma);
  }

  /** Can this order be edited right now, and the edit history so far (oldest first). */
  async getEditState(scope: TenantScope, id: string): Promise<{ editable: EditableState; edits: ServiceRequestEdit[] }> {
    const request = await this.orders.findRequestOrThrow(scope, id);
    const ctx = await this.context(this.prisma, scope, request.sessionId);
    const reason = editLockReason(request, ctx);
    const edits = await this.prisma.serviceRequestEdit.findMany({
      where: this.scoped(scope, { serviceRequestId: id }),
      orderBy: { editNumber: 'asc' },
    });
    return {
      editable: reason ? { allowed: false, reason, message: lockMessage(reason) } : { allowed: true },
      edits,
    };
  }

  async editOrder(scope: TenantScope, id: string, dto: EditOrderDto): Promise<EditResult> {
    // 1. Replay fast path: an already-applied key never re-validates (the order may have moved on since).
    const prior = await this.findByKey(this.prisma, scope, dto.idempotencyKey);
    if (prior) return this.replay(scope, id, prior);

    // 2. Pre-flight on a plain read: 404 / locked / stale before any pricing work.
    const request = await this.orders.findRequestOrThrow(scope, id);
    assertEditable(request, await this.context(this.prisma, scope, request.sessionId), { id });
    this.assertVersion(dto.expectedVersion, request);
    const plan = planEdit(request.lines as EditableLine[], dto.ops);
    const notesChanged = dto.notes !== undefined && (dto.notes ?? null) !== (request.notes ?? null);
    if (plan.ops.length === 0 && !notesChanged) {
      throw new ValidationError('Nothing to change: the edit matches the order as it is', { reason: 'NO_CHANGES' });
    }

    // 3. Re-price additions / re-configured lines from the live catalog (server-side only).
    const snapshots = new Map<number, LineSnapshot>();
    if (plan.needsSnapshot.length > 0) {
      const resolved = await this.orders.resolveLineSnapshots(
        scope,
        plan.needsSnapshot.map((n) => n.input),
      );
      plan.needsSnapshot.forEach((n, i) => snapshots.set(n.opIndex, resolved[i] as LineSnapshot));
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Row locks first (same order as the kitchen transitions): lines, then the request.
        await tx.$queryRaw`SELECT id FROM service_request_line WHERE "serviceRequestId" = ${id}::uuid FOR UPDATE`;

        const dup = await this.findByKey(tx, scope, dto.idempotencyKey);
        if (dup) throw new ReplayHit(dup);

        const fresh = await tx.serviceRequest.findFirst({ where: this.scoped(scope, { id }), include: WITH_LINES });
        if (!fresh) throw new NotFoundError('Service request not found', { id });
        assertEditable(fresh, await this.context(tx, scope, fresh.sessionId), { id });
        this.assertVersion(dto.expectedVersion, fresh);

        // Same ops against the locked lines. Planning is deterministic, so the snapshots above still match.
        const freshPlan = planEdit(fresh.lines as EditableLine[], dto.ops);
        if (freshPlan.ops.length !== plan.ops.length || freshPlan.ops.some((o, i) => o.kind !== plan.ops[i]?.kind)) {
          throw new VersionConflictError('Service request was modified concurrently', {
            expectedVersion: dto.expectedVersion,
            actualVersion: fresh.version,
          });
        }

        const now = new Date();
        const kitchenVisible = fresh.status === ServiceRequestStatus.SENT;
        const totalBefore = activeTotal(fresh.lines);
        const changes: Record<string, unknown>[] = [];
        const byId = new Map(fresh.lines.map((l) => [l.id, l]));

        for (const op of freshPlan.ops) {
          await this.applyOp(tx, scope, fresh, byId, op, snapshots, now, kitchenVisible, changes);
        }

        let notesAfter = fresh.notes;
        if (dto.notes !== undefined && (dto.notes ?? null) !== (fresh.notes ?? null)) {
          notesAfter = dto.notes ?? null;
          changes.push({ op: 'notes', before: fresh.notes ?? null, after: notesAfter });
        }

        const lock = await tx.serviceRequest.updateMany({
          where: { id, businessId: scope.businessId, version: fresh.version },
          data: {
            version: { increment: 1 },
            notes: notesAfter,
            ...(kitchenVisible ? { editCount: { increment: 1 }, lastEditedAt: now } : {}),
          },
        });
        if (lock.count !== 1) {
          throw new VersionConflictError('Service request was modified concurrently', {
            expectedVersion: dto.expectedVersion,
            actualVersion: fresh.version + 1,
          });
        }

        const updated = await tx.serviceRequest.findFirstOrThrow({ where: this.scoped(scope, { id }), include: WITH_LINES });
        const totalAfter = activeTotal(updated.lines);
        const editNumber = (await tx.serviceRequestEdit.count({ where: { serviceRequestId: id } })) + 1;

        const edit = await tx.serviceRequestEdit.create({
          data: {
            businessId: scope.businessId,
            locationId: fresh.locationId,
            serviceRequestId: id,
            idempotencyKey: dto.idempotencyKey,
            editNumber,
            fromVersion: fresh.version,
            toVersion: updated.version,
            statusAtEdit: fresh.status,
            actorType: scope.actor.type,
            actorId: scope.actor.id ?? null,
            actorLabel: scope.actor.label,
            reason: dto.reason ?? null,
            changes: changes as Prisma.InputJsonValue,
            totalBeforeMinorUnits: totalBefore,
            totalAfterMinorUnits: totalAfter,
          },
        });

        await this.audit.append(tx, scope, {
          action: 'service_request.edited',
          resourceType: 'service_request',
          resourceId: id,
          locationId: fresh.locationId,
          metadata: {
            editId: edit.id,
            editNumber,
            statusAtEdit: fresh.status,
            fromVersion: fresh.version,
            toVersion: updated.version,
            kitchenVisible,
            changeCount: changes.length,
            totalBeforeMinorUnits: totalBefore,
            totalAfterMinorUnits: totalAfter,
            ...(dto.reason ? { reason: dto.reason } : {}),
          },
        });

        return Object.assign(updated, { edit: { id: edit.id, editNumber, replayed: false } }) as EditResult;
      });
    } catch (e) {
      // Another identical request committed while this one waited for the row locks.
      if (e instanceof ReplayHit) return this.replay(scope, id, e.edit);
      // Two identical requests raced past both replay checks; the unique key kept exactly one.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const winner = await this.findByKey(this.prisma, scope, dto.idempotencyKey);
        if (winner) return this.replay(scope, id, winner);
      }
      throw e;
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private assertVersion(expected: number, row: { version: number; status: ServiceRequestStatus }): void {
    if (expected !== row.version) {
      throw new VersionConflictError('This order was changed by someone else. Reload it and try again.', {
        expectedVersion: expected,
        actualVersion: row.version,
        status: row.status,
      });
    }
  }

  private async context(
    db: Prisma.TransactionClient | PrismaService,
    scope: TenantScope,
    sessionId: string,
  ): Promise<{ sessionOpen: boolean; invoiceExists: boolean }> {
    const [session, invoice] = await Promise.all([
      db.guestSession.findFirst({ where: this.scoped(scope, { id: sessionId }), select: { status: true } }),
      db.invoice.findFirst({
        where: this.scoped(scope, { sessionId, status: { not: InvoiceStatus.VOIDED } }),
        select: { id: true },
      }),
    ]);
    return { sessionOpen: session?.status === GuestSessionStatus.OPEN, invoiceExists: !!invoice };
  }

  private findByKey(db: Prisma.TransactionClient | PrismaService, scope: TenantScope, key: string) {
    return db.serviceRequestEdit.findFirst({ where: this.scoped(scope, { idempotencyKey: key }) });
  }

  private async replay(scope: TenantScope, id: string, prior: ServiceRequestEdit): Promise<EditResult> {
    if (prior.serviceRequestId !== id) {
      throw new ConflictError('This idempotency key was already used for a different order', {
        reason: 'IDEMPOTENCY_KEY_REUSED',
      });
    }
    const current = await this.orders.findRequestOrThrow(scope, id);
    return Object.assign(current, { edit: { id: prior.id, editNumber: prior.editNumber, replayed: true } }) as EditResult;
  }

  private async applyOp(
    tx: Prisma.TransactionClient,
    scope: TenantScope,
    request: RequestWithLines,
    byId: Map<string, RequestWithLines['lines'][number]>,
    op: PlannedOp,
    snapshots: Map<number, LineSnapshot>,
    now: Date,
    kitchenVisible: boolean,
    changes: Record<string, unknown>[],
  ): Promise<void> {
    const mark = (kind: 'ADDED' | 'CHANGED') => (kitchenVisible ? { editedAt: now, editKind: kind } : {});
    const lineView = (l: { itemNameSnapshot: string; variantNameSnapshot: string | null; quantity: number; unitPriceMinorUnits: number; notes: string | null; kitchenNote?: string | null; modifiers: { optionNameSnapshot: string }[] }) => ({
      item: l.itemNameSnapshot,
      variant: l.variantNameSnapshot,
      options: l.modifiers.map((m) => m.optionNameSnapshot),
      quantity: l.quantity,
      unitPriceMinorUnits: l.unitPriceMinorUnits,
      notes: l.notes,
      kitchenNote: l.kitchenNote ?? null,
    });

    const createLine = async (snap: LineSnapshot, kind: 'ADDED' | 'CHANGED') =>
      tx.serviceRequestLine.create({
        data: {
          serviceRequestId: request.id,
          businessId: scope.businessId,
          catalogItemId: snap.catalogItemId,
          variantId: snap.variantId ?? null,
          itemNameSnapshot: snap.itemNameSnapshot,
          variantNameSnapshot: snap.variantNameSnapshot ?? null,
          unitPriceMinorUnits: snap.unitPriceMinorUnits,
          taxRateSnapshot: snap.taxRateSnapshot,
          taxCategoryNameSnapshot: snap.taxCategoryNameSnapshot ?? null,
          quantity: snap.quantity,
          notes: snap.notes ?? null,
          kitchenNote: snap.kitchenNote ?? null,
          ...mark(kind),
          modifiers: {
            create: snap.modifiers.map((m) => ({
              businessId: scope.businessId,
              modifierOptionId: m.modifierOptionId,
              optionNameSnapshot: m.optionNameSnapshot,
              priceAdjMinorUnits: m.priceAdjMinorUnits,
            })),
          },
        },
        include: { modifiers: true },
      });

    if (op.kind === 'add') {
      const snap = snapshots.get(op.opIndex) as LineSnapshot;
      const line = await createLine(snap, 'ADDED');
      changes.push({ op: 'add', lineId: line.id, ...lineView(line) });
      return;
    }

    const existing = byId.get(op.lineId) as RequestWithLines['lines'][number];

    if (op.kind === 'remove') {
      await tx.serviceRequestLine.update({
        where: { id: existing.id },
        data: { status: ServiceLineStatus.CANCELLED, cancelReason: 'Removed by order edit', version: { increment: 1 }, ...mark('CHANGED') },
      });
      changes.push({ op: 'remove', lineId: existing.id, ...lineView(existing) });
      return;
    }

    if (op.kind === 'reconfigure') {
      const snap = snapshots.get(op.opIndex) as LineSnapshot;
      await tx.serviceRequestLine.update({
        where: { id: existing.id },
        data: { status: ServiceLineStatus.CANCELLED, cancelReason: 'Replaced by order edit', version: { increment: 1 }, ...mark('CHANGED') },
      });
      const line = await createLine(snap, 'CHANGED');
      changes.push({ op: 'reconfigure', fromLineId: existing.id, toLineId: line.id, before: lineView(existing), after: lineView(line) });
      return;
    }

    // update in place: quantity / notes / kitchenNote only
    const before = { quantity: existing.quantity, notes: existing.notes, kitchenNote: existing.kitchenNote };
    const data: Prisma.ServiceRequestLineUpdateInput = { version: { increment: 1 }, ...mark('CHANGED') };
    if (op.quantity !== undefined) data.quantity = op.quantity;
    if (op.notes !== undefined) data.notes = op.notes;
    if (op.kitchenNote !== undefined) data.kitchenNote = op.kitchenNote;
    const row = await tx.serviceRequestLine.update({ where: { id: existing.id }, data });
    changes.push({
      op: 'update',
      lineId: existing.id,
      item: existing.itemNameSnapshot,
      variant: existing.variantNameSnapshot,
      before,
      after: { quantity: row.quantity, notes: row.notes, kitchenNote: row.kitchenNote },
    });
  }
}
