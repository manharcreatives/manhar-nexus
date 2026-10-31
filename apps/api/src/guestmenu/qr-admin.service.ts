import { Injectable } from '@nestjs/common';
import { GuestOrderDecision, GuestSessionStatus, Prisma, QrOrderingMode, ServiceRequestStatus, WaiterCallStatus, type TableQrCode } from '@prisma/client';
import { NotFoundError, VersionConflictError } from '../common/errors';
import { TenantScopedRepository } from '../common/tenant-scoped.repository';
import type { TenantScope } from '../common/tenant-scope';
import { AuditService } from '../core/audit/audit.service';
import { canAccessLocation, type Principal } from '../iam/principal';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeBus } from '../realtime/realtime.bus';
import { GuestHub } from './guest-hub.service';
import { qrPublicBase } from './guestmenu.config';
import type { PatchQrSettingsDto, PatchQrTableDto, RotateQrDto } from './guestmenu.dto';
import { newTableToken } from './guestmenu.tokens';
import { lower } from './guestmenu.types';
import { MenuService } from './menu.service';
import { TableContextService } from './table-context.service';

export interface QrTableOut {
  tableId: string;
  code: string;
  areaName: string | null;
  locationId: string;
  token: string;
  /** Path the QR must open on the web origin ("/m/<token>"), and the absolute URL when QR_PUBLIC_BASE_URL is set. */
  path: string;
  url: string | null;
  enabled: boolean;
  orderingEnabled: boolean;
  rotatedAt: string | null;
  rotationCount: number;
  version: number;
  pendingGuestOrders: number;
  waiterCall: { open: true; reason: string; at: string } | null;
}

export interface QrSettingsOut {
  enabled: boolean;
  ordering: 'off' | 'confirm' | 'auto';
  callWaiter: boolean;
  upi: boolean;
  tagline: string;
  accentColor: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  version: number;
}

const toPath = (token: string): string => `/m/${token}`;

@Injectable()
export class QrAdminService extends TenantScopedRepository {
  constructor(
    prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly contexts: TableContextService,
    private readonly hub: GuestHub,
    private readonly menu: MenuService,
    private readonly bus: RealtimeBus,
  ) {
    super(prisma);
  }

  // ── Tables ──────────────────────────────────────────────────────────────────────

