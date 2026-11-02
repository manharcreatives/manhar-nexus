import { api, getAccessToken, tryRefresh, type ApiError } from '../auth/api';
import { menuApi } from '../setup/api';
import {
  asArray,
  toGuestOrder,
  toPhotoCategory,
  toPhotoItem,
  toQrSettings,
  toQrTable,
  toUploadedPicture,
  toWaiterAlert,
} from './normalize';
import type {
  GuestOrder,
  GuestOrderEdit,
  ItemPresentation,
  PhotoCategory,
  PhotoItem,
  QrSettings,
  QrSettingsPatch,
  QrTable,
  UploadedPicture,
  WaiterAlert,
} from './types';

export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

/**
 * DEV/TEST FLAG: VITE_QR_MOCK=1 serves every call below from in-memory fixtures (./mock.ts, a separate lazy
 * chunk) so the screens can run without an API. It can NEVER be on in a production build: `import.meta.env.PROD`
 * is replaced by `true` at build time, so this folds to the constant `false` and `mock()` below is a rejected promise whose
 * `import('./mock')` branch is removed: the mock chunk is not emitted (mock.ts also throws if it is ever loaded in production).
 */
export const QR_MOCK: boolean = !import.meta.env.PROD && (import.meta.env.VITE_QR_MOCK as string | undefined) === '1';
// The ternary on the build-time constant is what drops the dynamic import (and with it the mock chunk) from production bundles.
const mock = (): Promise<typeof import('./mock')> =>
  import.meta.env.PROD ? Promise.reject(new Error('The QR mock backend is not available in production builds')) : import('./mock');

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });
const newKey = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Absolute URL for an image the API returned (`/media/<business>/<file>` is served by the API origin). */
export function assetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

export interface UploadHandle {
  /** 0..1 while the request body is being sent. */
  onProgress?: (fraction: number) => void;
}

/**
 * Multipart upload with progress (fetch cannot report upload progress). Field name `file` (the API reads
 * FileInterceptor('file')). Uses the same in-memory access token as api() and retries once after a silent refresh on 401.
 * Uploads are content-addressed on the server, so a retry of the same picture is harmless without an idempotency key.
 * Rejections carry the API's `status` and `code` (UNSUPPORTED_MEDIA 415, PAYLOAD_TOO_LARGE 413, MEDIA_NOT_CONFIGURED 503, ...).
 */
export function uploadImage(path: string, blob: Blob, filename: string, handle: UploadHandle = {}): Promise<unknown> {
  const send = (): Promise<{ status: number; body: unknown }> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}${path}`);
      xhr.withCredentials = true;
      const token = getAccessToken();
      if (token) xhr.setRequestHeader('authorization', `Bearer ${token}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && e.total > 0) handle.onProgress?.(Math.min(1, e.loaded / e.total));
      };
      xhr.onerror = () => reject(new Error('network'));
      xhr.onabort = () => reject(new Error('aborted'));
      xhr.onload = () => {
        let body: unknown = null;
        try {
          body = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        } catch {
          /* non-JSON body */
        }
        resolve({ status: xhr.status, body });
      };
      const form = new FormData();
      form.append('file', blob, filename);
      xhr.send(form);
    });

  return (async () => {
    let res = await send();
    if (res.status === 401 && (await tryRefresh())) res = await send();
    if (res.status < 200 || res.status >= 300) {
      const e = (res.body as { error?: { message?: string; code?: string } } | null)?.error;
      const err = new Error(e?.message ?? `Request failed (${res.status})`) as ApiError;
      err.status = res.status;
      err.code = e?.code;
      throw err;
    }
    handle.onProgress?.(1);
    return res.body;
  })();
}

