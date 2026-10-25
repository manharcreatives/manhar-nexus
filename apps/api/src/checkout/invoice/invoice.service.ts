import { Injectable } from '@nestjs/common';
import { Prisma, GuestSessionStatus, InvoiceStatus, type Invoice } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictError, NotFoundError, ValidationError, VersionConflictError } from '../../common/errors';
import { TenantScopedRepository } from '../../common/tenant-scoped.repository';
import { AuditService } from '../../core/audit/audit.service';
import { NumberingService } from '../../core/numbering/numbering.service';
import type { TenantScope } from '../../common/tenant-scope';
import type { Principal } from '../../iam/principal';
import type { CreateInvoiceDto, FinaliseInvoiceDto, ListInvoicesQuery, VoidInvoiceDto } from './invoice.dto';

const INVOICE_WITH_LINES = {
  lines: { orderBy: { itemNameSnapshot: 'asc' as const } },
  payments: { orderBy: { createdAt: 'desc' as const } },
} satisfies Prisma.InvoiceInclude;

interface TaxBreakdownEntry {
  name: string;
  rate: number;
  taxableAmountMinorUnits: number;
  taxAmountMinorUnits: number;
}

interface InvoiceLineData {
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
}

interface InvoiceTotals {
  subtotalMinorUnits: number;
  totalTaxMinorUnits: number;
  grandTotalMinorUnits: number;
  taxBreakdown: TaxBreakdownEntry[];
  lines: InvoiceLineData[];
}

@Injectable()
export class InvoiceService extends TenantScopedRepository {
  constructor(
    prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numbering: NumberingService,
  ) {
    super(prisma);
  }

  async findInvoiceOrThrow(scope: TenantScope, id: string): Promise<Invoice> {
    const row = await this.prisma.invoice.findFirst({
      where: this.scoped(scope, { id }),
      include: INVOICE_WITH_LINES,
    });
    if (!row) throw new NotFoundError('Invoice not found', { id });
    return this.assertOwned(row, scope);
  }

