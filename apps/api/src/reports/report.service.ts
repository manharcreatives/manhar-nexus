import { Injectable } from '@nestjs/common';
import { InvoiceStatus, PaymentStatus, RefundStatus, ServiceRequestStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TenantScopedRepository } from '../common/tenant-scoped.repository';
import type { TenantScope } from '../common/tenant-scope';
import type {
  DailyClosingReport,
  ItemReport,
  PaymentMethodSummary,
  SalesSummaryReport,
  TaxBreakdownSummary,
} from './report.dto';

interface TaxBreakdownEntry {
  name: string;
  rate: number;
  taxableAmountMinorUnits: number;
  taxAmountMinorUnits: number;
}

/** Derive UTC [start, end) for a YYYY-MM-DD date string (midnight boundaries). */
function dayBounds(date: string): { start: Date; end: Date } {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(`${date}T23:59:59.999Z`);
  return { start, end };
}

/** Derive UTC [start, end] inclusive bounds from YYYY-MM-DD strings. */
function rangeBounds(from: string, to: string): { start: Date; end: Date } {
  return {
    start: new Date(`${from}T00:00:00.000Z`),
    end: new Date(`${to}T23:59:59.999Z`),
  };
}

function aggregateTaxBreakdown(invoiceTaxBreakdowns: unknown[]): TaxBreakdownSummary[] {
  const map = new Map<string, TaxBreakdownSummary>();
  for (const raw of invoiceTaxBreakdowns) {
    const breakdown = raw as TaxBreakdownEntry[];
    if (!Array.isArray(breakdown)) continue;
    for (const entry of breakdown) {
      const key = `${entry.name}::${entry.rate}`;
      const existing = map.get(key) ?? {
        name: entry.name,
        rate: Number(entry.rate),
        taxableAmountMinorUnits: 0,
        taxAmountMinorUnits: 0,
      };
      existing.taxableAmountMinorUnits += entry.taxableAmountMinorUnits ?? 0;
      existing.taxAmountMinorUnits += entry.taxAmountMinorUnits ?? 0;
      map.set(key, existing);
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

@Injectable()
export class ReportService extends TenantScopedRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async dailyClosingReport(scope: TenantScope, date: string, locationId?: string): Promise<DailyClosingReport> {
    const { start, end } = dayBounds(date);
    const locFilter = locationId ? { locationId } : {};

    // PAID invoices in this UTC day
    const paidInvoices = await this.prisma.invoice.findMany({
      where: {
        businessId: scope.businessId,
        ...locFilter,
        status: InvoiceStatus.PAID,
        paidAt: { gte: start, lte: end },
      },
      select: {
        id: true,
        subtotalMinorUnits: true,
        totalTaxMinorUnits: true,
        grandTotalMinorUnits: true,
        taxBreakdown: true,
      },
    });

    const paidInvoiceIds = paidInvoices.map((i) => i.id);

    // Payment breakdown for these invoices
    const payments = paidInvoiceIds.length > 0
      ? await this.prisma.payment.findMany({
          where: {
            businessId: scope.businessId,
            invoiceId: { in: paidInvoiceIds },
            status: PaymentStatus.CAPTURED,
          },
          select: { method: true, amountMinorUnits: true },
        })
      : [];

    // Payment method aggregation
    const pmMap = new Map<string, PaymentMethodSummary>();
    for (const p of payments) {
      const key = p.method as string;
      const existing = pmMap.get(key) ?? { method: key, capturedCount: 0, amountMinorUnits: 0 };
      existing.capturedCount += 1;
      existing.amountMinorUnits += p.amountMinorUnits;
      pmMap.set(key, existing);
    }

    // Refunds on those payments
    const paymentIds = payments.length > 0
      ? (await this.prisma.payment.findMany({
          where: { businessId: scope.businessId, invoiceId: { in: paidInvoiceIds }, status: PaymentStatus.CAPTURED },
          select: { id: true },
        })).map((p) => p.id)
      : [];

    const refundAgg = paymentIds.length > 0
      ? await this.prisma.refund.aggregate({
          where: {
            businessId: scope.businessId,
            paymentId: { in: paymentIds },
            status: RefundStatus.PROCESSED,
          },
          _sum: { amountMinorUnits: true },
          _count: { id: true },
        })
      : null;

    // Voided invoices in this day
    const voidedCount = await this.prisma.invoice.count({
      where: {
        businessId: scope.businessId,
        ...locFilter,
        status: InvoiceStatus.VOIDED,
        voidedAt: { gte: start, lte: end },
      },
    });

    // Served service requests in this day
    const servedOrderCount = await this.prisma.serviceRequest.count({
      where: {
        businessId: scope.businessId,
        ...(locationId ? { locationId } : {}),
        status: ServiceRequestStatus.SERVED,
        servedAt: { gte: start, lte: end },
      },
    });

    const grossSales = paidInvoices.reduce((s, i) => s + i.subtotalMinorUnits, 0);
    const totalTax = paidInvoices.reduce((s, i) => s + i.totalTaxMinorUnits, 0);
    const totalRevenue = paidInvoices.reduce((s, i) => s + i.grandTotalMinorUnits, 0);
    const totalRefunded = refundAgg?._sum.amountMinorUnits ?? 0;
    const refundCount = refundAgg?._count.id ?? 0;

    return {
      date,
      businessId: scope.businessId,
      ...(locationId && { locationId }),
      paidInvoiceCount: paidInvoices.length,
      grossSalesMinorUnits: grossSales,
      totalTaxMinorUnits: totalTax,
      totalRevenueMinorUnits: totalRevenue,
      paymentBreakdown: [...pmMap.values()],
      totalRefundedMinorUnits: totalRefunded,
      refundCount,
      netRevenueMinorUnits: totalRevenue - totalRefunded,
      voidedInvoiceCount: voidedCount,
      taxBreakdown: aggregateTaxBreakdown(paidInvoices.map((i) => i.taxBreakdown)),
      servedOrderCount,
    };
  }

  async salesSummaryReport(
    scope: TenantScope,
    from: string,
    to: string,
    locationId?: string,
  ): Promise<SalesSummaryReport> {
    const { start, end } = rangeBounds(from, to);
    const locFilter = locationId ? { locationId } : {};

    const paidInvoices = await this.prisma.invoice.findMany({
      where: {
        businessId: scope.businessId,
        ...locFilter,
        status: InvoiceStatus.PAID,
        paidAt: { gte: start, lte: end },
      },
      select: {
        id: true,
        subtotalMinorUnits: true,
        totalTaxMinorUnits: true,
        grandTotalMinorUnits: true,
      },
    });

    const paidInvoiceIds = paidInvoices.map((i) => i.id);

    const payments = paidInvoiceIds.length > 0
      ? await this.prisma.payment.findMany({
          where: {
            businessId: scope.businessId,
            invoiceId: { in: paidInvoiceIds },
            status: PaymentStatus.CAPTURED,
          },
          select: { method: true, amountMinorUnits: true },
        })
      : [];

    const pmMap = new Map<string, PaymentMethodSummary>();
    for (const p of payments) {
      const key = p.method as string;
      const ex = pmMap.get(key) ?? { method: key, capturedCount: 0, amountMinorUnits: 0 };
      ex.capturedCount += 1;
      ex.amountMinorUnits += p.amountMinorUnits;
      pmMap.set(key, ex);
    }

    const paymentIds = payments.length > 0
      ? (await this.prisma.payment.findMany({
          where: { businessId: scope.businessId, invoiceId: { in: paidInvoiceIds } },
          select: { id: true },
        })).map((p) => p.id)
      : [];

    const refundAgg = paymentIds.length > 0
      ? await this.prisma.refund.aggregate({
          where: {
            businessId: scope.businessId,
            paymentId: { in: paymentIds },
            status: RefundStatus.PROCESSED,
          },
          _sum: { amountMinorUnits: true },
        })
      : null;

    const totalRevenue = paidInvoices.reduce((s, i) => s + i.grandTotalMinorUnits, 0);
    const totalRefunded = refundAgg?._sum.amountMinorUnits ?? 0;
    const count = paidInvoices.length;

    return {
      from,
      to,
      businessId: scope.businessId,
      ...(locationId && { locationId }),
      paidInvoiceCount: count,
      grossSalesMinorUnits: paidInvoices.reduce((s, i) => s + i.subtotalMinorUnits, 0),
      totalTaxMinorUnits: paidInvoices.reduce((s, i) => s + i.totalTaxMinorUnits, 0),
      totalRevenueMinorUnits: totalRevenue,
      totalRefundedMinorUnits: totalRefunded,
      netRevenueMinorUnits: totalRevenue - totalRefunded,
      averageInvoiceMinorUnits: count > 0 ? Math.round(totalRevenue / count) : 0,
      paymentBreakdown: [...pmMap.values()],
    };
  }

  async itemReport(
    scope: TenantScope,
    from: string,
    to: string,
    locationId?: string,
    limit = 20,
  ): Promise<ItemReport> {
    const { start, end } = rangeBounds(from, to);

    // Aggregate invoice lines from PAID invoices in range
    const paidInvoiceIds = (
      await this.prisma.invoice.findMany({
        where: {
          businessId: scope.businessId,
          ...(locationId ? { locationId } : {}),
          status: InvoiceStatus.PAID,
          paidAt: { gte: start, lte: end },
        },
        select: { id: true },
      })
    ).map((i) => i.id);

    if (paidInvoiceIds.length === 0) {
      return { from, to, businessId: scope.businessId, ...(locationId && { locationId }), items: [] };
    }

    const lines = await this.prisma.invoiceLine.findMany({
      where: {
        businessId: scope.businessId,
        invoiceId: { in: paidInvoiceIds },
      },
      select: {
        itemNameSnapshot: true,
        variantNameSnapshot: true,
        quantity: true,
        lineTotalMinorUnits: true,
      },
    });

    // Aggregate by item name (snapshot — historical accuracy over live catalog)
    const itemMap = new Map<string, { quantity: number; revenueMinorUnits: number }>();
    for (const line of lines) {
      const name = line.variantNameSnapshot
        ? `${line.itemNameSnapshot} (${line.variantNameSnapshot})`
        : line.itemNameSnapshot;
      const existing = itemMap.get(name) ?? { quantity: 0, revenueMinorUnits: 0 };
      existing.quantity += line.quantity;
      existing.revenueMinorUnits += line.lineTotalMinorUnits;
      itemMap.set(name, existing);
    }

    const sorted = [...itemMap.entries()]
      .sort((a, b) => b[1].quantity - a[1].quantity)
      .slice(0, limit)
      .map(([itemName, data]) => ({ itemName, ...data }));

    return {
      from,
      to,
      businessId: scope.businessId,
      ...(locationId && { locationId }),
      items: sorted,
    };
  }
}
