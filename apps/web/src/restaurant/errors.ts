import type { TFunction } from 'i18next';

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
  return t(contextKey);
}
