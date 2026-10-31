import { api, getAccessToken, tryRefresh, type ApiError } from '../auth/api';
import { menuApi } from '../setup/api';
import {
  asArray,
  toGuestOrder,
  toPhotoCategory,
  toPhotoItem,
  toQrSettings,
  toQrTable,
  toWaiterAlert,
} from './normalize';
import type {
  GuestOrder,
  GuestOrderEdit,
  PhotoCategory,
  PhotoItem,
  QrSettings,
  QrSettingsPatch,
  QrTable,
  WaiterAlert,
} from './types';

export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';

/**
 * DEV/TEST FLAG: VITE_QR_MOCK=1 serves every call below from in-memory fixtures
 * (./mock.ts, a separate lazy chunk) so the screens run before the API exists.
 * Never set it in a deployed build.
 */
export const QR_MOCK = (import.meta.env.VITE_QR_MOCK as string | undefined) === '1';
const mock = () => import('./mock');

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) });
const newKey = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** Absolute URL for an image the API returned (relative paths are served by the API origin). */
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
 * Multipart upload with progress (fetch cannot report upload progress). Uses the same
 * in-memory access token as api() and retries once after a silent refresh on 401.
 * ASSUMPTION: multipart field name `file`; reconcile with Q-API (see report).
 */
export function uploadImage(path: string, blob: Blob, filename: string, handle: UploadHandle = {}): Promise<unknown> {
  const send = (): Promise<{ status: number; body: unknown }> =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}${path}`);
      xhr.withCredentials = true;
      const token = getAccessToken();
      if (token) xhr.setRequestHeader('authorization', `Bearer ${token}`);
      xhr.setRequestHeader('Idempotency-Key', newKey());
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
      const err = new Error(
        ((res.body as { error?: { message?: string } } | null)?.error?.message) ?? `Request failed (${res.status})`,
      ) as ApiError;
      err.status = res.status;
      throw err;
    }
    handle.onProgress?.(1);
    return res.body;
  })();
}

export const qrApi = {
  // ── Table tokens (restaurant.qr.manage) ────────────────────────────────────
  async tables(): Promise<QrTable[]> {
    if (QR_MOCK) return (await mock()).mockApi.tables();
    return asArray(await api<unknown>('/admin/qr/tables')).map(toQrTable);
  },
  async rotate(tableId: string): Promise<QrTable> {
    if (QR_MOCK) return (await mock()).mockApi.rotate(tableId);
    return toQrTable((await api<Record<string, unknown>>(`/admin/qr/tables/${tableId}/rotate`, { method: 'POST', ...json({}) })) ?? {});
  },
  async setTableEnabled(tableId: string, enabled: boolean): Promise<QrTable> {
    if (QR_MOCK) return (await mock()).mockApi.setTableEnabled(tableId, enabled);
    return toQrTable((await api<Record<string, unknown>>(`/admin/qr/tables/${tableId}`, { method: 'PATCH', ...json({ enabled }) })) ?? {});
  },

  // ── Settings (restaurant.qr.manage) ────────────────────────────────────────
  async settings(): Promise<QrSettings> {
    if (QR_MOCK) return (await mock()).mockApi.settings();
    return toQrSettings(await api<unknown>('/admin/qr/settings'));
  },
  async saveSettings(patch: QrSettingsPatch): Promise<QrSettings> {
    if (QR_MOCK) return (await mock()).mockApi.saveSettings(patch);
    return toQrSettings(await api<unknown>('/admin/qr/settings', { method: 'PATCH', ...json(patch) }));
  },
  /** ASSUMPTION (not in the contract): POST /admin/qr/settings/:kind (multipart) returns the new url. */
  async uploadBrandImage(kind: 'logo' | 'cover', blob: Blob, handle?: UploadHandle): Promise<string | null> {
    if (QR_MOCK) return (await mock()).mockApi.uploadBrandImage(kind, blob);
    const body = (await uploadImage(`/admin/qr/settings/${kind}`, blob, `${kind}.webp`, handle)) as { url?: string; imageUrl?: string } | null;
    return body?.imageUrl ?? body?.url ?? null;
  },
  async removeBrandImage(kind: 'logo' | 'cover'): Promise<void> {
    if (QR_MOCK) return (await mock()).mockApi.removeBrandImage(kind);
    await api<void>(`/admin/qr/settings/${kind}`, { method: 'DELETE' });
  },

  // ── Menu photos (restaurant.qr.manage) ─────────────────────────────────────
  async photoCategories(): Promise<PhotoCategory[]> {
    if (QR_MOCK) return (await mock()).mockApi.photoCategories();
    return asArray(await menuApi.categories()).map(toPhotoCategory);
  },
  async photoItems(): Promise<PhotoItem[]> {
    if (QR_MOCK) return (await mock()).mockApi.photoItems();
    return asArray(await menuApi.items()).map(toPhotoItem);
  },
  async uploadItemImage(itemId: string, blob: Blob, handle?: UploadHandle): Promise<string | null> {
    if (QR_MOCK) return (await mock()).mockApi.uploadItemImage(itemId, blob, handle?.onProgress);
    const body = (await uploadImage(`/admin/menu/items/${itemId}/image`, blob, 'dish.webp', handle)) as { imageUrl?: string; url?: string } | null;
    return body?.imageUrl ?? body?.url ?? null;
  },
  async removeItemImage(itemId: string): Promise<void> {
    if (QR_MOCK) return (await mock()).mockApi.removeItemImage(itemId);
    await api<void>(`/admin/menu/items/${itemId}/image`, { method: 'DELETE' });
  },

  // ── Guest orders (restaurant.guestorder.manage) ────────────────────────────
  async pendingOrders(): Promise<GuestOrder[]> {
    if (QR_MOCK) return (await mock()).mockApi.pendingOrders();
    const rows = asArray(await api<unknown>('/admin/guest-orders?status=AWAITING_CONFIRMATION'));
    return rows.map(toGuestOrder).filter((o) => o.status === 'AWAITING_CONFIRMATION');
  },
  /** ASSUMPTION (not in the contract): open waiter calls / bill requests. A 403/404 means "none". */
  async alerts(): Promise<WaiterAlert[]> {
    if (QR_MOCK) return (await mock()).mockApi.alerts();
    try {
      return asArray(await api<unknown>('/admin/guest-orders/alerts')).map(toWaiterAlert);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 403 || status === 404) return [];
      throw err;
    }
  },
  /** ASSUMPTION: POST /admin/guest-orders/alerts/:tableId/ack. */
  async ackAlert(tableId: string): Promise<void> {
    if (QR_MOCK) return (await mock()).mockApi.ackAlert(tableId);
    await api<void>(`/admin/guest-orders/alerts/${tableId}/ack`, { method: 'POST', ...json({}) });
  },
  async confirm(orderId: string, idempotencyKey: string = newKey()): Promise<void> {
    if (QR_MOCK) return (await mock()).mockApi.confirm(orderId);
    await api<unknown>(`/admin/guest-orders/${orderId}/confirm`, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      ...json({}),
    });
  },
  async reject(orderId: string, reason: string, idempotencyKey: string = newKey()): Promise<void> {
    if (QR_MOCK) return (await mock()).mockApi.reject(orderId, reason);
    await api<unknown>(`/admin/guest-orders/${orderId}/reject`, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      ...json({ reason }),
    });
  },
  async edit(orderId: string, edit: GuestOrderEdit, idempotencyKey: string = newKey()): Promise<GuestOrder | null> {
    if (QR_MOCK) return (await mock()).mockApi.edit(orderId, edit);
    const out = await api<Record<string, unknown> | undefined>(`/admin/guest-orders/${orderId}/edit`, {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      ...json(edit),
    });
    return out && typeof out === 'object' && 'id' in out ? toGuestOrder(out) : null;
  },
};

export { newKey as newIdempotencyKey };
