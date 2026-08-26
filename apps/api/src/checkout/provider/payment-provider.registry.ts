import { Injectable } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';
import { CashProvider } from './cash.provider';
import { ManualUpiProvider } from './manual-upi.provider';
import type { PaymentProvider } from './payment-provider.interface';

@Injectable()
export class PaymentProviderRegistry {
  private readonly providers: Map<PaymentMethod, PaymentProvider>;

  constructor(
    private readonly cash: CashProvider,
    private readonly manualUpi: ManualUpiProvider,
  ) {
    this.providers = new Map<PaymentMethod, PaymentProvider>([
      [PaymentMethod.CASH, cash],
      [PaymentMethod.UPI, manualUpi],
    ]);
  }

  get(method: PaymentMethod): PaymentProvider {
    const provider = this.providers.get(method);
    if (!provider) {
      throw new Error(`No payment provider registered for method: ${method}`);
    }
    return provider;
  }

  supported(): PaymentMethod[] {
    return Array.from(this.providers.keys());
  }
}
