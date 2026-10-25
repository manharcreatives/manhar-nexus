import { Injectable } from '@nestjs/common';
import { InvoiceStatus, PaymentStatus, type Payment, type Refund } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictError, NotFoundError, ValidationError, VersionConflictError } from '../../common/errors';
import { TenantScopedRepository } from '../../common/tenant-scoped.repository';
import { lockBusiness } from '../../common/locks';
import { AuditService } from '../../core/audit/audit.service';
import { AlertDispatcher } from '../../core/alerts/alert-dispatcher';
import { PaymentProviderRegistry } from '../provider/payment-provider.registry';
import type { TenantScope } from '../../common/tenant-scope';
import type { InitiatePaymentDto, CapturePaymentDto, CancelPaymentDto, CreateRefundDto } from './payment.dto';

@Injectable()
export class PaymentService extends TenantScopedRepository {
  constructor(
    prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly providers: PaymentProviderRegistry,
    private readonly dispatcher: AlertDispatcher,
  ) {
    super(prisma);
  }

  async listPayments(scope: TenantScope, invoiceId: string): Promise<Payment[]> {
    await this.assertInvoiceInScope(scope, invoiceId);
    return this.prisma.payment.findMany({
      where: this.scoped(scope, { invoiceId }),
      include: { refunds: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findPaymentOrThrow(scope: TenantScope, id: string): Promise<Payment> {
    const row = await this.prisma.payment.findFirst({
      where: this.scoped(scope, { id }),
      include: { refunds: true },
    });
    if (!row) throw new NotFoundError('Payment not found', { id });
    return this.assertOwned(row, scope);
  }

  async initiatePayment(scope: TenantScope, invoiceId: string, dto: InitiatePaymentDto): Promise<Payment> {
    const invoice = await this.prisma.invoice.findFirst({
      where: this.scoped(scope, { id: invoiceId }),
    });
    if (!invoice) throw new NotFoundError('Invoice not found', { invoiceId });
    this.assertOwned(invoice, scope);

    // Early idempotency check: if this key already exists, return it without further validation
    const existingByKey = await this.prisma.payment.findFirst({
      where: this.scoped(scope, { idempotencyKey: dto.idempotencyKey }),
      include: { refunds: true },
    });
    if (existingByKey) return existingByKey;

    // PAID is a conflict (bill already settled); other non-FINALISED states are validation errors
    if (invoice.status === InvoiceStatus.PAID) {
      throw new ConflictError('Invoice is already PAID', { invoiceId });
    }
    if (invoice.status !== InvoiceStatus.FINALISED) {
      throw new ValidationError('Invoice must be FINALISED before accepting payment', {
        invoiceId,
        status: invoice.status,
      });
    }

    // Only one non-failed/non-cancelled payment allowed per invoice at a time
    const activePmt = await this.prisma.payment.findFirst({
      where: this.scoped(scope, {
        invoiceId,
        status: { in: [PaymentStatus.PENDING, PaymentStatus.CAPTURED] },
      }),
    });
    if (activePmt) {
      throw new ConflictError('Invoice already has an active or captured payment', {
        invoiceId,
        existingPaymentId: activePmt.id,
        existingStatus: activePmt.status,
      });
    }

    if (dto.amountMinorUnits !== invoice.grandTotalMinorUnits) {
      throw new ValidationError('Payment amount must equal invoice grand total', {
        provided: dto.amountMinorUnits,
        required: invoice.grandTotalMinorUnits,
      });
    }

    const provider = this.providers.get(dto.method);
    const result = await provider.initiate({
      invoiceId,
      amountMinorUnits: dto.amountMinorUnits,
      currencyCode: invoice.currencyCode,
      method: dto.method,
      cashReceivedMinorUnits: dto.cashReceivedMinorUnits,
      referenceCode: dto.referenceCode,
      notes: dto.notes,
    });

    const txResult = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          businessId: scope.businessId,
          locationId: invoice.locationId,
          invoiceId,
          idempotencyKey: dto.idempotencyKey,
          method: dto.method,
          status: result.status,
          amountMinorUnits: dto.amountMinorUnits,
          currencyCode: invoice.currencyCode,
          cashReceivedMinorUnits: result.status === 'CAPTURED' ? (dto.cashReceivedMinorUnits ?? null) : null,
          changeMinorUnits: result.changeMinorUnits ?? null,
          referenceCode: dto.referenceCode ?? null,
          providerOrderId: result.providerOrderId ?? null,
          providerTransactionId: result.providerTransactionId ?? null,
          notes: dto.notes ?? null,
          capturedAt: result.capturedAt ?? null,
        },
        include: { refunds: true },
      });

      // If immediately captured (e.g. cash), mark the invoice PAID
      if (result.status === PaymentStatus.CAPTURED) {
        await tx.invoice.update({
          where: { id: invoiceId },
          data: { status: InvoiceStatus.PAID, paidAt: result.capturedAt ?? new Date(), version: { increment: 1 } },
        });
      }

      await this.audit.append(tx, scope, {
        action: 'payment.initiated',
        resourceType: 'payment',
        resourceId: payment.id,
        locationId: invoice.locationId,
        metadata: {
          invoiceId,
          method: dto.method,
          amountMinorUnits: dto.amountMinorUnits,
          status: result.status,
        },
      });

      return payment;
    });

    // Best-effort notification: invoice immediately PAID on cash capture
    if (txResult.status === PaymentStatus.CAPTURED) {
      void this.dispatcher.dispatch(scope.businessId, 'invoice.paid', {
        title: 'Invoice Paid',
        body: `A payment of ${dto.amountMinorUnits} was captured via ${dto.method}.`,
        resourceUrl: `/admin/checkout/sessions/${invoiceId}`,
      });
    }

