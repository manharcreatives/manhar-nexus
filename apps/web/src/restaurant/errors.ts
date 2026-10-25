import type { TFunction } from 'i18next';

/**
 * Stable prefix of the API's order-line configuration rejections (400
 * VALIDATION: wrong variant, option not offered for the item, unavailable or
 * duplicate option, group min/max). Kept in sync with LINE_CONFIG_ERROR_PREFIX
 * in apps/api/src/restaurant/order/order.service.ts.
 */
const LINE_CONFIG_ERROR_PREFIX = 'Invalid item configuration';

/** True when the server rejected an order line's variant/option choices. */
export function isLineConfigError(err: unknown): boolean {
  const e = err as { status?: number; message?: string } | null;
  return e?.status === 400 && (e.message ?? '').startsWith(LINE_CONFIG_ERROR_PREFIX);
}

/**
 * Maps any thrown value to a human sentence. `contextKey` is the i18n key used
 * when the failure carries no more specific meaning (e.g. a 500).
 */
export function describeError(err: unknown, t: TFunction, contextKey: string): string {
  const status = (err as { status?: number } | null)?.status;
  if (status === undefined) return t('restaurant.errors.network');
  if (status === 401 || status === 403) return t('restaurant.errors.noAccess');
  if (status === 404) return t('restaurant.errors.notFound');
  if (status === 409) return t('restaurant.errors.conflict');
  // The menu changed under the cart (e.g. an option was removed or sold out).
  if (isLineConfigError(err)) {
    return t('restaurant.errors.lineConfig', {
      defaultValue: "That option isn't available for this item. Refresh the menu and try again.",
    });
  }
  return t(contextKey);
}
