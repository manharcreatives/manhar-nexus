import { Module } from '@nestjs/common';
import { CashfreeClient } from './cashfree.client';
import { CashfreeWebhookController, RegistrationPaymentController } from './cashfree.controller';
import { CustomerPayController } from './customer-pay.controller';
import { CustomerPayService } from './customer-pay.service';
import { RegistrationPaymentService } from './registration-payment.service';

/**
 * Cashfree payment links for the owner's subscription (platform side, not the restaurants' own billing).
 * PrismaModule is global. Without CASHFREE_CLIENT_ID / CASHFREE_CLIENT_SECRET the API still boots; creating a link
 * answers 503 with a plain message.
 */
@Module({
  controllers: [RegistrationPaymentController, CashfreeWebhookController, CustomerPayController],
  providers: [CashfreeClient, RegistrationPaymentService, CustomerPayService],
  exports: [CashfreeClient, RegistrationPaymentService],
})
export class CashfreeModule {}
