import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { CashProvider } from './provider/cash.provider';
import { ManualUpiProvider } from './provider/manual-upi.provider';
import { PaymentProviderRegistry } from './provider/payment-provider.registry';
import { InvoiceService } from './invoice/invoice.service';
import { InvoiceController } from './invoice/invoice.controller';
import { PaymentService } from './payment/payment.service';
import { PaymentController } from './payment/payment.controller';
import { BillViewController } from './bill-view/bill-view.controller';
import { BillViewService } from './bill-view/bill-view.service';
import { CheckoutSettingsRegistrar } from './checkout.settings';

/**
 * Phase 9 — Checkout & Payments.
 * Provider-agnostic payment engine: Invoice (immutable bill), Payment
 * (CASH captured immediately; UPI manual confirmation), Refund (append-only
 * reversal records per ADR-016). Razorpay dynamic integration is deferred.
 * Phase 11: AlertDispatcher injected for best-effort invoice.paid notifications.
 * Update Round 2: waiter-facing bill / UPI payment QR read models (BillViewService) and the
 * `checkout.upi_vpa` / `checkout.upi_payee_name` settings.
 */
@Module({
  imports: [CoreModule],
  controllers: [InvoiceController, PaymentController, BillViewController],
  providers: [
    CashProvider,
    ManualUpiProvider,
    PaymentProviderRegistry,
    InvoiceService,
    PaymentService,
    BillViewService,
    CheckoutSettingsRegistrar,
  ],
})
export class CheckoutModule {}
