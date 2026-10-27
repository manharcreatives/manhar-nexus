import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { AuthenticatedRequest } from '../iam/principal';
import { RealtimeBus } from './realtime.bus';
import type { RealtimeTopic } from './realtime.types';

interface Rule {
  method: string;
  path: RegExp;
  topics: RealtimeTopic[];
}

const ID = '[^/]+';
const rule = (method: string, path: string, topics: RealtimeTopic[]): Rule => ({
  method,
  path: new RegExp(`^${path}/?$`),
  topics,
});

/**
 * Mutation route -> topics table. Matching happens AFTER the handler resolved
 * successfully (i.e. after the DB transaction committed); failed requests emit
 * nothing. Cross-effects are included deliberately (e.g. closing a session also
 * frees its table; capturing a payment can mark the invoice paid).
 */
const RULES: Rule[] = [
  // Orders (waiter side)
  rule('POST', '/admin/orders', ['orders']),
  rule('POST', `/admin/orders/${ID}/(?:lines|cancel)`, ['orders']),
  rule('PATCH', `/admin/orders/${ID}/lines/${ID}`, ['orders']),
  rule('DELETE', `/admin/orders/${ID}/lines/${ID}`, ['orders']),
  rule('POST', `/admin/orders/${ID}/lines/${ID}/cancel`, ['orders', 'kitchen']),
  rule('POST', `/admin/orders/${ID}/send`, ['orders', 'kitchen']),
  rule('POST', `/admin/orders/${ID}/serve`, ['orders', 'kitchen']),
  // Kitchen
  rule('POST', `/admin/kitchen/${ID}/(?:accept|prepare|ready)`, ['kitchen', 'orders']),
  // Sessions / tables
  rule('POST', '/admin/sessions', ['sessions', 'tables']),
  rule('PATCH', `/admin/sessions/${ID}`, ['sessions']),
  rule('POST', `/admin/sessions/${ID}/(?:close|void)`, ['sessions', 'tables']),
  rule('POST', '/admin/sessions/bookings/[^/]+/seat', ['sessions', 'tables']),
  rule('POST', '/admin/dining/tables', ['tables']),
  rule('PATCH', `/admin/dining/tables/${ID}`, ['tables']),
  rule('DELETE', `/admin/dining/tables/${ID}`, ['tables']),
  // Checkout
  rule('POST', `/admin/checkout/sessions/${ID}/invoice`, ['invoices']),
  rule('POST', `/admin/checkout/invoices/${ID}/(?:finalise|void)`, ['invoices', 'sessions', 'tables']),
  rule('POST', `/admin/checkout/invoices/${ID}/payments`, ['payments', 'invoices']),
  rule('POST', `/admin/checkout/payments/${ID}/(?:capture|cancel|refunds)`, [
    'payments',
    'invoices',
    'sessions',
    'tables',
  ]),
  // Costs
  rule('POST', '/admin/costs/expenses', ['expenses']),
  rule('POST', `/admin/costs/expenses/${ID}/(?:approve|reject)`, ['expenses']),
];

/**
 * Global interceptor that turns a successful business mutation into realtime
 * change events. Keeping the route table in one file means services stay free
 * of transport concerns and the topic map is reviewable in one place.
 * Fire-and-forget: any failure here is swallowed.
 */
@Injectable()
export class RealtimeInterceptor implements NestInterceptor {
  constructor(private readonly bus: RealtimeBus) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const method = req.method;
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next.handle();

    const path = (req.originalUrl ?? req.url ?? '').split('?')[0] ?? '';
    const matched = RULES.find((r) => r.method === method && r.path.test(path));
    if (!matched) return next.handle();

    return next.handle().pipe(
      tap((body) => {
        try {
          const businessId = req.principal?.businessId;
          if (!businessId) return;
          const loc = (body as { locationId?: unknown } | null | undefined)?.locationId;
          const locationId = typeof loc === 'string' ? loc : null;
          for (const topic of matched.topics) this.bus.emit(businessId, topic, locationId);
        } catch {
          /* realtime must never affect the request */
        }
      }),
    );
  }
}
