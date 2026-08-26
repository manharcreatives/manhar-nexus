import { Module } from '@nestjs/common';
import { CoreModule } from '../core/core.module';
import { CashProvider } from './provider/cash.provider';
import { ManualUpiProvider } from './provider/manual-upi.provider';
import { PaymentProviderRegistry } from './provider/payment-provider.registry';
import { InvoiceService } from './invoice/invoice.service';
import { InvoiceController } from './invoice/invoice.controller';
import { PaymentService } from './payment/payment.service';
import { PaymentController } from './payment/payment.controller';

/**
 * Phase 9 — Checkout & Payments.
 * Provider-agnostic payment engine: Invoice (immutable bill), Payment
 * (CASH captured immediately; UPI manual confirmation), Refund (append-only
 * reversal records per ADR-016). Razorpay dynamic integration is deferred.
 * Phase 11: AlertDispatcher injected for best-effort invoice.paid notifications.
 */
@Module({
  imports: [CoreModule],
  controllers: [InvoiceController, PaymentController],
  providers: [
    CashProvider,
    ManualUpiProvider,
    PaymentProviderRegistry,
    InvoiceService,
    PaymentService,
  ],
})
export class CheckoutModule {}
