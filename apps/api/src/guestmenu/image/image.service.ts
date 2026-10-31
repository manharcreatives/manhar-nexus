import { Inject, Injectable } from '@nestjs/common';
import { NotFoundError, ValidationError } from '../../common/errors';
import { TenantScopedRepository } from '../../common/tenant-scoped.repository';
import type { TenantScope } from '../../common/tenant-scope';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeBus } from '../../realtime/realtime.bus';
import { GuestHub } from '../guest-hub.service';
import { mediaMaxBytes } from '../guestmenu.config';
import { MediaUnavailableError, PayloadTooLargeError } from '../guestmenu.errors';
import { IMAGE_STORE, MEDIA_FILE_RE, type ImageStore } from './image-store';
import { processUpload } from './image-processing';
import { validBlur, validColor } from './image-sanitize';

/** The part of a multer memory file this service reads (no @types/multer in the repo). */
export interface UploadedImage {
  buffer: Buffer;
  size: number;
  originalname?: string;
  mimetype?: string;
}

export interface ImageExtras {
  /** Optional client-made 16 px blur-up data URI and dominant colour; used only when the server could not make its own. */
  blur?: unknown;
  color?: unknown;
}

export interface StoredPicture {
  imageUrl: string;
  imageThumbUrl: string | null;
  blurDataUri: string | null;
  color: string | null;
}

export type BrandKind = 'logo' | 'cover';

const urlOf = (businessId: string, file: string): string => `/media/${businessId}/${file}`;
/** "/media/<biz>/<file>" -> "<file>" (null for anything else). */
function fileOf(businessId: string, url: string | null): string | null {
  if (!url) return null;
  const prefix = `/media/${businessId}/`;
  if (!url.startsWith(prefix)) return null;
  const f = url.slice(prefix.length);
  return MEDIA_FILE_RE.test(f) ? f : null;
}

/**
 * Menu pictures: validates and stores uploads through the pluggable ImageStore and keeps the catalog rows pointing at
 * them. Storage is content-addressed, so re-uploading the same picture is a harmless no-op (idempotent) and every URL is
 * immutable. Files that nothing references any more are removed after a replace/delete.
 */
@Injectable()
export class ImageService extends TenantScopedRepository {
  constructor(
    prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(IMAGE_STORE) private readonly store: ImageStore,
    private readonly hub: GuestHub,
    private readonly bus: RealtimeBus,
  ) {
    super(prisma);
  }

  async setItemImage(scope: TenantScope, itemId: string, file: UploadedImage | undefined, extras: ImageExtras): Promise<StoredPicture & { itemId: string }> {
    const item = await this.prisma.catalogItem.findFirst({ where: this.scoped(scope, { id: itemId }), select: { id: true, imageUrl: true, imageThumbUrl: true } });
    if (!item) throw new NotFoundError('Menu item not found', { id: itemId });
    const pic = await this.ingest(scope, file, extras);
    await this.prisma.$transaction(async (tx) => {
      await tx.catalogItem.update({
        where: { id: itemId },
        data: { imageUrl: pic.imageUrl, imageThumbUrl: pic.imageThumbUrl, imageBlur: pic.blurDataUri, imageColor: pic.color },
      });
      await this.audit.append(tx, scope, { action: 'catalog_item.image_set', resourceType: 'catalog_item', resourceId: itemId, metadata: { file: pic.imageUrl } });
    });
    await this.dropUnreferenced(scope.businessId, [item.imageUrl, item.imageThumbUrl]);
    this.changed(scope.businessId);
    return { itemId, ...pic };
  }

  async removeItemImage(scope: TenantScope, itemId: string): Promise<void> {
    const item = await this.prisma.catalogItem.findFirst({ where: this.scoped(scope, { id: itemId }), select: { id: true, imageUrl: true, imageThumbUrl: true } });
    if (!item) throw new NotFoundError('Menu item not found', { id: itemId });
    if (!item.imageUrl) return; // idempotent
    await this.prisma.$transaction(async (tx) => {
      await tx.catalogItem.update({ where: { id: itemId }, data: { imageUrl: null, imageThumbUrl: null, imageBlur: null, imageColor: null } });
      await this.audit.append(tx, scope, { action: 'catalog_item.image_removed', resourceType: 'catalog_item', resourceId: itemId, metadata: {} });
    });
    await this.dropUnreferenced(scope.businessId, [item.imageUrl, item.imageThumbUrl]);
    this.changed(scope.businessId);
  }

  async setCategoryImage(scope: TenantScope, categoryId: string, file: UploadedImage | undefined, extras: ImageExtras): Promise<StoredPicture & { categoryId: string }> {
    const cat = await this.prisma.catalogCategory.findFirst({ where: this.scoped(scope, { id: categoryId }), select: { id: true, imageUrl: true } });
    if (!cat) throw new NotFoundError('Menu category not found', { id: categoryId });
    const pic = await this.ingest(scope, file, extras);
    await this.prisma.$transaction(async (tx) => {
      await tx.catalogCategory.update({ where: { id: categoryId }, data: { imageUrl: pic.imageUrl, imageBlur: pic.blurDataUri, imageColor: pic.color } });
      await this.audit.append(tx, scope, { action: 'catalog_category.image_set', resourceType: 'catalog_category', resourceId: categoryId, metadata: { file: pic.imageUrl } });
    });
    await this.dropUnreferenced(scope.businessId, [cat.imageUrl]);
    this.changed(scope.businessId);
    return { categoryId, ...pic };
  }

