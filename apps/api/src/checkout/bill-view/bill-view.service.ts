import { Injectable } from '@nestjs/common';
import { InvoiceStatus, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundError } from '../../common/errors';
import { TenantScopedRepository } from '../../common/tenant-scoped.repository';
import type { TenantScope } from '../../common/tenant-scope';
import { canAccessLocation, type Principal } from '../../iam/principal';
import { SettingsService } from '../../core/settings/settings.service';
import { CHECKOUT_SETTINGS_NAMESPACE, UPI_PAYEE_NAME_KEY, UPI_VPA_KEY } from '../checkout.settings';
import { buildUpiUri, cleanTransactionRef, isValidVpa } from '../upi/upi-uri';
import { billReference } from './bill-reference';
import { toBillTaxLines, type BillTaxLine } from './tax-lines';

const INVOICE_FOR_VIEW = {
  lines: { orderBy: { itemNameSnapshot: 'asc' as const } },
  payments: { orderBy: { createdAt: 'desc' as const } },
  location: { select: { id: true, name: true, code: true } },
  session: { select: { diningTable: { select: { code: true } } } },
} satisfies Prisma.InvoiceInclude;

type InvoiceForView = Prisma.InvoiceGetPayload<{ include: typeof INVOICE_FOR_VIEW }>;

export type BillViewState = 'NO_BILL' | 'NOT_FINALISED' | 'READY';

export interface BillViewLine {
  id: string;
  name: string;
  variant: string | null;
  modifiers: string | null;
  quantity: number;
  unitPriceMinorUnits: number;
  /** Pre-tax line amount (tax is itemised separately, as on a printed restaurant bill). */
  amountMinorUnits: number;
}

export interface BillView {
  state: BillViewState;
  business: {
    name: string;
    legalName: string | null;
    address: string | null;
    gstin: string | null;
    logoUrl: string | null;
    accentColor: string | null;
  };
  location: { name: string; code: string | null } | null;
  tableCode: string | null;
  bill: null | {
    invoiceId: string;
    status: InvoiceStatus;
    /** "Bill reference" printed on the customer view; same text the cashier sees. */
    reference: string | null;
    currencyCode: string;
    issuedAt: string | null;
    lines: BillViewLine[];
    subtotalMinorUnits: number;
    taxLines: BillTaxLine[];
    totalTaxMinorUnits: number;
    roundingMinorUnits: number;
    grandTotalMinorUnits: number;
    paid: boolean;
    paidAt: string | null;
    /** A UPI payment was started and is waiting for the cashier to confirm it. */
    paymentPending: boolean;
  };
}

export type PaymentQrReason = 'NOT_FINALISED' | 'PAID' | 'VOID' | 'UPI_NOT_CONFIGURED' | 'UPI_INVALID';

export interface PaymentQrView {
  invoiceId: string;
  status: InvoiceStatus;
  reference: string | null;
  tableCode: string | null;
  amountMinorUnits: number;
  currencyCode: string;
  /** True only when a scannable QR is returned. */
  ready: boolean;
  reason: PaymentQrReason | null;
  paid: boolean;
  paymentPending: boolean;
  upi: null | {
    uri: string;
    vpa: string;
    payeeName: string;
    note: string;
    transactionRef: string;
  };
}

/**
 * Read models for the waiter's customer-facing "Show bill" and "Show payment QR" screens.
 * Pure reads: the bill is generated/finalised by the cashier and payments are recorded
 * through the normal checkout flow; nothing here can change a financial record (ADR-016).
 * The QR is built on the server from the immutable invoice total, so the amount a customer
 * is asked to pay can never drift from the bill.
 */
