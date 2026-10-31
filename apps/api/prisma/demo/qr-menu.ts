import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { MenuDietType, QrOrderingMode } from '@prisma/client';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { newTableToken } from '../../src/guestmenu/guestmenu.tokens';
import { mediaDir } from '../../src/guestmenu/guestmenu.config';
import { LocalDiskImageStore } from '../../src/guestmenu/image/image-store';

/**
 * QR digital menu demo data (ADR-035): one QR code per table, the restaurant-wide menu policy, vegetarian marks / tags /
 * spice levels on the demo dishes, and (when the marketing photos are on disk) pictures copied into MEDIA_DIR.
 * Idempotent: running it twice changes nothing. Nothing here runs in production (the demo seed refuses it).
 */
const VEG: Record<string, { diet: MenuDietType; tags?: string[]; spice?: number }> = {
  'Paneer Tikka': { diet: MenuDietType.VEG, tags: ['bestseller', "chef's pick"], spice: 2 },
  'Veg Soup': { diet: MenuDietType.VEG, spice: 0 },
  'Spring Rolls': { diet: MenuDietType.VEG, tags: ['crispy'], spice: 1 },
  'Dal Makhani': { diet: MenuDietType.VEG, tags: ['slow cooked'], spice: 1 },
  'Paneer Butter Masala': { diet: MenuDietType.VEG, tags: ['bestseller'], spice: 1 },
  'Butter Naan': { diet: MenuDietType.VEG },
  'Jeera Rice': { diet: MenuDietType.VEG },
  'Masala Chai': { diet: MenuDietType.VEG },
  Lassi: { diet: MenuDietType.VEG, tags: ['house special'] },
  'Cold Coffee': { diet: MenuDietType.VEG },
  'Gulab Jamun': { diet: MenuDietType.VEG, tags: ['sweet'] },
  'Ice Cream Scoop': { diet: MenuDietType.VEG },
};

/** Item name -> marketing photo (apps/web/public/landing/<name>-800.webp). Skipped quietly when the file is not there. */
const ITEM_PHOTO: Record<string, string> = {
  'Paneer Tikka': 'chef-hands-plating',
  'Paneer Butter Masala': 'indian-thali-overhead',
  'Dal Makhani': 'indian-thali-overhead',
  'Masala Chai': 'specialty-cafe-counter',
  'Cold Coffee': 'specialty-cafe-counter',
  'Gulab Jamun': 'bakery-morning-display',
};
const CATEGORY_PHOTO: Record<string, string> = { Starters: 'chef-hands-plating', 'Main Course': 'indian-thali-overhead', Beverages: 'bar-pour-evening', Desserts: 'bakery-morning-display' };
const COVER_PHOTO = 'restaurant-dining-golden-hour';

function findLandingDir(): string | null {
  for (const rel of ['../../../web/public/landing', '../../web/public/landing', '../web/public/landing']) {
    const dir = resolve(__dirname, rel);
    if (existsSync(dir)) return dir;
  }
  return null;
}

export interface QrDemoResult {
  qrCodes: number;
  dishesMarked: number;
  pictures: number;
  mediaDir: string | null;
}

export async function seedQrMenu(prisma: PrismaService, businessId: string): Promise<QrDemoResult> {
  // 1. A QR code for every active table.
  const tables = await prisma.diningTable.findMany({ where: { businessId, isActive: true }, select: { id: true } });
  const created = await prisma.tableQrCode.createMany({
    data: tables.map((t) => ({ businessId, diningTableId: t.id, token: newTableToken() })),
    skipDuplicates: true,
  });

  // 2. Menu policy: guests order, the waiter confirms; UPI offered (works once a UPI ID is set in Checkout settings).
  const existing = await prisma.qrMenuSetting.findUnique({ where: { businessId } });
  if (!existing) {
    await prisma.qrMenuSetting.create({
      data: { businessId, enabled: true, orderingMode: QrOrderingMode.CONFIRM, callWaiter: true, upiEnabled: true, tagline: 'Fresh, honest food, served with care' },
    });
  }

  // 3. Dietary marks, tags, spice. Only fills what is still empty so staff edits are never overwritten.
  let marked = 0;
  for (const [name, v] of Object.entries(VEG)) {
    const r = await prisma.catalogItem.updateMany({
      where: { businessId, name, dietType: null },
      data: { dietType: v.diet, menuTags: v.tags ?? [], spiceLevel: v.spice ?? null },
    });
    marked += r.count;
  }

  // 4. Pictures (optional): copy the 800 px marketing photos into the media store, content-addressed like real uploads.
  const landing = findLandingDir();
  const root = mediaDir();
  let pictures = 0;
  if (landing && root) {
    const store = new LocalDiskImageStore();
    const put = async (photo: string): Promise<string | null> => {
      const path = join(landing, `${photo}-800.webp`);
      if (!existsSync(path)) return null;
      const data = readFileSync(path);
      const file = `${createHash('sha1').update(data).digest('hex')}.webp`;
      await store.put(businessId, file, data);
      return `/media/${businessId}/${file}`;
    };
    for (const [name, photo] of Object.entries(ITEM_PHOTO)) {
      const url = await put(photo);
      if (!url) continue;
      const r = await prisma.catalogItem.updateMany({ where: { businessId, name, imageUrl: null }, data: { imageUrl: url, imageThumbUrl: url } });
      pictures += r.count;
    }
    for (const [name, photo] of Object.entries(CATEGORY_PHOTO)) {
      const url = await put(photo);
      if (!url) continue;
      const r = await prisma.catalogCategory.updateMany({ where: { businessId, name, imageUrl: null }, data: { imageUrl: url } });
      pictures += r.count;
    }
    const cover = await put(COVER_PHOTO);
    if (cover) {
      const r = await prisma.qrMenuSetting.updateMany({ where: { businessId, coverUrl: null }, data: { coverUrl: cover } });
      pictures += r.count;
    }
  }
  return { qrCodes: created.count, dishesMarked: marked, pictures, mediaDir: root };
}
