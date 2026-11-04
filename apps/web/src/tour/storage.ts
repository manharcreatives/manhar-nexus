import { TOUR_LANGS, type TourLang } from './content';

/**
 * Per-browser memory of the tour. Storage can throw or be empty (private windows, blocked site data),
 * so every access is guarded and the tour still works without it (it simply asks again next time).
 */
const key = (userId: string): string => `nexus.tour.v1:${userId}`;

export type TourOutcome = 'done' | 'skipped';

export function readOutcome(userId: string): TourOutcome | null {
  try {
    const v = window.localStorage.getItem(key(userId));
    return v === 'done' || v === 'skipped' ? v : null;
  } catch {
    return null;
  }
}

export function writeOutcome(userId: string, outcome: TourOutcome): void {
  try {
    window.localStorage.setItem(key(userId), outcome);
  } catch {
    /* storage unavailable: the tour will be offered again, which is acceptable */
  }
}

const LANG_KEY = 'nexus.tour.lang';

export function readLang(): TourLang | null {
  try {
    const v = window.localStorage.getItem(LANG_KEY);
    return (TOUR_LANGS as readonly string[]).includes(v ?? '') ? (v as TourLang) : null;
  } catch {
    return null;
  }
}

export function writeLang(lang: TourLang): void {
  try {
    window.localStorage.setItem(LANG_KEY, lang);
  } catch {
    /* ignore */
  }
}
