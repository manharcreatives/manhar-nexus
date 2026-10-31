import { Injectable, OnModuleInit } from '@nestjs/common';
import { SettingValueType } from '@prisma/client';
import { z } from 'zod';
import { SettingsRegistry, type SettingDefinition } from '../core/settings/settings.registry';
import { UPI_VPA_REGEX } from './upi/upi-uri';

export const CHECKOUT_SETTINGS_NAMESPACE = 'checkout';
export const UPI_VPA_KEY = 'upi_vpa';
export const UPI_PAYEE_NAME_KEY = 'upi_payee_name';

/**
 * Checkout settings (namespace `checkout`). They show up in Configuration Center
 * automatically (schema-driven) and can be overridden per location (location > business > default).
 *
 *  - `upi_vpa`: the restaurant's UPI ID. Empty = "not configured": the payment QR then tells
 *    staff to set it instead of showing a broken code. Format-validated here so a typo can
 *    never reach a customer's phone.
 *  - `upi_payee_name`: the name the customer's UPI app shows. Empty = fall back to the
 *    invoice name / restaurant name at read time.
 */
export const CHECKOUT_SETTINGS: SettingDefinition[] = [
  {
    namespace: CHECKOUT_SETTINGS_NAMESPACE,
    key: UPI_VPA_KEY,
    valueType: SettingValueType.STRING,
    schema: z.union([
      z.literal(''),
      z
        .string()
        .trim()
        .max(100)
        .regex(UPI_VPA_REGEX, 'Enter a valid UPI ID such as name@bank'),
    ]),
    default: '',
    description: 'UPI ID (VPA) that customers pay to when staff show the payment QR, e.g. name@bank.',
  },
  {
    namespace: CHECKOUT_SETTINGS_NAMESPACE,
    key: UPI_PAYEE_NAME_KEY,
    valueType: SettingValueType.STRING,
    schema: z.string().trim().max(60),
    default: '',
    description: 'Name shown in the customer UPI app when paying (leave empty to use the restaurant name).',
  },
];

/** Registers the checkout settings with the shared registry once the app boots. */
@Injectable()
export class CheckoutSettingsRegistrar implements OnModuleInit {
  constructor(private readonly registry: SettingsRegistry) {}

  onModuleInit(): void {
    const missing = CHECKOUT_SETTINGS.filter((d) => !this.registry.get(d.namespace, d.key));
    if (missing.length > 0) this.registry.register(missing);
  }
}
