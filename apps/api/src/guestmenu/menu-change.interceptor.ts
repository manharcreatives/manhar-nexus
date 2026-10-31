import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { AuthenticatedRequest } from '../iam/principal';
import { GuestHub } from './guest-hub.service';

/** Admin mutations that can change what the public menu shows (items, prices, availability, tables, QR policy, UPI id). */
const MENU_AFFECTING = /^\/admin\/(?:catalog|menu|qr|dining|settings)(?:\/|$)/;

/**
 * "Menu edits reflect live": after any successful catalog/QR/dining/settings mutation the menu and table caches of that
 * business are dropped and open guest streams are told to re-check (menu.changed arrives only if the guest-visible menu
 * actually changed). Runs after the handler, i.e. after the DB transaction committed. Never affects the request.
 */
@Injectable()
export class MenuChangeInterceptor implements NestInterceptor {
  constructor(private readonly hub: GuestHub) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next.handle();
    const path = (req.originalUrl ?? req.url ?? '').split('?')[0] ?? '';
    if (!MENU_AFFECTING.test(path)) return next.handle();
    return next.handle().pipe(
      tap(() => {
        try {
          const businessId = req.principal?.businessId;
          if (businessId) this.hub.notifyMenu(businessId);
        } catch {
          /* never affects the request */
        }
      }),
    );
  }
}
