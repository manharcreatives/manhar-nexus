import { describe, expect, it } from 'vitest';
import { asArray, toGuestOrder, toPhotoCategory, toPhotoItem, toPresentation, toQrSettings, toQrTable, toUploadedPicture, toWaiterAlert } from './normalize';

/** Rows copied from the shapes in apps/api/src/guestmenu (qr-admin.service.ts, guest-order-admin.service.ts, image.service.ts). */
const tableRow = {
  tableId: '0d7d4d6e-0000-4000-8000-000000000001',
  code: 'T4',
  areaName: 'Terrace',
  locationId: 'loc-1',
  token: 'tok_AbCdEfGhIjKlMnOpQrStUvWxYz012345',
  path: '/m/tok_AbCdEfGhIjKlMnOpQrStUvWxYz012345',
  url: 'https://nexus.example.com/m/tok_AbCdEfGhIjKlMnOpQrStUvWxYz012345',
  enabled: true,
  orderingEnabled: false,
  rotatedAt: '2026-10-31T10:00:00.000Z',
  rotationCount: 2,
  version: 5,
  pendingGuestOrders: 3,
  waiterCall: { open: true, reason: 'bill', at: '2026-10-31T11:00:00.000Z' },
};

describe('toQrTable', () => {
  it('reads the staff QR table row exactly', () => {
    expect(toQrTable(tableRow)).toEqual({
      tableId: tableRow.tableId,
      code: 'T4',
      areaName: 'Terrace',
      locationId: 'loc-1',
      token: tableRow.token,
      url: tableRow.url,
      enabled: true,
      orderingEnabled: false,
      rotatedAt: '2026-10-31T10:00:00.000Z',
      rotationCount: 2,
      version: 5,
      pendingGuestOrders: 3,
      waiterCall: { reason: 'bill', at: '2026-10-31T11:00:00.000Z' },
    });
  });
  it('url null stays null (page origin is used) and a closed call is no call', () => {
    const t = toQrTable({ ...tableRow, url: null, waiterCall: null, enabled: false });
    expect(t.url).toBeNull();
    expect(t.waiterCall).toBeNull();
    expect(t.enabled).toBe(false);
  });
});

describe('toQrSettings', () => {
  it('reads the flat settings row including the version', () => {
    expect(toQrSettings({ enabled: false, ordering: 'auto', callWaiter: false, upi: true, tagline: 'Hi', accentColor: '#1dba3c', logoUrl: '/media/b/a.webp', coverUrl: null, version: 7 })).toEqual({
      enabled: false,
      ordering: 'auto',
      callWaiter: false,
      upi: true,
      tagline: 'Hi',
      accentColor: '#1dba3c',
      logoUrl: '/media/b/a.webp',
      coverUrl: null,
      version: 7,
    });
  });
  it('falls back to safe defaults', () => {
    expect(toQrSettings(null)).toMatchObject({ enabled: true, ordering: 'confirm', upi: false, tagline: '', version: 1 });
  });
});

const orderRow = {
  id: 'sr-1',
  guestOrderId: 'go-1',
  requestNumber: null,
  status: 'AWAITING_CONFIRMATION',
  requestStatus: 'DRAFT',
  decision: 'PENDING',
  mode: 'confirm',
  source: 'GUEST',
  tableId: 'tbl-2',
  tableCode: 'T2',
  areaName: 'Main Hall',
  sessionId: 's-1',
  locationId: 'loc-1',
  guestName: 'Asha',
  placedAt: '2026-10-31T11:55:00.000Z',
  decidedAt: null,
  decidedBy: null,
  rejectReason: null,
  note: 'Less spicy',
  version: 2,
  lines: [
    { id: 'l-1', name: 'Paneer Tikka', variantName: 'Half', qty: 2, unitPriceMinor: 24000, addOns: [{ name: 'Extra mint', priceMinor: 2000 }], note: null, cancelled: false },
    { id: 'l-2', name: 'Naan', variantName: null, qty: 1, unitPriceMinor: 6000, addOns: [], note: 'crisp', cancelled: true },
  ],
  totalMinor: 52000,
};