  /** Every active table with its QR token. Tables that have none yet get one here (idempotent, race-safe). */
  async listTables(scope: TenantScope, principal: Principal): Promise<QrTableOut[]> {
    const locationFilter = principal.allLocations ? {} : { locationId: { in: [...principal.locationIds] } };
    const tables = await this.prisma.diningTable.findMany({
      where: this.scoped(scope, { isActive: true, ...locationFilter }),
      select: { id: true },
    });
    if (tables.length > 0) {
      await this.prisma.tableQrCode.createMany({
        data: tables.map((t) => ({ businessId: scope.businessId, diningTableId: t.id, token: newTableToken() })),
        skipDuplicates: true,
      });
    }
    const rows = await this.prisma.tableQrCode.findMany({
      where: this.scoped(scope, { diningTable: { isActive: true, ...locationFilter } }),
      include: { diningTable: { select: { code: true, locationId: true, diningArea: { select: { name: true, sortOrder: true } } } } },
    });
    const ids = rows.map((r) => r.diningTableId);
    const [pending, calls] = await Promise.all([
      this.prisma.guestOrder.findMany({
        where: {
          businessId: scope.businessId,
          decision: GuestOrderDecision.PENDING,
          serviceRequest: { status: ServiceRequestStatus.DRAFT, session: { status: GuestSessionStatus.OPEN, diningTableId: { in: ids } } },
        },
        select: { serviceRequest: { select: { session: { select: { diningTableId: true } } } } },
      }),
      this.prisma.waiterCall.findMany({
        where: { businessId: scope.businessId, status: WaiterCallStatus.OPEN, diningTableId: { in: ids } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const pendingBy = new Map<string, number>();
    for (const p of pending) {
      const t = p.serviceRequest.session.diningTableId;
      pendingBy.set(t, (pendingBy.get(t) ?? 0) + 1);
    }
    const callBy = new Map<string, (typeof calls)[number]>();
    for (const c of calls) if (!callBy.has(c.diningTableId)) callBy.set(c.diningTableId, c);

    return rows
      .sort((a, b) => a.diningTable.diningArea.sortOrder - b.diningTable.diningArea.sortOrder || a.diningTable.diningArea.name.localeCompare(b.diningTable.diningArea.name) || a.diningTable.code.localeCompare(b.diningTable.code, undefined, { numeric: true }))
      .map((r) => this.toTable(r, r.diningTable, pendingBy.get(r.diningTableId) ?? 0, callBy.get(r.diningTableId) ?? null));
  }

  async rotate(scope: TenantScope, principal: Principal, tableId: string, dto: RotateQrDto): Promise<QrTableOut> {
    const row = await this.load(scope, principal, tableId);
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== row.version) {
      throw new VersionConflictError('This QR code was changed by someone else. Reload and try again.', { expectedVersion: dto.expectedVersion, actualVersion: row.version });
    }
    const oldToken = row.token;
    await this.prisma.$transaction(async (tx) => {
      const res = await tx.tableQrCode.updateMany({
        where: { id: row.id, businessId: scope.businessId, version: row.version },
        data: { token: newTableToken(), rotationCount: { increment: 1 }, rotatedAt: new Date(), version: { increment: 1 } },
      });
      if (res.count !== 1) throw new VersionConflictError('This QR code was changed by someone else. Reload and try again.');
      await tx.guestMenuToken.updateMany({ where: { businessId: scope.businessId, diningTableId: tableId, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.append(tx, scope, {
        action: 'table_qr.rotated',
        resourceType: 'table_qr_code',
        resourceId: row.id,
        locationId: row.diningTable.locationId,
        metadata: { tableCode: row.diningTable.code, rotationCount: row.rotationCount + 1 },
      });
    });
    this.afterChange(scope.businessId, oldToken);
    return this.one(scope, tableId);
  }

  async patchTable(scope: TenantScope, principal: Principal, tableId: string, dto: PatchQrTableDto): Promise<QrTableOut> {
    const row = await this.load(scope, principal, tableId);
    if (dto.expectedVersion !== undefined && dto.expectedVersion !== row.version) {
      throw new VersionConflictError('This QR code was changed by someone else. Reload and try again.', { expectedVersion: dto.expectedVersion, actualVersion: row.version });
    }
    const data: Prisma.TableQrCodeUpdateManyMutationInput = { version: { increment: 1 } };
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.orderingEnabled !== undefined) data.orderingEnabled = dto.orderingEnabled;
    await this.prisma.$transaction(async (tx) => {
      const res = await tx.tableQrCode.updateMany({ where: { id: row.id, businessId: scope.businessId, version: row.version }, data });
      if (res.count !== 1) throw new VersionConflictError('This QR code was changed by someone else. Reload and try again.');
      await this.audit.append(tx, scope, {
        action: 'table_qr.updated',
        resourceType: 'table_qr_code',
        resourceId: row.id,
        locationId: row.diningTable.locationId,
        metadata: { tableCode: row.diningTable.code, ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}), ...(dto.orderingEnabled !== undefined ? { orderingEnabled: dto.orderingEnabled } : {}) },
      });
    });
    this.afterChange(scope.businessId, dto.enabled === false ? row.token : undefined);
    return this.one(scope, tableId);
  }

  // ── Settings ────────────────────────────────────────────────────────────────────

  async getSettings(scope: TenantScope): Promise<QrSettingsOut> {
    const s = await this.prisma.qrMenuSetting.findUnique({ where: { businessId: scope.businessId } });
    return this.toSettings(s);
  }

  async patchSettings(scope: TenantScope, dto: PatchQrSettingsDto): Promise<QrSettingsOut> {
    const data: Prisma.QrMenuSettingUncheckedUpdateInput = {};
    if (dto.enabled !== undefined) data.enabled = dto.enabled;
    if (dto.ordering !== undefined) data.orderingMode = dto.ordering.toUpperCase() as QrOrderingMode;
    if (dto.callWaiter !== undefined) data.callWaiter = dto.callWaiter;
    if (dto.upi !== undefined) data.upiEnabled = dto.upi;
    if (dto.tagline !== undefined) data.tagline = dto.tagline && dto.tagline.length > 0 ? dto.tagline : null;
    if (dto.accentColor !== undefined) data.accentColor = dto.accentColor ? dto.accentColor.toLowerCase() : null;

    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.qrMenuSetting.findUnique({ where: { businessId: scope.businessId } });
      if (dto.expectedVersion !== undefined && (existing?.version ?? 1) !== dto.expectedVersion) {
        throw new VersionConflictError('These settings were changed by someone else. Reload and try again.', { expectedVersion: dto.expectedVersion, actualVersion: existing?.version ?? 1 });
      }
      const saved = existing
        ? await tx.qrMenuSetting.update({ where: { businessId: scope.businessId }, data: { ...data, version: { increment: 1 } } })
        : await tx.qrMenuSetting.create({ data: { ...(data as Prisma.QrMenuSettingUncheckedCreateInput), businessId: scope.businessId } });
      await this.audit.append(tx, scope, {
        action: 'qr_menu.settings_changed',
        resourceType: 'qr_menu_setting',
        resourceId: saved.id,
        metadata: { changed: Object.keys(dto).filter((k) => k !== 'expectedVersion') },
      });
      return saved;
    });
    this.afterChange(scope.businessId);
    return this.toSettings(result);
  }

  // ── helpers ─────────────────────────────────────────────────────────────────────

  /** Drops caches, closes streams that used a token that no longer works, and nudges open streams and the staff app. */
  private afterChange(businessId: string, deadToken?: string): void {
    if (deadToken) {
      this.contexts.invalidateToken(deadToken);
      this.hub.dropToken(deadToken);
    }
    this.hub.notifyMenu(businessId);
    this.bus.emit(businessId, 'tables');
  }

  /** One table in the list shape (after a rotate / patch). */
  private async one(scope: TenantScope, tableId: string): Promise<QrTableOut> {
    const r = await this.prisma.tableQrCode.findFirstOrThrow({
      where: this.scoped(scope, { diningTableId: tableId }),
      include: { diningTable: { select: { code: true, locationId: true, diningArea: { select: { name: true } } } } },
    });
    const [pending, call] = await Promise.all([
      this.prisma.guestOrder.count({
        where: { businessId: scope.businessId, decision: GuestOrderDecision.PENDING, serviceRequest: { status: ServiceRequestStatus.DRAFT, session: { status: GuestSessionStatus.OPEN, diningTableId: tableId } } },
      }),
      this.prisma.waiterCall.findFirst({ where: { diningTableId: tableId, status: WaiterCallStatus.OPEN }, orderBy: { createdAt: 'desc' } }),
    ]);
    return this.toTable(r, r.diningTable, pending, call);
  }

  private async load(scope: TenantScope, principal: Principal, tableId: string) {
    const table = await this.prisma.diningTable.findFirst({ where: this.scoped(scope, { id: tableId }), select: { id: true, locationId: true, isActive: true } });
    if (!table || !canAccessLocation(principal, table.locationId)) throw new NotFoundError('Dining table not found', { tableId });
    await this.prisma.tableQrCode.createMany({ data: [{ businessId: scope.businessId, diningTableId: tableId, token: newTableToken() }], skipDuplicates: true });
    const row = await this.prisma.tableQrCode.findFirst({
      where: this.scoped(scope, { diningTableId: tableId }),
      include: { diningTable: { select: { code: true, locationId: true } } },
    });
    if (!row) throw new NotFoundError('QR code not found', { tableId });
    return row;
  }

  private toTable(
    r: TableQrCode,
    t: { code: string; locationId: string; diningArea?: { name: string } },
    pendingGuestOrders: number,
    call: { reason: import('@prisma/client').WaiterCallReason; createdAt: Date } | null,
  ): QrTableOut {
    const base = qrPublicBase();
    return {
      tableId: r.diningTableId,
      code: t.code,
      areaName: t.diningArea?.name ?? null,
      locationId: t.locationId,
      token: r.token,
      path: toPath(r.token),
      url: base ? `${base}${toPath(r.token)}` : null,
      enabled: r.enabled,
      orderingEnabled: r.orderingEnabled,
      rotatedAt: r.rotatedAt ? r.rotatedAt.toISOString() : null,
      rotationCount: r.rotationCount,
      version: r.version,
      pendingGuestOrders,
      waiterCall: call ? { open: true, reason: lower(call.reason), at: call.createdAt.toISOString() } : null,
    };
  }

  private toSettings(s: Awaited<ReturnType<QrAdminService['rawSettings']>>): QrSettingsOut {
    return {
      enabled: s?.enabled ?? true,
      ordering: lower(s?.orderingMode ?? QrOrderingMode.CONFIRM),
      callWaiter: s?.callWaiter ?? true,
      upi: s?.upiEnabled ?? false,
      tagline: s?.tagline ?? '',
      accentColor: s?.accentColor ?? null,
      logoUrl: s?.logoUrl ?? null,
      coverUrl: s?.coverUrl ?? null,
      version: s?.version ?? 1,
    };
  }

  private rawSettings(businessId: string) {
    return this.prisma.qrMenuSetting.findUnique({ where: { businessId } });
  }
}
