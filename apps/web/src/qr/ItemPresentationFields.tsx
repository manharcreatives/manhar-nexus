import { useId, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import * as Icons from './icons';
import type { DietType, ItemPresentation, SpiceLevel } from './types';

export const MAX_TAGS = 6;
export const MAX_TAG_LENGTH = 24;
/** One-tap suggestions; the owner can type anything else. */
export const TAG_SUGGESTIONS = ['Chef special', 'Bestseller', 'New', 'Gluten free', 'Vegan', 'Jain'] as const;

export const EMPTY_PRESENTATION: ItemPresentation = { dietType: null, menuTags: [], spiceLevel: null };

/** Trimmed, single-spaced, capped at 24 characters; '' for nothing. */
export const cleanTag = (raw: string): string => raw.replace(/\s+/g, ' ').trim().slice(0, MAX_TAG_LENGTH).trim();

/** Adds a tag unless it is empty, a case-insensitive duplicate, or the list is full. */
export function addTag(tags: readonly string[], raw: string): string[] {
  const tag = cleanTag(raw);
  if (!tag || tags.length >= MAX_TAGS || tags.some((x) => x.toLowerCase() === tag.toLowerCase())) return [...tags];
  return [...tags, tag];
}

export function samePresentation(a: ItemPresentation, b: ItemPresentation): boolean {
  return a.dietType === b.dietType && a.spiceLevel === b.spiceLevel && a.menuTags.length === b.menuTags.length && a.menuTags.every((t, i) => t === b.menuTags[i]);
}

const DIETS: Array<DietType | null> = [null, 'VEG', 'NONVEG', 'EGG'];
const SPICES: Array<SpiceLevel | null> = [null, 0, 1, 2, 3];
const dietKey = (d: DietType | null) => (d === null ? 'none' : d.toLowerCase());
const spiceKey = (s: SpiceLevel | null) => (s === null ? 'none' : String(s));

/**
 * Dietary mark, tags and spice level of a dish as the guest menu shows them
 * (saved with PATCH /admin/menu/items/:id/presentation, permission restaurant.qr.manage).
 */
export function ItemPresentationFields({ value, onChange, disabled }: { value: ItemPresentation; onChange: (next: ItemPresentation) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  const id = useId();
  const [draft, setDraft] = useState('');
  const full = value.menuTags.length >= MAX_TAGS;

  const commit = (raw: string) => {
    const next = addTag(value.menuTags, raw);
    if (next.length !== value.menuTags.length) onChange({ ...value, menuTags: next });
    setDraft('');
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault(); // Enter must not submit the item form
      commit(draft);
    } else if (e.key === 'Backspace' && draft === '' && value.menuTags.length > 0) {
      onChange({ ...value, menuTags: value.menuTags.slice(0, -1) });
    }
  };

  return (
    <fieldset className="space-y-4 rounded-control border border-white/10 p-3" disabled={disabled}>
      <legend className="px-1 text-sm font-medium">{t('qr.item.title')}</legend>
      <p className="text-sm text-muted">{t('qr.item.hint')}</p>

      <div role="radiogroup" aria-label={t('qr.item.diet')} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {DIETS.map((d) => (
          <label
            key={dietKey(d)}
            className={cn(
              'flex min-h-11 cursor-pointer items-center gap-2 rounded-control border px-3 text-sm transition-colors',
              value.dietType === d ? 'border-accent/60 bg-accent/10' : 'border-white/10 hover:border-white/25',
            )}
          >
            <input type="radio" name={`${id}-diet`} checked={value.dietType === d} onChange={() => onChange({ ...value, dietType: d })} className="size-4 accent-(--color-accent)" />
            {d !== null && <Icons.Leaf className={cn('size-4', d === 'VEG' ? 'text-ok' : d === 'EGG' ? 'text-warn' : 'text-bad')} aria-hidden />}
            {t(`qr.item.dietOptions.${dietKey(d)}`)}
          </label>
        ))}
      </div>

      <div role="radiogroup" aria-label={t('qr.item.spice')} className="space-y-1.5">
        <p className="text-sm font-medium">{t('qr.item.spice')}</p>
        <div className="flex flex-wrap gap-2">
          {SPICES.map((s) => (
            <label
              key={spiceKey(s)}
              className={cn(
                'flex min-h-11 cursor-pointer items-center gap-1.5 rounded-control border px-3 text-sm transition-colors',
                value.spiceLevel === s ? 'border-accent/60 bg-accent/10' : 'border-white/10 hover:border-white/25',
              )}
            >
              <input type="radio" name={`${id}-spice`} checked={value.spiceLevel === s} onChange={() => onChange({ ...value, spiceLevel: s })} className="size-4 accent-(--color-accent)" />
              {s !== null && s > 0 && <span className="flex" aria-hidden>{Array.from({ length: s }, (_, i) => <Icons.Flame key={i} className="size-3.5 text-bad" />)}</span>}
              {t(`qr.item.spiceOptions.${spiceKey(s)}`)}
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor={`${id}-tags`} className="text-sm font-medium">{t('qr.item.tags')}</label>
        {value.menuTags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label={t('qr.item.tagsList')}>
            {value.menuTags.map((tag) => (
              <li key={tag} className="inline-flex items-center gap-1 rounded-full border border-white/12 bg-white/[0.04] py-0.5 pr-1 pl-2.5 text-sm">
                {tag}
                <button
                  type="button"
                  aria-label={t('qr.item.removeTag', { tag })}
                  onClick={() => onChange({ ...value, menuTags: value.menuTags.filter((x) => x !== tag) })}
                  className="grid size-7 place-items-center rounded-full text-muted hover:bg-white/[0.08] hover:text-ink"
                >
                  <Icons.X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          id={`${id}-tags`}
          type="text"
          value={draft}
          maxLength={MAX_TAG_LENGTH}
          disabled={full}
          placeholder={full ? t('qr.item.tagsFull', { max: MAX_TAGS }) : t('qr.item.tagsPlaceholder')}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={() => draft.trim() && commit(draft)}
          className="min-h-11 w-full rounded-control border border-white/12 bg-sunken px-3 text-sm placeholder:text-muted focus:border-accent/60 focus:outline-none disabled:opacity-60"
        />
        {!full && (
          <div className="flex flex-wrap gap-1.5" aria-label={t('qr.item.suggestions')}>
            {TAG_SUGGESTIONS.filter((s) => !value.menuTags.some((x) => x.toLowerCase() === s.toLowerCase())).map((s) => (
              <button key={s} type="button" onClick={() => commit(s)} className="min-h-9 rounded-full border border-dashed border-white/15 px-3 text-xs text-muted hover:border-accent/50 hover:text-ink">
                + {s}
              </button>
            ))}
          </div>
        )}
        <p className="text-xs text-muted">{t('qr.item.tagsCount', { count: value.menuTags.length, max: MAX_TAGS })}</p>
      </div>
    </fieldset>
  );
}