describe('toGuestOrder', () => {
  it('reads the admin guest-order row', () => {
    const o = toGuestOrder(orderRow);
    expect(o).toMatchObject({ id: 'sr-1', status: 'AWAITING_CONFIRMATION', tableCode: 'T2', locationId: 'loc-1', guestName: 'Asha', note: 'Less spicy', totalMinor: 52000 });
    expect(o.requestNumber).toBeNull();
    expect(o.lines).toHaveLength(2);
    expect(o.lines[0]).toEqual({ id: 'l-1', name: 'Paneer Tikka', variantName: 'Half', qty: 2, unitPriceMinor: 24000, addOns: [{ name: 'Extra mint', priceMinor: 2000 }], note: null, cancelled: false });
    expect(o.lines[1].cancelled).toBe(true);
  });
  it('uses the server total, and computes it (without cancelled lines) only when it is missing', () => {
    expect(toGuestOrder({ ...orderRow, totalMinor: undefined }).totalMinor).toBe(2 * (24000 + 2000));
  });
  it('knows the four admin statuses', () => {
    for (const status of ['AWAITING_CONFIRMATION', 'CONFIRMED', 'REJECTED', 'CANCELLED']) expect(toGuestOrder({ ...orderRow, status }).status).toBe(status);
  });
});

describe('alerts, photos, uploads', () => {
  it('alert rows', () => {
    expect(toWaiterAlert({ id: 'c1', tableId: 'tbl-2', tableCode: 'T2', areaName: 'Main Hall', locationId: 'l', reason: 'water', at: '2026-10-31T12:00:00.000Z' })).toEqual({
      tableId: 'tbl-2',
      tableCode: 'T2',
      areaName: 'Main Hall',
      reason: 'water',
      at: '2026-10-31T12:00:00.000Z',
    });
  });
  it('catalog rows carry the picture urls', () => {
    expect(toPhotoItem({ id: 'i1', name: 'Dal', categoryId: 'c1', basePriceMinorUnits: 3200, isActive: true, imageUrl: '/media/b/x.webp', imageThumbUrl: '/media/b/x-480.webp', dietType: 'VEG' })).toEqual({
      id: 'i1',
      name: 'Dal',
      categoryId: 'c1',
      basePriceMinorUnits: 3200,
      isActive: true,
      imageUrl: '/media/b/x.webp',
      imageThumbUrl: '/media/b/x-480.webp',
    });
    expect(toPhotoCategory({ id: 'c1', name: 'Mains', imageUrl: null })).toEqual({ id: 'c1', name: 'Mains', imageUrl: null });
  });
  it('upload answers', () => {
    expect(toUploadedPicture({ itemId: 'i1', imageUrl: '/media/b/x.webp', imageThumbUrl: null, blurDataUri: 'data:image/png;base64,AA', color: '#112233' })).toEqual({ imageUrl: '/media/b/x.webp', imageThumbUrl: null });
    // logo / cover answer {kind, imageUrl, url}
    expect(toUploadedPicture({ kind: 'logo', imageUrl: '/media/b/l.webp', url: '/media/b/l.webp' }).imageUrl).toBe('/media/b/l.webp');
    expect(toUploadedPicture(null)).toEqual({ imageUrl: null, imageThumbUrl: null });
  });
  it('presentation: diet, tags and spice with unknown values ignored', () => {
    expect(toPresentation({ dietType: 'EGG', menuTags: ['Bestseller', 3, ''], spiceLevel: 2 })).toEqual({ dietType: 'EGG', menuTags: ['Bestseller'], spiceLevel: 2 });
    expect(toPresentation({ dietType: 'MEAT', spiceLevel: 9 })).toEqual({ dietType: null, menuTags: [], spiceLevel: null });
    expect(toPresentation({ spiceLevel: 0 }).spiceLevel).toBe(0);
  });
  it('lists are bare arrays', () => {
    expect(asArray([{ a: 1 }, 3, null])).toEqual([{ a: 1 }]);
    expect(asArray({ items: [{ a: 1 }] })).toEqual([]);
  });
});
