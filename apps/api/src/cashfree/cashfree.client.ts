import { Injectable } from '@nestjs/common';
import { logger } from '../logging/logger';
import { readCashfreeConfig, type CashfreeConfig } from './cashfree.config';
import { PaymentProviderError, PaymentsNotConfiguredError } from './cashfree.errors';

export interface CreateLinkInput {
  /** Our id for the link (<= 50 chars, [A-Za-z0-9_-]). */
  linkId: string;
  amountPaise: number;
  purpose: string;
  /** `phone` is a 10-digit Indian mobile number. */
  customer: { name: string; email: string; phone: string };
  expiresAt: Date;
  /** Where Cashfree sends the payer after paying (link_meta.return_url, accepted by the sandbox). */
  returnUrl?: string;
}

export interface CashfreeLink {
  cfLinkId: string | null;
  linkId: string;
  linkUrl: string;
  status: string;
}

export interface CreateSubscriptionInput {
  /** Our id for the subscription (alphanumerics, `_`, `-`, `.`; <= 250 chars). */
  subscriptionId: string;
  planName: string;
  /** The recurring monthly debit, GST inclusive. */
  amountPaise: number;
  customer: { name: string; email: string; phone: string };
  firstChargeAt: Date;
  expiresAt: Date;
  /** Shown on the owner's UPI app next to the mandate. */
  pspNote: string;
  /** Where Cashfree sends the owner after authorising (our own page); omitted when the public URL is unknown. */
  returnUrl?: string;
}

export interface CashfreeSubscription {
  subscriptionId: string;
  cfSubscriptionId: string | null;
  /** Token for the Cashfree JS SDK checkout; null if Cashfree did not send one. */
  sessionId: string | null;
  /** Cashfree's status text, upper-cased: INITIALIZED | BANK_APPROVAL_PENDING | ACTIVE | CANCELLED ... */
  status: string;
}

const TIMEOUT_MS = 15_000;

/** Minimal Cashfree Payment Links client. `fetch` is injectable so tests never touch the network. */
@Injectable()
export class CashfreeClient {
  private fetchImpl: typeof fetch = (...args) => fetch(...args);
  private readConfig: () => CashfreeConfig | null = () => readCashfreeConfig();

  /** Test seam: replace the network and the configuration source. */
  useForTests(parts: { fetch?: typeof fetch; config?: () => CashfreeConfig | null }): this {
    if (parts.fetch) this.fetchImpl = parts.fetch;
    if (parts.config) this.readConfig = parts.config;
    return this;
  }

  /** The active configuration, or a clear 503 when the keys are not set on this deployment. */
  config(): CashfreeConfig {
    const config = this.readConfig();
    if (!config) {
      throw new PaymentsNotConfiguredError(
        'Online payments are not set up on this server yet (Cashfree keys missing). Ask the platform owner to add them.',
      );
    }
    return config;
  }

  async createLink(input: CreateLinkInput): Promise<CashfreeLink> {
    const config = this.config();
    const body = {
      link_id: input.linkId,
      link_amount: Number((input.amountPaise / 100).toFixed(2)),
      link_currency: 'INR',
      link_purpose: input.purpose,
      customer_details: {
        customer_name: input.customer.name,
        customer_email: input.customer.email,
        customer_phone: input.customer.phone,
      },
      link_partial_payments: false,
      link_expiry_time: input.expiresAt.toISOString(),
      link_notify: { send_email: true, send_sms: false },
      link_auto_reminders: false,
      ...(config.webhookUrl || input.returnUrl
        ? { link_meta: { ...(config.webhookUrl ? { notify_url: config.webhookUrl } : {}), ...(input.returnUrl ? { return_url: input.returnUrl } : {}) } }
        : {}),
    };
    const json = await this.call(config, 'POST', '/links', body);
    return this.toLink(json, input.linkId);
  }

  /** Cancels a link that has not been paid (Cashfree refuses once it is paid or already closed). */
  async cancelLink(linkId: string): Promise<void> {
    const config = this.config();
    await this.call(config, 'POST', `/links/${encodeURIComponent(linkId)}/cancel`, {});
  }

  /**
   * Creates a PERIODIC monthly UPI AutoPay subscription (verified on the sandbox: returns subscription_session_id and
   * status INITIALIZED; there is no hosted auth URL, the owner authorises through the Cashfree JS SDK with the session).
   */
  async createSubscription(input: CreateSubscriptionInput): Promise<CashfreeSubscription> {
    const config = this.config();
    const rupees = Number((input.amountPaise / 100).toFixed(2));
    const body = {
      subscription_id: input.subscriptionId,
      customer_details: {
        customer_name: input.customer.name,
        customer_email: input.customer.email,
        customer_phone: input.customer.phone,
      },
      plan_details: {
        plan_name: input.planName.slice(0, 40),
        plan_type: 'PERIODIC',
        plan_amount: rupees,
        plan_max_amount: rupees,
        plan_max_cycles: 120,
        plan_intervals: 1,
        plan_interval_type: 'MONTH',
        plan_currency: 'INR',
      },
      authorization_details: { authorization_amount: 1, authorization_amount_refund: true, payment_methods: ['upi'] },
      subscription_meta: { notification_channel: ['EMAIL'], ...(input.returnUrl ? { return_url: input.returnUrl } : {}) },
      subscription_expiry_time: input.expiresAt.toISOString(),
      subscription_first_charge_time: input.firstChargeAt.toISOString(),
      subscription_tags: { psp_note: input.pspNote.slice(0, 200) },
    };
    return this.toSubscription(await this.call(config, 'POST', '/subscriptions', body), input.subscriptionId);
  }

