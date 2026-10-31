import { Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseEnumPipe, ParseUUIDPipe, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { zodBody, zodQuery } from '../common/zod-validation.pipe';
import { CurrentPrincipal, RequirePermission, scopeFromPrincipal, type Principal } from '../iam/principal';
import { RequireModule } from '../modules/module-gating.guard';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError } from '../common/errors';
import { GuestOrderAdminService } from './guest-order-admin.service';
import {
  editGuestOrderSchema,
  guestOrderListQuery,
  patchQrSettingsSchema,
  patchQrTableSchema,
  presentationSchema,
  rejectGuestOrderSchema,
  rotateQrSchema,
  type EditGuestOrderDto,
  type GuestOrderListQuery,
  type PatchQrSettingsDto,
  type PatchQrTableDto,
  type PresentationDto,
  type RejectGuestOrderDto,
  type RotateQrDto,
} from './guestmenu.dto';
import { mediaMaxBytes } from './guestmenu.config';
import { IDEMPOTENCY_KEY_REGEX } from './guestmenu.tokens';
import { ImageService, type BrandKind, type UploadedImage } from './image/image.service';
import { QrAdminService } from './qr-admin.service';
import { GuestHub } from './guest-hub.service';
import { TenantScopedRepository } from '../common/tenant-scoped.repository';
import { Injectable } from '@nestjs/common';
import { AuditService } from '../core/audit/audit.service';
import type { MenuDietType } from '@prisma/client';

const upload = () =>
  UseInterceptors(FileInterceptor('file', { limits: { fileSize: mediaMaxBytes() + 1024, files: 1, fields: 6, parts: 8, fieldSize: 4096 } }));

const KINDS = ['logo', 'cover'] as const;

/** `Idempotency-Key` when it is well-formed, otherwise a fresh key (the staff web always sends one). */
const keyOf = (h: string | undefined): string => (h && IDEMPOTENCY_KEY_REGEX.test(h) ? h : randomUUID());

// ── Table QR codes + settings ─────────────────────────────────────────────────────

@Controller('admin/qr')
@RequireModule('restaurant')
@RequirePermission('restaurant.qr.manage')
export class QrAdminController {
  constructor(
    private readonly qr: QrAdminService,
    private readonly images: ImageService,
  ) {}

  @Get('tables')
  tables(@CurrentPrincipal() p: Principal) {
    return this.qr.listTables(scopeFromPrincipal(p), p);
  }

  @Post('tables/:tableId/rotate')
  @HttpCode(200)
  rotate(@CurrentPrincipal() p: Principal, @Param('tableId', ParseUUIDPipe) tableId: string, @Body(zodBody(rotateQrSchema)) dto: RotateQrDto) {
    return this.qr.rotate(scopeFromPrincipal(p), p, tableId, dto);
  }

  @Patch('tables/:tableId')
  patchTable(@CurrentPrincipal() p: Principal, @Param('tableId', ParseUUIDPipe) tableId: string, @Body(zodBody(patchQrTableSchema)) dto: PatchQrTableDto) {
    return this.qr.patchTable(scopeFromPrincipal(p), p, tableId, dto);
  }

  @Get('settings')
  settings(@CurrentPrincipal() p: Principal) {
    return this.qr.getSettings(scopeFromPrincipal(p));
  }

  @Patch('settings')
  patchSettings(@CurrentPrincipal() p: Principal, @Body(zodBody(patchQrSettingsSchema)) dto: PatchQrSettingsDto) {
    return this.qr.patchSettings(scopeFromPrincipal(p), dto);
  }

  /** Logo / cover of the guest menu. multipart field `file` (+ optional `blur`, `color`). */
  @Post('settings/:kind')
  @HttpCode(200)
  @upload()
  setBrand(
    @CurrentPrincipal() p: Principal,
    @Param('kind', new ParseEnumPipe(KINDS)) kind: BrandKind,
    @UploadedFile() file: UploadedImage | undefined,
    @Body() body: { blur?: unknown; color?: unknown } | undefined,
  ) {
    return this.images.setBrandImage(scopeFromPrincipal(p), kind, file, body ?? {});
  }

  @Delete('settings/:kind')
  @HttpCode(204)
  async removeBrand(@CurrentPrincipal() p: Principal, @Param('kind', new ParseEnumPipe(KINDS)) kind: BrandKind): Promise<void> {
    await this.images.removeBrandImage(scopeFromPrincipal(p), kind);
  }
}

// ── Menu photos + presentation ────────────────────────────────────────────────────

