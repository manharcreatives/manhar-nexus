import type { TFunction } from 'i18next';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a bare UUID, which an owner should never have to read. */
export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/** "service_request.preparation_started" -> "Service request preparation started". Safe fallback for unknown keys. */
export function titleCaseKey(key: string): string {
  const words = key
    .replace(/[._\-:/]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : key;
}

/**
 * Plain label for a machine key from the i18n tree: `prefix.<key with dots as underscores>`
 * (dots would otherwise be read as nesting). Unknown keys fall back to a title-cased version.
 */
export function labelForKey(t: TFunction, prefix: string, key: string): string {
  const found = t(`${prefix}.${key.replace(/\./g, '_')}`, { defaultValue: '' });
  return typeof found === 'string' && found ? found : titleCaseKey(key);
}

/** Drops engineering asides such as "(BCP-47 language tag)" or "(ADR-015)" from a server description. */
export function stripAsides(text: string): string {
  return text
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .replace(/\.$/, '')
    .trim();
}