const ext = (blob: Blob): string => (blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/png' ? 'png' : 'webp');

export const qrApi = {
  // ── Table tokens (restaurant.qr.manage) ────────────────────────────────────
  /** GET /admin/qr/tables (creates a token for any table that has none yet). */
  async tables(): Promise<QrTable[]> {
    if (QR_MOCK) return (await mock()).mockApi.tables();
    return asArray(await api<unknown>('/admin/qr/tables')).map(toQrTable);
  },
  /** POST /admin/qr/tables/:id/rotate. The old link dies at once; 409 VERSION_CONFLICT when the row changed. */
  async rotate(table: Pick<QrTable, 'tableId' | 'version'>): Promise<QrTable> {
    if (QR_MOCK) return (await mock()).mockApi.rotate(table.tableId);
    return toQrTable(
      (await api<Record<string, unknown>>(`/admin/qr/tables/${table.tableId}/rotate`, {
        method: 'POST',
        ...json({ expectedVersion: table.version }),
      })) ?? {},
    );
  },
  /** PATCH /admin/qr/tables/:id: guest menu on/off for the table. */
  async setTableEnabled(table: Pick<QrTable, 'tableId' | 'version'>, enabled: boolean): Promise<QrTable> {
    if (QR_MOCK) return (await mock()).mockApi.setTableEnabled(table.tableId, enabled);
    return toQrTable(
      (await api<Record<string, unknown>>(`/admin/qr/tables/${table.tableId}`, {
        method: 'PATCH',
        ...json({ enabled, expectedVersion: table.version }),
      })) ?? {},
    );
  },
  /** PATCH /admin/qr/tables/:id: guest ordering on/off for the table (the menu stays viewable). */
  async setTableOrdering(table: Pick<QrTable, 'tableId' | 'version'>, orderingEnabled: boolean): Promise<QrTable> {
    if (QR_MOCK) return (await mock()).mockApi.setTableOrdering(table.tableId, orderingEnabled);
    return toQrTable(
      (await api<Record<string, unknown>>(`/admin/qr/tables/${table.tableId}`, {
        method: 'PATCH',
        ...json({ orderingEnabled, expectedVersion: table.version }),
      })) ?? {},
    );
  },

  // ── Settings (restaurant.qr.manage) ────────────────────────────────────────
  async settings(): Promise<QrSettings> {
    if (QR_MOCK) return (await mock()).mockApi.settings();
    return toQrSettings(await api<unknown>('/admin/qr/settings'));
  },
  /** PATCH /admin/qr/settings; `expectedVersion` makes a stale save a 409 VERSION_CONFLICT instead of a silent overwrite. */
  async saveSettings(patch: QrSettingsPatch, expectedVersion?: number): Promise<QrSettings> {
    if (QR_MOCK) return (await mock()).mockApi.saveSettings(patch);
    return toQrSettings(
      await api<unknown>('/admin/qr/settings', {
        method: 'PATCH',
        ...json(expectedVersion === undefined ? patch : { ...patch, expectedVersion }),
      }),
    );
  },
  /** POST /admin/qr/settings/logo|cover (multipart `file`). Bumps the settings version: reload settings afterwards. */
  async uploadBrandImage(kind: 'logo' | 'cover', blob: Blob, handle?: UploadHandle): Promise<string | null> {
    if (QR_MOCK) return (await mock()).mockApi.uploadBrandImage(kind, blob);
    return toUploadedPicture(await uploadImage(`/admin/qr/settings/${kind}`, blob, `${kind}.${ext(blob)}`, handle)).imageUrl;
  },
  async removeBrandImage(kind: 'logo' | 'cover'): Promise<void> {
    if (QR_MOCK) return (await mock()).mockApi.removeBrandImage(kind);
    await api<void>(`/admin/qr/settings/${kind}`, { method: 'DELETE' });
  },

  // ── Menu photos + presentation (restaurant.qr.manage) ──────────────────────
  async photoCategories(): Promise<PhotoCategory[]> {
    if (QR_MOCK) return (await mock()).mockApi.photoCategories();
    return asArray(await menuApi.categories()).map(toPhotoCategory);
  },
  async photoItems(): Promise<PhotoItem[]> {
    if (QR_MOCK) return (await mock()).mockApi.photoItems();
    return asArray(await menuApi.items()).map(toPhotoItem);
  },
  /** POST /admin/menu/items/:id/image (png / jpeg / webp, 64..6000 px, 6 MiB). */
  async uploadItemImage(itemId: string, blob: Blob, handle?: UploadHandle): Promise<UploadedPicture> {
    if (QR_MOCK) return (await mock()).mockApi.uploadItemImage(itemId, blob, handle?.onProgress);
    return toUploadedPicture(await uploadImage(`/admin/menu/items/${itemId}/image`, blob, `dish.${ext(blob)}`, handle));
  },
  /** DELETE /admin/menu/items/:id/image (204, idempotent). */
  async removeItemImage(itemId: string): Promise<void> {
    if (QR_MOCK) return (await mock()).mockApi.removeItemImage(itemId);
    await api<void>(`/admin/menu/items/${itemId}/image`, { method: 'DELETE' });
  },
  /** POST /admin/menu/categories/:id/image. */
  async uploadCategoryImage(categoryId: string, blob: Blob, handle?: UploadHandle): Promise<UploadedPicture> {
    if (QR_MOCK) return (await mock()).mockApi.uploadCategoryImage(categoryId, blob, handle?.onProgress);
    return toUploadedPicture(await uploadImage(`/admin/menu/categories/${categoryId}/image`, blob, `category.${ext(blob)}`, handle));
  },
  async removeCategoryImage(categoryId: string): Promise<void> {
    if (QR_MOCK) return (await mock()).mockApi.removeCategoryImage(categoryId);
    await api<void>(`/admin/menu/categories/${categoryId}/image`, { method: 'DELETE' });
  },
  /** PATCH /admin/menu/items/:id/presentation: dietary mark, tags (<= 6) and spice level (0-3) shown on the guest menu. */
  async setItemPresentation(itemId: string, presentation: ItemPresentation): Promise<void> {
    if (QR_MOCK) return (await mock()).mockApi.setItemPresentation(itemId, presentation);
    await api<unknown>(`/admin/menu/items/${itemId}/presentation`, { method: 'PATCH', ...json(presentation) });
  },

  // ── Guest orders (restaurant.guestorder.manage) ────────────────────────────
  /** GET /admin/guest-orders?status=AWAITING_CONFIRMATION (oldest first, up to 100). */
  async pendingOrders(): Promise<GuestOrder[]> {
    if (QR_MOCK) return (await mock()).mockApi.pendingOrders();
    const rows = asArray(await api<unknown>('/admin/guest-orders?status=AWAITING_CONFIRMATION'));
    return rows.map(toGuestOrder).filter((o) => o.status === 'AWAITING_CONFIRMATION');
  },
  /** GET /admin/guest-orders/alerts: open waiter calls / bill requests. */
  async alerts(): Promise<WaiterAlert[]> {
    if (QR_MOCK) return (await mock()).mockApi.alerts();
    return asArray(await api<unknown>('/admin/guest-orders/alerts')).map(toWaiterAlert);
  },
  /** POST /admin/guest-orders/alerts/:tableId/ack (204, idempotent): marks every open call of the table handled. */
  async ackAlert(tableId: string): Promise<void> {
    if (QR_MOCK) return (await mock()).mockApi.ackAlert(tableId);
    await api<void>(`/admin/guest-orders/alerts/${tableId}/ack`, { method: 'POST', ...json({}) });
  },
  /** POST .../confirm: naturally idempotent (a replay answers the confirmed row). 409 ORDERING_LOCKED once a bill exists. */
  async confirm(orderId: string): Promise<GuestOrder> {
    if (QR_MOCK) return (await mock()).mockApi.confirm(orderId);
    return toGuestOrder((await api<Record<string, unknown>>(`/admin/guest-orders/${orderId}/confirm`, { method: 'POST', ...json({}) })) ?? {});
  },
  /** POST .../reject {reason}: naturally idempotent. */
  async reject(orderId: string, reason: string): Promise<GuestOrder> {
    if (QR_MOCK) return (await mock()).mockApi.reject(orderId, reason);
    return toGuestOrder((await api<Record<string, unknown>>(`/admin/guest-orders/${orderId}/reject`, { method: 'POST', ...json({ reason }) })) ?? {});
  },
  /** POST .../edit {lines:[{id,qty}],note?}: only while awaiting confirmation (409 otherwise); honours Idempotency-Key. */
  async edit(orderId: string, edit: GuestOrderEdit, idempotencyKey: string = newKey()): Promise<GuestOrder> {
    if (QR_MOCK) return (await mock()).mockApi.edit(orderId, edit);
    return toGuestOrder(
      (await api<Record<string, unknown>>(`/admin/guest-orders/${orderId}/edit`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        ...json(edit),
      })) ?? {},
    );
  },
};

export { newKey as newIdempotencyKey };
