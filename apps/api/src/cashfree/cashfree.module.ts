import { Module } from '@nestjs/common';
import { CashfreeClient } from './cashfree.client';
import { CashfreeWebhookController, RegistrationPaymentController } from './cashfree.controller';
import { RegistrationPaymentService } from './registration-payment.service';

/**
 * Cashfree payment links for the owner's subscription (platform side, not the restaurants' own billing).
 * PrismaModule is global. Without CASHFREE_CLIENT_ID / CASHFREE_CLIENT_SECRET the API still boots; creating a link
 * answers 503 with a plain message.
 */
@Module({
  controllers: [RegistrationPaymentController, CashfreeWebhookController],
  providers: [CashfreeClient, RegistrationPaymentService],
  exports: [CashfreeClient, RegistrationPaymentService],
})
export class CashfreeModule {}
