import { Injectable } from '@nestjs/common';
import { InvoiceStatus, PaymentStatus, Prisma, type Payment, type Refund } from '@prisma/client';
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
    if (existingByKey) return this.replayPayment(existingByKey, invoiceId, dto);

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

    let txResult: Payment;
    let replayed = false;
    try {
      txResult = await this.prisma.$transaction(async (tx) => {
        // Serialise payment writes for the tenant, then re-check EVERYTHING under the lock: two
        // taps (or two devices) racing past the checks above can no longer both create a payment.
        await lockBusiness(tx, scope.businessId);

        const duplicate = await tx.payment.findFirst({
          where: { businessId: scope.businessId, idempotencyKey: dto.idempotencyKey },
          include: { refunds: true },
        });
        if (duplicate) {
          replayed = true;
          return this.replayPayment(duplicate, invoiceId, dto);
        }

        const fresh = await tx.invoice.findFirst({
          where: { id: invoiceId, businessId: scope.businessId },
          select: { status: true, grandTotalMinorUnits: true },
        });
        if (!fresh) throw new NotFoundError('Invoice not found', { invoiceId });
        if (fresh.status === InvoiceStatus.PAID) throw new ConflictError('Invoice is already PAID', { invoiceId });
        if (fresh.status !== InvoiceStatus.FINALISED) {
          throw new ValidationError('Invoice must be FINALISED before accepting payment', { invoiceId, status: fresh.status });
        }
        const active = await tx.payment.findFirst({
          where: { businessId: scope.businessId, invoiceId, status: { in: [PaymentStatus.PENDING, PaymentStatus.CAPTURED] } },
          select: { id: true, status: true },
        });
        if (active) {
          throw new ConflictError('Invoice already has an active or captured payment', {
            invoiceId,
            existingPaymentId: active.id,
            existingStatus: active.status,
          });
        }
        if (fresh.grandTotalMinorUnits !== dto.amountMinorUnits) {
          throw new ValidationError('Payment amount must equal invoice grand total', {
            provided: dto.amountMinorUnits,
            required: fresh.grandTotalMinorUnits,
          });
        }

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
    } catch (e) {
      // Unique (businessId, idempotencyKey) race that slipped past the lock: replay the winner.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const winner = await this.prisma.payment.findFirst({
          where: this.scoped(scope, { idempotencyKey: dto.idempotencyKey }),
          include: { refunds: true },
        });
        if (winner) return this.replayPayment(winner, invoiceId, dto);
      }
      throw e;
    }

    // Best-effort notification: invoice immediately PAID on cash capture
    if (!replayed && txResult.status === PaymentStatus.CAPTURED) {
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

    // A retried confirmation (dropped response, double tap) with the SAME reference is a replay of
    // the capture that already happened, not an error and never a second capture.
    if (payment.status === PaymentStatus.CAPTURED && dto.referenceCode !== undefined && dto.referenceCode === payment.referenceCode) {
      return payment;
    }
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

    let replayed = false;
    const captured = await this.prisma.$transaction(async (tx) => {
      await lockBusiness(tx, scope.businessId);

      // Compare-and-set: only the request that still finds the payment PENDING may capture it.
      const moved = await tx.payment.updateMany({
        where: { id, businessId: scope.businessId, status: PaymentStatus.PENDING, version: payment.version },
        data: {
          status: result.status,
          capturedAt: result.capturedAt,
          referenceCode: result.referenceCode ?? payment.referenceCode,
          providerTransactionId: result.providerTransactionId ?? null,
          version: { increment: 1 },
        },
      });
      if (moved.count === 0) {
        const current = await tx.payment.findFirst({ where: { id, businessId: scope.businessId }, include: { refunds: true } });
        if (current?.status === PaymentStatus.CAPTURED && current.referenceCode === (result.referenceCode ?? null)) {
          replayed = true;
          return current;
        }
        throw new ConflictError('Payment was changed by someone else; reload and check its status', {
          id,
          status: current?.status,
        });
      }
      const updated = await tx.payment.findFirstOrThrow({ where: { id, businessId: scope.businessId }, include: { refunds: true } });

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
    if (!replayed && captured.status === PaymentStatus.CAPTURED) {
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
      await lockBusiness(tx, scope.businessId);

      const moved = await tx.payment.updateMany({
        where: { id, businessId: scope.businessId, status: PaymentStatus.PENDING },
        data: {
          status: PaymentStatus.CANCELLED,
          failureReason: dto.reason ?? null,
          cancelledAt: new Date(),
          version: { increment: 1 },
        },
      });
      const updated = await tx.payment.findFirstOrThrow({ where: { id, businessId: scope.businessId }, include: { refunds: true } });
      if (moved.count === 0) {
        // Lost the race. If someone else cancelled it, that is the outcome we wanted; if it was captured, say so.
        if (updated.status === PaymentStatus.CANCELLED) return updated;
        throw new ConflictError('Payment was captured while you were cancelling it', { id, status: updated.status });
      }

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

    // Early idempotency check (mirrors initiatePayment): a key we have already
    // seen replays the original refund without re-validating or re-refunding.
    if (dto.idempotencyKey) {
      const existing = await this.prisma.refund.findFirst({
        where: this.scoped(scope, { idempotencyKey: dto.idempotencyKey }),
      });
      if (existing) return this.replayRefund(existing, paymentId, dto);
    }

    if (payment.status !== PaymentStatus.CAPTURED) {
      throw new ValidationError('Only CAPTURED payments can be refunded', { paymentId, status: payment.status });
    }

    // Serialise concurrent refunds: take the tenant advisory lock, then compute
    // the remaining balance INSIDE the transaction so two simultaneous requests
    // cannot both pass the check and over-refund the same payment.
    try {
      return await this.createRefundLocked(scope, payment, dto);
    } catch (e) {
      // Unique (businessId, idempotencyKey) race: another request won → replay it.
      if (dto.idempotencyKey && e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const existing = await this.prisma.refund.findFirst({
          where: this.scoped(scope, { idempotencyKey: dto.idempotencyKey }),
        });
        if (existing) return this.replayRefund(existing, paymentId, dto);
      }
      throw e;
    }
  }

  /**
   * Same key + same invoice + same method + same amount (+ same cash tendered) → the original
   * payment; anything else → 409. A key can never silently stand in for a different payment,
   * e.g. a changed cash amount or a switched method after a lost response.
   */
  private replayPayment(existing: Payment, invoiceId: string, dto: InitiatePaymentDto): Payment {
    const sameCash =
      dto.method !== 'CASH' || dto.cashReceivedMinorUnits === undefined || existing.cashReceivedMinorUnits === dto.cashReceivedMinorUnits;
    if (
      existing.invoiceId !== invoiceId ||
      existing.method !== dto.method ||
      existing.amountMinorUnits !== dto.amountMinorUnits ||
      !sameCash
    ) {
      throw new ConflictError('Idempotency key was already used for a different payment', {
        idempotencyKey: dto.idempotencyKey,
        existingPaymentId: existing.id,
      });
    }
    return existing;
  }

  /** Same key + same payment + same amount → the original refund; anything else → 409. */
  private replayRefund(existing: Refund, paymentId: string, dto: CreateRefundDto): Refund {
    if (existing.paymentId !== paymentId || existing.amountMinorUnits !== dto.amountMinorUnits) {
      throw new ConflictError('Idempotency key was already used for a different refund', {
        idempotencyKey: dto.idempotencyKey,
        existingRefundId: existing.id,
      });
    }
    return existing;
  }

  private createRefundLocked(scope: TenantScope, payment: Payment, dto: CreateRefundDto): Promise<Refund> {
    const paymentId = payment.id;
    return this.prisma.$transaction(async (tx) => {
      await lockBusiness(tx, scope.businessId);

      // Re-check under the lock: a concurrent request with the same key that
      // committed first must be replayed, never refunded a second time.
      if (dto.idempotencyKey) {
        const existing = await tx.refund.findFirst({
          where: { businessId: scope.businessId, idempotencyKey: dto.idempotencyKey },
        });
        if (existing) return this.replayRefund(existing, paymentId, dto);
      }

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
          idempotencyKey: dto.idempotencyKey ?? null,
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
          idempotencyKey: dto.idempotencyKey ?? null,
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
