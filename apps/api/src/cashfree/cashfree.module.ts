import { Module } from '@nestjs/common';
import { ProvisioningModule } from '../provisioning/provisioning.module';
import { CashfreeClient } from './cashfree.client';
import { CashfreeWebhookController, RegistrationPaymentController } from './cashfree.controller';
import { CustomerPayController } from './customer-pay.controller';
import { CustomerPayService } from './customer-pay.service';
import { RegistrationPaymentService } from './registration-payment.service';
import { PublicSubscriptionController, RegistrationSubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';

/**
 * Cashfree payment links for the owner's subscription (platform side, not the restaurants' own billing).
 * PrismaModule is global. Without CASHFREE_CLIENT_ID / CASHFREE_CLIENT_SECRET the API still boots; creating a link
 * answers 503 with a plain message.
 */
@Module({
  imports: [ProvisioningModule],
  controllers: [RegistrationPaymentController, CashfreeWebhookController, CustomerPayController, RegistrationSubscriptionController, PublicSubscriptionController],
  providers: [CashfreeClient, RegistrationPaymentService, CustomerPayService, SubscriptionService],
  exports: [CashfreeClient, RegistrationPaymentService],
})
export class CashfreeModule {}