    return txResult;
  }

  async capturePayment(scope: TenantScope, id: string, dto: CapturePaymentDto): Promise<Payment> {
    const payment = await this.findPaymentOrThrow(scope, id);

    if (payment.status !== PaymentStatus.PENDING) {
      throw new ValidationError('Only PENDING payments can be captured', { id, status: payment.status });
    }
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== payment.version) {
      throw new VersionConflictError('Payment was modified concurrently', {
        expectedVersion: dto.expectedVersion,
        actualVersion: payment.version,
      });
    }

    const provider = this.providers.get(payment.method);
    const result = await provider.capture({
      paymentId: id,
      referenceCode: dto.referenceCode,
      providerTransactionId: dto.providerTransactionId,
    });

    const captured = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id },
        data: {
          status: result.status,
          capturedAt: result.capturedAt,
          referenceCode: result.referenceCode ?? payment.referenceCode,
          providerTransactionId: result.providerTransactionId ?? null,
          version: { increment: 1 },
        },
        include: { refunds: true },
      });

      if (result.status === PaymentStatus.CAPTURED) {
        await tx.invoice.update({
          where: { id: payment.invoiceId },
          data: { status: InvoiceStatus.PAID, paidAt: result.capturedAt, version: { increment: 1 } },
        });
      }

      await this.audit.append(tx, scope, {
        action: 'payment.captured',
        resourceType: 'payment',
        resourceId: id,
        locationId: payment.locationId,
        metadata: { invoiceId: payment.invoiceId, method: payment.method, referenceCode: result.referenceCode },
      });

      return updated;
    });

    // Best-effort notification after commit
    if (captured.status === PaymentStatus.CAPTURED) {
      void this.dispatcher.dispatch(scope.businessId, 'invoice.paid', {
        title: 'Invoice Paid',
        body: `Payment of ${captured.amountMinorUnits} captured via ${captured.method}.`,
        resourceUrl: `/admin/checkout/invoices/${captured.invoiceId}`,
      });
    }

    return captured;
  }

  async cancelPayment(scope: TenantScope, id: string, dto: CancelPaymentDto): Promise<Payment> {
    const payment = await this.findPaymentOrThrow(scope, id);

    if (payment.status !== PaymentStatus.PENDING) {
      throw new ValidationError('Only PENDING payments can be cancelled', { id, status: payment.status });
    }
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== payment.version) {
      throw new VersionConflictError('Payment was modified concurrently', {
        expectedVersion: dto.expectedVersion,
        actualVersion: payment.version,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id },
        data: {
          status: PaymentStatus.CANCELLED,
          failureReason: dto.reason ?? null,
          cancelledAt: new Date(),
          version: { increment: 1 },
        },
        include: { refunds: true },
      });

      await this.audit.append(tx, scope, {
        action: 'payment.cancelled',
        resourceType: 'payment',
        resourceId: id,
        locationId: payment.locationId,
        metadata: { invoiceId: payment.invoiceId, reason: dto.reason },
      });

      return updated;
    });
  }

  async createRefund(scope: TenantScope, paymentId: string, dto: CreateRefundDto): Promise<Refund> {
    const payment = await this.findPaymentOrThrow(scope, paymentId);

    if (payment.status !== PaymentStatus.CAPTURED) {
      throw new ValidationError('Only CAPTURED payments can be refunded', { paymentId, status: payment.status });
    }

    // Serialise concurrent refunds: take the tenant advisory lock, then compute
    // the remaining balance INSIDE the transaction so two simultaneous requests
    // cannot both pass the check and over-refund the same payment.
    return this.prisma.$transaction(async (tx) => {
      await lockBusiness(tx, scope.businessId);

      // Scope to businessId (defense-in-depth - paymentId already validated via findPaymentOrThrow)
      const existingRefunds = await tx.refund.aggregate({
        where: { paymentId, businessId: scope.businessId, status: { not: 'FAILED' } },
        _sum: { amountMinorUnits: true },
      });
      const alreadyRefunded = existingRefunds._sum.amountMinorUnits ?? 0;
      const remaining = payment.amountMinorUnits - alreadyRefunded;

      if (dto.amountMinorUnits > remaining) {
        throw new ValidationError('Refund amount exceeds remaining refundable balance', {
          paymentId,
          requested: dto.amountMinorUnits,
          remaining,
        });
      }

      const provider = this.providers.get(payment.method);
      const result = await provider.refund({
        paymentId,
        amountMinorUnits: dto.amountMinorUnits,
        reason: dto.reason,
      });

      const refund = await tx.refund.create({
        data: {
          businessId: scope.businessId,
          paymentId,
          reason: dto.reason,
          amountMinorUnits: dto.amountMinorUnits,
          status: result.status,
          notes: dto.notes ?? null,
          providerRefundId: result.providerRefundId ?? null,
          processedAt: result.processedAt ?? null,
        },
      });

      await this.audit.append(tx, scope, {
        action: 'refund.created',
        resourceType: 'refund',
        resourceId: refund.id,
        locationId: payment.locationId,
        metadata: {
          paymentId,
          amountMinorUnits: dto.amountMinorUnits,
          reason: dto.reason,
          status: result.status,
        },
      });

      return refund;
    });
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private async assertInvoiceInScope(scope: TenantScope, invoiceId: string): Promise<void> {
    const row = await this.prisma.invoice.findFirst({
      where: this.scoped(scope, { id: invoiceId }),
      select: { id: true },
    });
    if (!row) throw new NotFoundError('Invoice not found', { invoiceId });
  }
}
