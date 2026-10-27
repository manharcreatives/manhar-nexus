import type { TFunction } from 'i18next';
import { labelForKey, stripAsides, titleCaseKey } from '../lib/humanize';

/** Owner-facing title and one-line help for a setting; unknown settings get a safe title-cased fallback. */
export function settingText(t: TFunction, namespace: string, key: string, description: string): { title: string; hint: string | null } {
  const id = `${namespace}_${key}`;
  const title = t(`config.settings.${id}.title`, { defaultValue: '' });
  const hint = t(`config.settings.${id}.hint`, { defaultValue: '' });
  if (title) return { title, hint: hint || null };
  const cleaned = stripAsides(description);
  return { title: titleCaseKey(key), hint: cleaned || null };
}

export function groupLabel(t: TFunction, namespace: string): string {
  return labelForKey(t, 'config.groups', namespace);
}

/** Render format-string settings as a worked example so nobody has to read "dd/MM/yyyy". */
export function exampleDate(format: string, d: Date): string {
  const two = (n: number) => String(n).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return format
    .replace(/yyyy/g, String(d.getFullYear()))
    .replace(/MMM/g, months[d.getMonth()])
    .replace(/MM/g, two(d.getMonth() + 1))
    .replace(/dd/g, two(d.getDate()));
}

export function exampleTime(format: string, d: Date): string {
  const two = (n: number) => String(n).padStart(2, '0');
  if (format === '12h') {
    const h = d.getHours() % 12 || 12;
    return `${h}:${two(d.getMinutes())} ${d.getHours() < 12 ? 'am' : 'pm'}`;
  }
  return `${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** Friendly text for a known setting's value; null when the generic rendering should be used. */
export function friendlyValue(t: TFunction, namespace: string, key: string, value: unknown, now = new Date()): string | null {
  if (namespace !== 'core' || typeof value !== 'string') return null;
  switch (key) {
    case 'date_format':
      return t('config.values.example', { example: exampleDate(value, now) });
    case 'time_format':
      return t('config.values.example', { example: exampleTime(value, now) });
    case 'locale': {
      try {
        const name = new Intl.DisplayNames(['en'], { type: 'language' }).of(value);
        return name && name !== value ? name : null;
      } catch {
        return null;
      }
    }
    case 'rounding_mode': {
      const label = t(`config.values.rounding_${value}`, { defaultValue: '' });
      return label || null;
    }
    default:
      return null;
  }
}
