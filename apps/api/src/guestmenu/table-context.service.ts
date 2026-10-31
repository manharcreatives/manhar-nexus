import { Injectable } from '@nestjs/common';
import { GuestSessionStatus, QrOrderingMode } from '@prisma/client';
import { NotFoundError } from '../common/errors';
import { INTERNAL_ADMIN_ACTOR, type TenantScope } from '../common/tenant-scope';
import { SettingsService } from '../core/settings/settings.service';
import { CHECKOUT_SETTINGS_NAMESPACE, UPI_VPA_KEY } from '../checkout/checkout.settings';
import { isValidVpa } from '../checkout/upi/upi-uri';
import { ModuleService } from '../modules/module.service';
import { PrismaService } from '../prisma/prisma.service';
import { caps } from './guestmenu.config';
import { MenuDisabledError } from './guestmenu.errors';
import { TABLE_TOKEN_REGEX, safeEqual } from './guestmenu.tokens';
import type { OpenSession, OrderingMode, TableContext } from './guestmenu.types';

/** Actor used when the system acts for the public (reads of settings, guest-originated writes). */
export const GUEST_SYSTEM_ACTOR = { ...INTERNAL_ADMIN_ACTOR, type: 'SYSTEM' as const, label: 'guest-menu' };

const MAX_CACHE = 5000;

/**
 * Resolves a table QR token to its table, business and effective policy.
 *  - A malformed or unknown token is a plain 404 (no hint whether it ever existed).
 *  - A real token whose menu is switched off (restaurant, table, business suspended, module off) is a 403 MENU_DISABLED
 *    so the page can say "the menu is not available right now" instead of "invalid QR".
 * The result is cached for a few seconds (GUESTMENU_TOKEN_CACHE_MS) and dropped immediately, in this process, whenever
 * staff rotate a token or change the QR settings.
 */
@Injectable()
export class TableContextService {
  private readonly cache = new Map<string, { at: number; ctx: TableContext }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly modules: ModuleService,
  ) {}

  async resolve(rawToken: string): Promise<TableContext> {
    if (!TABLE_TOKEN_REGEX.test(rawToken)) throw new NotFoundError('Menu not found');
    const hit = this.cache.get(rawToken);
    if (hit && Date.now() - hit.at < caps.tokenCacheMs()) {
      return hit.ctx;
    }
    const ctx = await this.load(rawToken);
    if (this.cache.size >= MAX_CACHE) this.cache.clear();
    this.cache.set(rawToken, { at: Date.now(), ctx });
    return ctx;
  }

  invalidateToken(token: string): void {
    this.cache.delete(token);
  }

  invalidateBusiness(businessId: string): void {
    for (const [k, v] of this.cache) if (v.ctx.businessId === businessId) this.cache.delete(k);
  }

  /** The table's OPEN guest session (fresh every call: it changes the moment staff seat or close a table). */
  openSession(ctx: Pick<TableContext, 'tableId' | 'businessId'>): Promise<OpenSession | null> {
    return this.prisma.guestSession.findFirst({
      where: { diningTableId: ctx.tableId, businessId: ctx.businessId, status: GuestSessionStatus.OPEN },
      orderBy: { openedAt: 'desc' },
      select: { id: true, locationId: true, diningTableId: true, businessId: true, openedAt: true },
    });
  }

  private async load(token: string): Promise<TableContext> {
    const qr = await this.prisma.tableQrCode.findUnique({
      where: { token },
      include: {
        diningTable: { include: { diningArea: { select: { name: true } } } },
        business: { select: { name: true, slug: true, accentColor: true, logoUrl: true, currencyCode: true, status: true } },
      },
    });
    if (!qr || !safeEqual(qr.token, token)) throw new NotFoundError('Menu not found');

    const setting = await this.prisma.qrMenuSetting.findUnique({ where: { businessId: qr.businessId } });
    const enabled = setting?.enabled ?? true;
    if (!enabled || !qr.enabled || !qr.diningTable.isActive || qr.business.status !== 'ACTIVE') {
      throw new MenuDisabledError('This menu is not available right now.');
    }
    if (!(await this.modules.isActive(qr.businessId, 'restaurant'))) {
      throw new MenuDisabledError('This menu is not available right now.');
    }

    const mode: QrOrderingMode = setting?.orderingMode ?? QrOrderingMode.CONFIRM;
    const ordering: OrderingMode = !qr.orderingEnabled || mode === QrOrderingMode.OFF ? 'off' : mode === QrOrderingMode.AUTO ? 'auto' : 'confirm';
    const upiEnabled = setting?.upiEnabled ?? false;

    return {
      token,
      qrId: qr.id,
      tableId: qr.diningTableId,
      tableCode: qr.diningTable.code,
      areaName: qr.diningTable.diningArea.name,
      locationId: qr.diningTable.locationId,
      businessId: qr.businessId,
      tableOrderingEnabled: qr.orderingEnabled,
      business: {
        name: qr.business.name,
        slug: qr.business.slug,
        accentColor: qr.business.accentColor,
        logoUrl: qr.business.logoUrl,
        currencyCode: qr.business.currencyCode,
      },
      settings: {
        orderingMode: mode,
        callWaiter: setting?.callWaiter ?? true,
        upiEnabled,
        tagline: setting?.tagline ?? null,
        accentColor: setting?.accentColor ?? null,
        logoUrl: setting?.logoUrl ?? null,
        logoBlur: setting?.logoBlur ?? null,
        coverUrl: setting?.coverUrl ?? null,
        coverBlur: setting?.coverBlur ?? null,
        coverColor: setting?.coverColor ?? null,
      },
      upiConfigured: upiEnabled ? await this.hasUpi(qr.businessId, qr.diningTable.locationId) : false,
      ordering,
    };
  }

  private async hasUpi(businessId: string, locationId: string): Promise<boolean> {
    const scope: TenantScope = { businessId, actor: GUEST_SYSTEM_ACTOR };
    try {
      const vpa = await this.settings.getEffective(scope, CHECKOUT_SETTINGS_NAMESPACE, UPI_VPA_KEY, locationId);
      return typeof vpa.value === 'string' && isValidVpa(vpa.value.trim());
    } catch {
      return false;
    }
  }
}
