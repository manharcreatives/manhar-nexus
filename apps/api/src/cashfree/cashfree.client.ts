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
}

export interface CashfreeLink {
  cfLinkId: string | null;
  linkId: string;
  linkUrl: string;
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
      ...(config.webhookUrl ? { link_meta: { notify_url: config.webhookUrl } } : {}),
    };
    const json = await this.call(config, 'POST', '/links', body);
    return this.toLink(json, input.linkId);
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
