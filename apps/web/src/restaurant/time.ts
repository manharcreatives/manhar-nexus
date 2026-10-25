import type { TFunction } from 'i18next';

export function minutesSince(iso: string | null, now: number): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000));
}

export function formatElapsed(mins: number, t: TFunction): string {
  if (mins < 1) return t('restaurant.kitchen.justNow');
  if (mins < 60) return t('restaurant.kitchen.minutes', { count: mins });
  return t('restaurant.kitchen.hoursMinutes', { h: Math.floor(mins / 60), m: mins % 60 });
}