@Injectable()
export class MenuPresentationService extends TenantScopedRepository {
  constructor(
    prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly hub: GuestHub,
  ) {
    super(prisma);
  }

  async setItemPresentation(scope: ReturnType<typeof scopeFromPrincipal>, itemId: string, dto: PresentationDto) {
    const item = await this.prisma.catalogItem.findFirst({ where: this.scoped(scope, { id: itemId }), select: { id: true } });
    if (!item) throw new NotFoundError('Menu item not found', { id: itemId });
    const row = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.catalogItem.update({
        where: { id: itemId },
        data: {
          ...(dto.dietType !== undefined ? { dietType: dto.dietType as MenuDietType | null } : {}),
          ...(dto.menuTags !== undefined ? { menuTags: [...new Set(dto.menuTags)] } : {}),
          ...(dto.spiceLevel !== undefined ? { spiceLevel: dto.spiceLevel } : {}),
        },
        select: { id: true, dietType: true, menuTags: true, spiceLevel: true },
      });
      await this.audit.append(tx, scope, { action: 'catalog_item.presentation_set', resourceType: 'catalog_item', resourceId: itemId, metadata: { changed: Object.keys(dto) } });
      return updated;
    });
    this.hub.notifyMenu(scope.businessId);
    return row;
  }
}

@Controller('admin/menu')
@RequireModule('restaurant')
@RequirePermission('restaurant.qr.manage')
export class MenuAdminController {
  constructor(
    private readonly images: ImageService,
    private readonly presentation: MenuPresentationService,
  ) {}

  @Post('items/:id/image')
  @HttpCode(200)
  @upload()
  setItemImage(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedImage | undefined,
    @Body() body: { blur?: unknown; color?: unknown } | undefined,
  ) {
    return this.images.setItemImage(scopeFromPrincipal(p), id, file, body ?? {});
  }

  @Delete('items/:id/image')
  @HttpCode(204)
  async removeItemImage(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.images.removeItemImage(scopeFromPrincipal(p), id);
  }

  @Patch('items/:id/presentation')
  setPresentation(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string, @Body(zodBody(presentationSchema)) dto: PresentationDto) {
    return this.presentation.setItemPresentation(scopeFromPrincipal(p), id, dto);
  }

  @Post('categories/:id/image')
  @HttpCode(200)
  @upload()
  setCategoryImage(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedImage | undefined,
    @Body() body: { blur?: unknown; color?: unknown } | undefined,
  ) {
    return this.images.setCategoryImage(scopeFromPrincipal(p), id, file, body ?? {});
  }

  @Delete('categories/:id/image')
  @HttpCode(204)
  async removeCategoryImage(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.images.removeCategoryImage(scopeFromPrincipal(p), id);
  }
}

// ── Guest-order inbox ─────────────────────────────────────────────────────────────

@Controller('admin/guest-orders')
@RequireModule('restaurant')
@RequirePermission('restaurant.guestorder.manage')
export class GuestOrderAdminController {
  constructor(private readonly svc: GuestOrderAdminService) {}

  @Get()
  list(@CurrentPrincipal() p: Principal, @Query(zodQuery(guestOrderListQuery)) q: GuestOrderListQuery) {
    return this.svc.list(scopeFromPrincipal(p), p, q);
  }

  // Declared before ':id/...' so "alerts" is never read as an order id.
  @Get('alerts')
  alerts(@CurrentPrincipal() p: Principal) {
    return this.svc.alerts(scopeFromPrincipal(p), p);
  }

  @Post('alerts/:tableId/ack')
  @HttpCode(204)
  async ack(@CurrentPrincipal() p: Principal, @Param('tableId', ParseUUIDPipe) tableId: string): Promise<void> {
    await this.svc.ackTable(scopeFromPrincipal(p), p, tableId);
  }

  @Post(':id/confirm')
  @HttpCode(200)
  confirm(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.confirm(scopeFromPrincipal(p), p, id);
  }

  @Post(':id/reject')
  @HttpCode(200)
  reject(@CurrentPrincipal() p: Principal, @Param('id', ParseUUIDPipe) id: string, @Body(zodBody(rejectGuestOrderSchema)) dto: RejectGuestOrderDto) {
    return this.svc.reject(scopeFromPrincipal(p), p, id, dto.reason);
  }

  @Post(':id/edit')
  @HttpCode(200)
  edit(
    @CurrentPrincipal() p: Principal,
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body(zodBody(editGuestOrderSchema)) dto: EditGuestOrderDto,
  ) {
    return this.svc.edit(scopeFromPrincipal(p), p, id, dto, keyOf(key));
  }
}