  /**
   * Paginated invoice list (newest first) with payments and refund totals.
   * Tenant-scoped; additionally restricted to the caller's permitted locations
   * (and an optional `locationId` filter). Two queries total (page + count),
   * relations are batched by Prisma � no per-row lookups.
   */
  async listInvoices(scope: TenantScope, principal: Principal, q: ListInvoicesQuery) {
    if (q.locationId) await this.assertLocationInScope(scope, q.locationId);

    const where: Prisma.InvoiceWhereInput = this.scoped(scope, {});
    if (!principal.allLocations) {
      const allowed = Array.from(principal.locationIds);
      if (q.locationId && !allowed.includes(q.locationId)) {
        return { items: [], total: 0 };
      }
      where.locationId = q.locationId ?? { in: allowed };
    } else if (q.locationId) {
      where.locationId = q.locationId;
    }
    if (q.status) where.status = q.status;
    if (q.from || q.to) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (q.from) createdAt.gte = new Date(q.from);
      if (q.to) {
        const end = new Date(q.to);
        // Date-only value => inclusive of the whole day.
        if (/^\d{4}-\d{2}-\d{2}$/.test(q.to)) end.setUTCHours(23, 59, 59, 999);
        createdAt.lte = end;
      }
      where.createdAt = createdAt;
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: q.skip,
        take: q.take,
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          grandTotalMinorUnits: true,
          currencyCode: true,
          createdAt: true,
          finalisedAt: true,
          paidAt: true,
          voidedAt: true,
          locationId: true,
          sessionId: true,
          session: { select: { diningTable: { select: { code: true } } } },
          payments: {
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              method: true,
              status: true,
              amountMinorUnits: true,
              referenceCode: true,
              capturedAt: true,
              refunds: { select: { amountMinorUnits: true, status: true } },
            },
          },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    const items = rows.map(({ session, payments, ...inv }) => ({
      ...inv,
      tableCode: session?.diningTable.code ?? null,
      payments: payments.map(({ refunds, ...pm }) => ({
        ...pm,
        // Same rule the refund endpoint uses: FAILED refunds do not count.
        refundedMinorUnits: refunds
          .filter((r) => r.status !== 'FAILED')
          .reduce((sum, r) => sum + r.amountMinorUnits, 0),
      })),
    }));
    return { items, total };
  }

  async findSessionInvoice(scope: TenantScope, sessionId: string): Promise<Invoice | null> {
    await this.assertSessionInScope(scope, sessionId);
    return this.prisma.invoice.findFirst({
      where: this.scoped(scope, { sessionId, status: { not: InvoiceStatus.VOIDED } }),
      include: INVOICE_WITH_LINES,
    });
  }

  async getOrCreateDraftInvoice(scope: TenantScope, sessionId: string, dto: CreateInvoiceDto): Promise<Invoice> {
    // Validate session exists, is in scope, and is OPEN
    const session = await this.prisma.guestSession.findFirst({
      where: this.scoped(scope, { id: sessionId }),
      select: { id: true, locationId: true, status: true, businessId: true },
    });
    if (!session) throw new NotFoundError('Guest session not found', { sessionId });
    this.assertOwned(session, scope);
    if (session.status !== GuestSessionStatus.OPEN) {
      throw new ValidationError('Guest session is not OPEN — cannot create invoice', {
        sessionId,
        status: session.status,
      });
    }

    // Return existing active invoice (idempotent)
    const existing = await this.prisma.invoice.findFirst({
      where: this.scoped(scope, { sessionId, status: { not: InvoiceStatus.VOIDED } }),
      include: INVOICE_WITH_LINES,
    });
    if (existing) return existing;

    // Collect billable service request lines (from non-DRAFT, non-CANCELLED requests)
    const billableLines = await this.prisma.serviceRequestLine.findMany({
      where: {
        businessId: scope.businessId,
        serviceRequest: {
          sessionId,
          businessId: scope.businessId,
          status: { notIn: ['DRAFT', 'CANCELLED'] },
        },
        status: { not: 'CANCELLED' },
      },
      include: { modifiers: true },
      orderBy: { createdAt: 'asc' },
    });

    if (billableLines.length === 0) {
      throw new ValidationError('No billable items found for this session — at least one sent service request is required', { sessionId });
    }

    const totals = this.computeTotals(billableLines);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const invoice = await tx.invoice.create({
          data: {
            businessId: scope.businessId,
            locationId: session.locationId,
            sessionId,
            status: InvoiceStatus.DRAFT,
            currencyCode: 'INR',
            subtotalMinorUnits: totals.subtotalMinorUnits,
            totalTaxMinorUnits: totals.totalTaxMinorUnits,
            grandTotalMinorUnits: totals.grandTotalMinorUnits,
            taxBreakdown: totals.taxBreakdown as unknown as Prisma.InputJsonValue,
            notes: dto.notes ?? null,
            lines: {
              create: totals.lines.map((l) => ({
                businessId: scope.businessId,
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
              })),
            },
          },
          include: INVOICE_WITH_LINES,
        });

        await this.audit.append(tx, scope, {
          action: 'invoice.created',
          resourceType: 'invoice',
          resourceId: invoice.id,
          locationId: session.locationId,
          metadata: {
            sessionId,
            lineCount: totals.lines.length,
            grandTotalMinorUnits: totals.grandTotalMinorUnits,
          },
        });

        return invoice;
      });
    } catch (e) {
      // Partial unique index violation: concurrent creation for same session
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const concurrent = await this.prisma.invoice.findFirst({
          where: this.scoped(scope, { sessionId, status: { not: InvoiceStatus.VOIDED } }),
          include: INVOICE_WITH_LINES,
        });
        if (concurrent) return concurrent;
      }
      throw e;
    }
  }

  async finaliseInvoice(scope: TenantScope, id: string, dto: FinaliseInvoiceDto): Promise<Invoice> {
    const invoice = await this.findInvoiceOrThrow(scope, id);
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new ValidationError('Only DRAFT invoices can be finalised', { id, status: invoice.status });
    }
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== invoice.version) {
      throw new VersionConflictError('Invoice was modified concurrently', {
        expectedVersion: dto.expectedVersion,
        actualVersion: invoice.version,
      });
    }

    // Allocate invoice number OUTSIDE transaction (advisory lock inside NumberingService)
    const allocated = await this.numbering.allocate(scope, 'invoice', { locationId: invoice.locationId });

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.invoice.update({
        where: { id },
        data: {
          status: InvoiceStatus.FINALISED,
          invoiceNumber: allocated.formatted,
          finalisedAt: new Date(),
          version: { increment: 1 },
        },
        include: INVOICE_WITH_LINES,
      });

      await this.audit.append(tx, scope, {
        action: 'invoice.finalised',
        resourceType: 'invoice',
        resourceId: id,
        locationId: invoice.locationId,
        metadata: { invoiceNumber: allocated.formatted, grandTotalMinorUnits: invoice.grandTotalMinorUnits },
      });

      return updated;
    });
  }

  async voidInvoice(scope: TenantScope, id: string, dto: VoidInvoiceDto): Promise<Invoice> {
    const invoice = await this.findInvoiceOrThrow(scope, id);
    if (invoice.status === InvoiceStatus.VOIDED) {
      throw new ValidationError('Invoice is already VOIDED', { id });
    }
    if (invoice.status === InvoiceStatus.PAID) {
      throw new ConflictError('Cannot void a PAID invoice — use a refund instead', { id });
    }
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== invoice.version) {
      throw new VersionConflictError('Invoice was modified concurrently', {
        expectedVersion: dto.expectedVersion,
        actualVersion: invoice.version,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      // Cancel PENDING payments atomically with the void — prevents orphaned payment state
      await tx.payment.updateMany({
        where: { invoiceId: id, businessId: scope.businessId, status: 'PENDING' },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });

      const updated = await tx.invoice.update({
        where: { id },
        data: {
          status: InvoiceStatus.VOIDED,
          voidReason: dto.reason,
          voidedAt: new Date(),
          version: { increment: 1 },
        },
        include: INVOICE_WITH_LINES,
      });

      await this.audit.append(tx, scope, {
        action: 'invoice.voided',
        resourceType: 'invoice',
        resourceId: id,
        locationId: invoice.locationId,
        metadata: { reason: dto.reason, invoiceNumber: invoice.invoiceNumber },
      });

      return updated;
    });
  }

  // ─── Tax computation ─────────────────────────────────────────────────────────

  private computeTotals(
    lines: Array<{
      id: string;
      itemNameSnapshot: string;
      variantNameSnapshot: string | null;
      quantity: number;
      unitPriceMinorUnits: number;
      taxRateSnapshot: { toNumber(): number };
      taxCategoryNameSnapshot: string | null;
      modifiers: Array<{ optionNameSnapshot: string; priceAdjMinorUnits: number }>;
    }>,
  ): InvoiceTotals {
    let subtotal = 0;
    let totalTax = 0;
    const taxGroups = new Map<string, TaxBreakdownEntry>();
    const invoiceLines: InvoiceLineData[] = [];

    for (const line of lines) {
      const modifiersSum = line.modifiers.reduce((s, m) => s + m.priceAdjMinorUnits, 0);
      const lineSubtotal = (line.unitPriceMinorUnits + modifiersSum) * line.quantity;
      const taxRate = line.taxRateSnapshot.toNumber();
      const lineTax = Math.round(lineSubtotal * taxRate);
      const lineTotal = lineSubtotal + lineTax;

      subtotal += lineSubtotal;
      totalTax += lineTax;

      const taxName = line.taxCategoryNameSnapshot ?? 'No Tax';
      const taxKey = `${taxName}:${taxRate}`;
      const grp = taxGroups.get(taxKey);
      if (grp) {
        grp.taxableAmountMinorUnits += lineSubtotal;
        grp.taxAmountMinorUnits += lineTax;
      } else {
        taxGroups.set(taxKey, {
          name: taxName,
          rate: taxRate,
          taxableAmountMinorUnits: lineSubtotal,
          taxAmountMinorUnits: lineTax,
        });
      }

      invoiceLines.push({
        serviceRequestLineId: line.id,
        itemNameSnapshot: line.itemNameSnapshot,
        variantNameSnapshot: line.variantNameSnapshot ?? undefined,
        modifiersSummary: line.modifiers.length > 0 ? line.modifiers.map((m) => m.optionNameSnapshot).join(', ') : undefined,
        quantity: line.quantity,
        unitPriceMinorUnits: line.unitPriceMinorUnits,
        modifiersMinorUnits: modifiersSum,
        taxRateSnapshot: taxRate,
        taxCategoryName: line.taxCategoryNameSnapshot ?? undefined,
        lineSubtotalMinorUnits: lineSubtotal,
        lineTaxMinorUnits: lineTax,
        lineTotalMinorUnits: lineTotal,
      });
    }

    return {
      subtotalMinorUnits: subtotal,
      totalTaxMinorUnits: totalTax,
      grandTotalMinorUnits: subtotal + totalTax,
      taxBreakdown: Array.from(taxGroups.values()),
      lines: invoiceLines,
    };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async assertSessionInScope(scope: TenantScope, sessionId: string): Promise<void> {
    const row = await this.prisma.guestSession.findFirst({
      where: this.scoped(scope, { id: sessionId }),
      select: { id: true },
    });
    if (!row) throw new NotFoundError('Guest session not found', { sessionId });
  }
}