  async removeCategoryImage(scope: TenantScope, categoryId: string): Promise<void> {
    const cat = await this.prisma.catalogCategory.findFirst({ where: this.scoped(scope, { id: categoryId }), select: { id: true, imageUrl: true } });
    if (!cat) throw new NotFoundError('Menu category not found', { id: categoryId });
    if (!cat.imageUrl) return;
    await this.prisma.$transaction(async (tx) => {
      await tx.catalogCategory.update({ where: { id: categoryId }, data: { imageUrl: null, imageBlur: null, imageColor: null } });
      await this.audit.append(tx, scope, { action: 'catalog_category.image_removed', resourceType: 'catalog_category', resourceId: categoryId, metadata: {} });
    });
    await this.dropUnreferenced(scope.businessId, [cat.imageUrl]);
    this.changed(scope.businessId);
  }

  /** Logo / cover of the guest menu (qr_menu_setting). */
  async setBrandImage(scope: TenantScope, kind: BrandKind, file: UploadedImage | undefined, extras: ImageExtras): Promise<{ kind: BrandKind; imageUrl: string; url: string; blurDataUri: string | null; color: string | null }> {
    const pic = await this.ingest(scope, file, extras);
    const prev = await this.prisma.qrMenuSetting.findUnique({ where: { businessId: scope.businessId } });
    const data =
      kind === 'logo'
        ? { logoUrl: pic.imageUrl, logoBlur: pic.blurDataUri }
        : { coverUrl: pic.imageUrl, coverBlur: pic.blurDataUri, coverColor: pic.color };
    await this.prisma.$transaction(async (tx) => {
      await tx.qrMenuSetting.upsert({
        where: { businessId: scope.businessId },
        create: { businessId: scope.businessId, ...data },
        update: { ...data, version: { increment: 1 } },
      });
      await this.audit.append(tx, scope, { action: `qr_menu.${kind}_set`, resourceType: 'qr_menu_setting', metadata: { file: pic.imageUrl } });
    });
    await this.dropUnreferenced(scope.businessId, [kind === 'logo' ? prev?.logoUrl ?? null : prev?.coverUrl ?? null]);
    this.changed(scope.businessId);
    return { kind, imageUrl: pic.imageUrl, url: pic.imageUrl, blurDataUri: pic.blurDataUri, color: pic.color };
  }

  async removeBrandImage(scope: TenantScope, kind: BrandKind): Promise<void> {
    const prev = await this.prisma.qrMenuSetting.findUnique({ where: { businessId: scope.businessId } });
    const old = kind === 'logo' ? prev?.logoUrl : prev?.coverUrl;
    if (!prev || !old) return;
    const data = kind === 'logo' ? { logoUrl: null, logoBlur: null } : { coverUrl: null, coverBlur: null, coverColor: null };
    await this.prisma.$transaction(async (tx) => {
      await tx.qrMenuSetting.update({ where: { businessId: scope.businessId }, data: { ...data, version: { increment: 1 } } });
      await this.audit.append(tx, scope, { action: `qr_menu.${kind}_removed`, resourceType: 'qr_menu_setting', resourceId: prev.id, metadata: {} });
    });
    await this.dropUnreferenced(scope.businessId, [old]);
    this.changed(scope.businessId);
  }

  // ── internals ───────────────────────────────────────────────────────────────────

  private async ingest(scope: TenantScope, file: UploadedImage | undefined, extras: ImageExtras): Promise<StoredPicture> {
    if (!this.store.available) throw new MediaUnavailableError('Picture uploads are not configured on this server (set MEDIA_DIR).');
    if (!file || !file.buffer || file.size === 0) throw new ValidationError('Attach the picture in the "file" field of a multipart form.', { reason: 'FILE_REQUIRED' });
    if (file.size > mediaMaxBytes()) throw new PayloadTooLargeError(`The picture is larger than ${Math.round(mediaMaxBytes() / 1024 / 1024)} MB.`);
    const processed = await processUpload(file.buffer);
    await this.store.put(scope.businessId, processed.main.file, processed.main.data);
    if (processed.thumb) await this.store.put(scope.businessId, processed.thumb.file, processed.thumb.data);
    return {
      imageUrl: urlOf(scope.businessId, processed.main.file),
      imageThumbUrl: processed.thumb ? urlOf(scope.businessId, processed.thumb.file) : null,
      blurDataUri: processed.blurDataUri ?? validBlur(extras.blur),
      color: processed.color ?? validColor(extras.color),
    };
  }

  /** Deletes stored files that no catalog row or QR setting points at any more. Best effort; never fails the request. */
  private async dropUnreferenced(businessId: string, urls: (string | null)[]): Promise<void> {
    for (const url of new Set(urls.filter((u): u is string => !!u))) {
      const file = fileOf(businessId, url);
      if (!file) continue;
      try {
        const [items, cats, settings] = await Promise.all([
          this.prisma.catalogItem.count({ where: { businessId, OR: [{ imageUrl: url }, { imageThumbUrl: url }] } }),
          this.prisma.catalogCategory.count({ where: { businessId, imageUrl: url } }),
          this.prisma.qrMenuSetting.count({ where: { businessId, OR: [{ logoUrl: url }, { coverUrl: url }] } }),
        ]);
        if (items + cats + settings === 0) {
          await this.store.remove(businessId, file);
          // A main picture's 480 px sibling goes with it when nothing else points at that either.
          if (!/-\d+\./.test(file)) {
            const thumb = file.replace(/\.(webp|jpg|png)$/, '-480.$1');
            const thumbUrl = urlOf(businessId, thumb);
            const stillUsed = await this.prisma.catalogItem.count({ where: { businessId, imageThumbUrl: thumbUrl } });
            if (stillUsed === 0) await this.store.remove(businessId, thumb);
          }
        }
      } catch {
        /* orphan files are harmless */
      }
    }
  }

  private changed(businessId: string): void {
    this.hub.notifyMenu(businessId);
    this.bus.emit(businessId, 'tables');
  }
}