@Injectable()
export class BillViewService extends TenantScopedRepository {
  constructor(
    prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {
    super(prisma);
  }

  async forSession(scope: TenantScope, principal: Principal, sessionId: string): Promise<BillView> {
    const session = await this.prisma.guestSession.findFirst({
      where: this.scoped(scope, { id: sessionId }),
      select: { id: true, locationId: true, diningTable: { select: { code: true } } },
    });
    if (!session || !canAccessLocation(principal, session.locationId)) {
      throw new NotFoundError('Guest session not found', { sessionId });
    }
    const invoice = await this.prisma.invoice.findFirst({
      where: this.scoped(scope, { sessionId, status: { not: InvoiceStatus.VOIDED } }),
      include: INVOICE_FOR_VIEW,
    });
    return this.compose(scope, invoice, session.diningTable.code);
  }

  async forInvoice(scope: TenantScope, principal: Principal, invoiceId: string): Promise<BillView> {
    const invoice = await this.loadInvoice(scope, principal, invoiceId);
    return this.compose(scope, invoice, invoice.session?.diningTable.code ?? null);
  }

  async paymentQr(scope: TenantScope, principal: Principal, invoiceId: string): Promise<PaymentQrView> {
    const invoice = await this.loadInvoice(scope, principal, invoiceId);
    const reference = billReference(invoice.invoiceNumber, invoice.location);
    const paid = invoice.status === InvoiceStatus.PAID;
    const paymentPending = invoice.payments.some((p) => p.status === PaymentStatus.PENDING);
    const base: PaymentQrView = {
      invoiceId: invoice.id,
      status: invoice.status,
      reference,
      tableCode: invoice.session?.diningTable.code ?? null,
      amountMinorUnits: invoice.grandTotalMinorUnits,
      currencyCode: invoice.currencyCode,
      ready: false,
      reason: null,
      paid,
      paymentPending,
      upi: null,
    };
    if (invoice.status === InvoiceStatus.DRAFT) return { ...base, reason: 'NOT_FINALISED' };
    if (invoice.status === InvoiceStatus.VOIDED) return { ...base, reason: 'VOID' };
    if (paid) return { ...base, reason: 'PAID' };

    const [vpaSetting, nameSetting, business] = await Promise.all([
      this.settings.getEffective(scope, CHECKOUT_SETTINGS_NAMESPACE, UPI_VPA_KEY, invoice.locationId),
      this.settings.getEffective(scope, CHECKOUT_SETTINGS_NAMESPACE, UPI_PAYEE_NAME_KEY, invoice.locationId),
      this.prisma.business.findUnique({ where: { id: scope.businessId }, select: { name: true, invoiceName: true } }),
    ]);
    const vpa = typeof vpaSetting.value === 'string' ? vpaSetting.value.trim() : '';
    if (!vpa) return { ...base, reason: 'UPI_NOT_CONFIGURED' };
    if (!isValidVpa(vpa)) return { ...base, reason: 'UPI_INVALID' };

    const configuredName = typeof nameSetting.value === 'string' ? nameSetting.value.trim() : '';
    const payeeName = configuredName || business?.invoiceName?.trim() || business?.name || 'Restaurant';
    const table = base.tableCode ? ` Table ${base.tableCode}` : '';
    const note = `Bill ${reference ?? ''}${table}`.replace(/\s+/g, ' ').trim();
    const transactionRef = cleanTransactionRef(reference ?? invoice.id.replace(/-/g, '').slice(0, 20));
    try {
      const uri = buildUpiUri({
        vpa,
        payeeName,
        amountMinorUnits: invoice.grandTotalMinorUnits,
        note,
        reference: transactionRef,
      });
      return { ...base, ready: true, upi: { uri, vpa, payeeName, note, transactionRef } };
    } catch {
      return { ...base, reason: 'UPI_INVALID' };
    }
  }

  // ─── helpers ────────────────────────────────────────────────────────────────

  private async loadInvoice(scope: TenantScope, principal: Principal, invoiceId: string): Promise<InvoiceForView> {
    const invoice = await this.prisma.invoice.findFirst({
      where: this.scoped(scope, { id: invoiceId }),
      include: INVOICE_FOR_VIEW,
    });
    if (!invoice || !canAccessLocation(principal, invoice.locationId)) {
      throw new NotFoundError('Invoice not found', { invoiceId });
    }
    return this.assertOwned(invoice, scope);
  }

  private async compose(scope: TenantScope, invoice: InvoiceForView | null, tableCode: string | null): Promise<BillView> {
    const business = await this.prisma.business.findUnique({
      where: { id: scope.businessId },
      select: { name: true, legalName: true, invoiceName: true, invoiceAddress: true, taxId: true, logoUrl: true, accentColor: true },
    });
    const biz: BillView['business'] = {
      name: business?.name ?? '',
      legalName: business?.invoiceName?.trim() || business?.legalName?.trim() || null,
      address: business?.invoiceAddress?.trim() || null,
      gstin: business?.taxId?.trim() || null,
      logoUrl: business?.logoUrl ?? null,
      accentColor: business?.accentColor ?? null,
    };
    if (!invoice) return { state: 'NO_BILL', business: biz, location: null, tableCode, bill: null };

    const location = { name: invoice.location.name, code: invoice.location.code };
    // A DRAFT bill can still change until the cashier finalises it: never show it to a guest.
    if (invoice.status === InvoiceStatus.DRAFT) {
      return { state: 'NOT_FINALISED', business: biz, location, tableCode, bill: null };
    }

    return {
      state: 'READY',
      business: biz,
      location,
      tableCode,
      bill: {
        invoiceId: invoice.id,
        status: invoice.status,
        reference: billReference(invoice.invoiceNumber, invoice.location),
        currencyCode: invoice.currencyCode,
        issuedAt: (invoice.finalisedAt ?? invoice.createdAt).toISOString(),
        lines: invoice.lines.map((l) => ({
          id: l.id,
          name: l.itemNameSnapshot,
          variant: l.variantNameSnapshot,
          modifiers: l.modifiersSummary,
          quantity: l.quantity,
          unitPriceMinorUnits: l.unitPriceMinorUnits,
          amountMinorUnits: l.lineSubtotalMinorUnits,
        })),
        subtotalMinorUnits: invoice.subtotalMinorUnits,
        taxLines: toBillTaxLines(invoice.taxBreakdown),
        totalTaxMinorUnits: invoice.totalTaxMinorUnits,
        roundingMinorUnits: invoice.roundingMinorUnits,
        grandTotalMinorUnits: invoice.grandTotalMinorUnits,
        paid: invoice.status === InvoiceStatus.PAID,
        paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : null,
        paymentPending: invoice.payments.some((p) => p.status === PaymentStatus.PENDING),
      },
    };
  }
}
