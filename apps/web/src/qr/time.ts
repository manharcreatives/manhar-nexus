import type { TFunction } from 'i18next';

export function waitingMinutes(placedAt: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(placedAt).getTime()) / 60_000));
}

/** Waiting urgency: calm under 3 min, warn from 3, bad from 8. Always paired with the minutes as text. */
export type Urgency = 'ok' | 'warn' | 'bad';
export function urgency(mins: number): Urgency {
  return mins >= 8 ? 'bad' : mins >= 3 ? 'warn' : 'ok';
}

export function formatWaiting(mins: number, t: TFunction): string {
  if (mins < 1) return t('qr.orders.justNow');
  if (mins < 60) return t('qr.orders.minutes', { count: mins });
  return t('qr.orders.hoursMinutes', { h: Math.floor(mins / 60), m: mins % 60 });
}
