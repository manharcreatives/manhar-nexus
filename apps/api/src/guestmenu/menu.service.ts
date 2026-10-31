import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { modifierGroupBounds } from '../restaurant/order/order.service';
import { caps } from './guestmenu.config';
import { fingerprint, weakEtag } from './guestmenu.tokens';
import type { OrderingMode, TableContext } from './guestmenu.types';

export interface MenuAddOnOption { id: string; name: string; priceMinor: number }
export interface MenuAddOnGroup { id: string; name: string; min: number; max: number; options: MenuAddOnOption[] }
export interface MenuVariant { id: string; name: string; priceMinor: number }
export interface MenuItemOut {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceMinor: number;
  imageUrl: string | null;
  thumbUrl: string | null;
  blurDataUri: string | null;
  color: string | null;
  veg: 'veg' | 'nonveg' | 'egg' | null;
  tags: string[];
  spice: number | null;
  soldOut: boolean;
  variants: MenuVariant[];
  addOnGroups: MenuAddOnGroup[];
}
export interface MenuCategoryOut { id: string; name: string; description: string | null; imageUrl: string | null; blurDataUri: string | null; color: string | null }

export interface CatalogPart { categories: MenuCategoryOut[]; items: MenuItemOut[] }

export interface MenuPayload {
  business: {
    name: string;
    slug: string | null;
    tagline: string | null;
    logoUrl: string | null;
    coverUrl: string | null;
    coverBlurDataUri: string | null;
    coverColor: string | null;
    accentColor: string | null;
    currency: string;
  };
  table: { label: string; areaName: string | null; open: boolean };
  settings: { ordering: OrderingMode; callWaiter: boolean; payment: { upi: boolean } };
  categories: MenuCategoryOut[];
  items: MenuItemOut[];
  etag: string;
  serverTime: string;
}

const DIET = { VEG: 'veg', NONVEG: 'nonveg', EGG: 'egg' } as const;

/** Turns a stored path-absolute media URL ("/media/<biz>/<file>") into an absolute one for the public page. */
export function absolutize(base: string, url: string | null): string | null {
  if (!url) return null;
  return /^(https?:|data:)/i.test(url) ? url : `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * Builds the public menu. The catalog part is business-wide and cached for GUESTMENU_MENU_CACHE_MS (dropped at once by
 * in-process catalog edits via invalidate()), so a busy dining room does not turn into one DB query per phone.
 * The ETag fingerprints the whole payload except the server clock and the absolute-URL base, so it only changes when
 * something a guest can see changes.
 */
@Injectable()
export class MenuService {
  private readonly cache = new Map<string, { at: number; part: CatalogPart; inflight?: Promise<CatalogPart> }>();

  constructor(private readonly prisma: PrismaService) {}

  invalidate(businessId: string): void {
    this.cache.delete(businessId);
  }

  async catalog(businessId: string): Promise<CatalogPart> {
    const hit = this.cache.get(businessId);
    if (hit && Date.now() - hit.at < caps.menuCacheMs()) return hit.part;
    const part = await this.build(businessId);
    this.cache.set(businessId, { at: Date.now(), part });
    return part;
  }

  /** Payload with RELATIVE media URLs (what the ETag is computed over). */
  async relativePayload(ctx: TableContext, open: boolean): Promise<Omit<MenuPayload, 'serverTime'>> {
    const part = await this.catalog(ctx.businessId);
    const s = ctx.settings;
    const body = {
      business: {
        name: ctx.business.name,
        slug: ctx.business.slug,
        tagline: s.tagline,
        logoUrl: s.logoUrl ?? ctx.business.logoUrl,
        coverUrl: s.coverUrl,
        coverBlurDataUri: s.coverBlur,
        coverColor: s.coverColor,
        accentColor: s.accentColor ?? ctx.business.accentColor,
        currency: ctx.business.currencyCode,
      },
      table: { label: ctx.tableCode, areaName: ctx.areaName, open },
      settings: { ordering: ctx.ordering, callWaiter: s.callWaiter, payment: { upi: s.upiEnabled && ctx.upiConfigured } },
      categories: part.categories,
      items: part.items,
    };
    return { ...body, etag: weakEtag(fingerprint(body)) };
  }

  /** ETag only (used by the live stream to detect "menu changed" without building a response). */
  async etagFor(ctx: TableContext, open: boolean): Promise<string> {
    return (await this.relativePayload(ctx, open)).etag;
  }

  async publicPayload(ctx: TableContext, open: boolean, mediaBase: string): Promise<MenuPayload> {
    const rel = await this.relativePayload(ctx, open);
    const abs = (u: string | null): string | null => absolutize(mediaBase, u);
    return {
      ...rel,
      business: { ...rel.business, logoUrl: abs(rel.business.logoUrl), coverUrl: abs(rel.business.coverUrl) },
      categories: rel.categories.map((c) => ({ ...c, imageUrl: abs(c.imageUrl) })),
      items: rel.items.map((i) => ({ ...i, imageUrl: abs(i.imageUrl), thumbUrl: abs(i.thumbUrl) })),
      serverTime: new Date().toISOString(),
    };
  }

  private async build(businessId: string): Promise<CatalogPart> {
    const [categories, items] = await Promise.all([
      this.prisma.catalogCategory.findMany({
        where: { businessId, isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.catalogItem.findMany({
        where: { businessId, isActive: true, category: { isActive: true } },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          variants: { orderBy: [{ sortOrder: 'asc' }, { priceAdjMinorUnits: 'asc' }, { name: 'asc' }] },
          modifierGroups: {
            orderBy: { sortOrder: 'asc' },
            include: { modifierGroup: { include: { options: { orderBy: [{ sortOrder: 'asc' }, { priceAdjMinorUnits: 'asc' }, { name: 'asc' }] } } } },
          },
        },
      }),
    ]);

    const outItems: MenuItemOut[] = items.map((it) => {
      const addOnGroups: MenuAddOnGroup[] = [];
      for (const link of it.modifierGroups) {
        const g = link.modifierGroup;
        if (!g.isActive || g.businessId !== businessId) continue;
        const options = g.options.filter((o) => o.isAvailable);
        if (options.length === 0) continue;
        const { min, max } = modifierGroupBounds(g);
        addOnGroups.push({
          id: g.id,
          name: g.name,
          min,
          max,
          options: options.map((o) => ({ id: o.id, name: o.name, priceMinor: o.priceAdjMinorUnits })),
        });
      }
      return {
        id: it.id,
        categoryId: it.categoryId,
        name: it.name,
        description: it.description,
        priceMinor: it.basePriceMinorUnits,
        imageUrl: it.imageUrl,
        thumbUrl: it.imageThumbUrl,
        blurDataUri: it.imageBlur,
        color: it.imageColor,
        veg: it.dietType ? DIET[it.dietType] : null,
        tags: it.menuTags,
        spice: it.spiceLevel,
        // Sold out when switched off, or when it has variants and every one of them is switched off.
        soldOut: !it.isAvailable || (it.variants.length > 0 && !it.variants.some((v) => v.isAvailable)),
        variants: it.variants.filter((v) => v.isAvailable).map((v) => ({ id: v.id, name: v.name, priceMinor: it.basePriceMinorUnits + v.priceAdjMinorUnits })),
        addOnGroups,
      };
    });
    const used = new Set(outItems.map((i) => i.categoryId));
    return {
      categories: categories
        .filter((c) => used.has(c.id))
        .map((c) => ({ id: c.id, name: c.name, description: c.description, imageUrl: c.imageUrl, blurDataUri: c.imageBlur, color: c.imageColor })),
      items: outItems,
    };
  }
}