  /** Current state (and a fresh session id, which Cashfree issues on every read: verified on the sandbox). */
  async getSubscription(subscriptionId: string): Promise<CashfreeSubscription> {
    const config = this.config();
    return this.toSubscription(await this.call(config, 'GET', `/subscriptions/${encodeURIComponent(subscriptionId)}`), subscriptionId);
  }

  /** Cancels the mandate (verified on the sandbox: returns the subscription with status CANCELLED). */
  async cancelSubscription(subscriptionId: string): Promise<CashfreeSubscription> {
    const config = this.config();
    const path = `/subscriptions/${encodeURIComponent(subscriptionId)}/manage`;
    return this.toSubscription(await this.call(config, 'POST', path, { subscription_id: subscriptionId, action: 'CANCEL' }), subscriptionId);
  }

  private toSubscription(json: Record<string, unknown>, fallbackId: string): CashfreeSubscription {
    const sessionId = typeof json.subscription_session_id === 'string' ? json.subscription_session_id : null;
    const status = typeof json.subscription_status === 'string' ? json.subscription_status.toUpperCase() : null;
    if (!status) throw new PaymentProviderError('Cashfree did not return the subscription status.');
    return {
      subscriptionId: typeof json.subscription_id === 'string' ? json.subscription_id : fallbackId,
      cfSubscriptionId: json.cf_subscription_id !== undefined && json.cf_subscription_id !== null ? String(json.cf_subscription_id) : null,
      sessionId,
      status,
    };
  }

  async getLink(linkId: string): Promise<CashfreeLink & { amountPaidRupees: number | null }> {
    const config = this.config();
    const json = await this.call(config, 'GET', `/links/${encodeURIComponent(linkId)}`);
    const paid = json.link_amount_paid;
    return { ...this.toLink(json, linkId), amountPaidRupees: typeof paid === 'number' ? paid : null };
  }

  /**
   * The order id of the successful payment for a link (GET /links/{id}/orders), or null. Cashfree returns an array
   * of orders; a link that was paid has one whose order_status is PAID.
   */
  async getPaidOrderId(linkId: string): Promise<string | null> {
    const config = this.config();
    const json = (await this.call(config, 'GET', `/links/${encodeURIComponent(linkId)}/orders`)) as unknown;
    if (!Array.isArray(json)) return null;
    const paid = json.find((o): o is { order_id: string } => typeof o === 'object' && o !== null && (o as { order_status?: unknown }).order_status === 'PAID' && typeof (o as { order_id?: unknown }).order_id === 'string');
    return paid?.order_id ?? null;
  }

  private toLink(json: Record<string, unknown>, fallbackId: string): CashfreeLink {
    const linkUrl = typeof json.link_url === 'string' ? json.link_url : '';
    if (!linkUrl) throw new PaymentProviderError('Cashfree did not return a payment link URL.');
    return {
      cfLinkId: json.cf_link_id !== undefined && json.cf_link_id !== null ? String(json.cf_link_id) : null,
      linkId: typeof json.link_id === 'string' ? json.link_id : fallbackId,
      linkUrl,
      status: typeof json.link_status === 'string' ? json.link_status : 'ACTIVE',
    };
  }

  private async call(
    config: CashfreeConfig,
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<Record<string, unknown>> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${config.baseUrl}${path}`, {
        method,
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          'x-client-id': config.clientId,
          'x-client-secret': config.clientSecret,
          'x-api-version': config.apiVersion,
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      logger.child({ cashfree: { path, method } }).warn(`cashfree request failed: ${(err as Error).name}`);
      throw new PaymentProviderError('Could not reach Cashfree. Please try again in a moment.');
    }
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      /* a non-JSON error page */
    }
    if (!res.ok) {
      const code = typeof json.code === 'string' ? json.code : undefined;
      const message = typeof json.message === 'string' ? json.message : undefined;
      logger.child({ cashfree: { path, method, status: res.status, code } }).warn('cashfree refused the call');
      throw new PaymentProviderError(
        `Cashfree said no (${res.status}${code ? ` ${code}` : ''}): ${message ?? 'no details'}`.slice(0, 300),
      );
    }
    return json;
  }
}
