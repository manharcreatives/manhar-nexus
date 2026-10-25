import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';

export const defaultLocale = 'en' as const;

type Tree = { [key: string]: string | Tree };

function merge(base: Tree, extra: Tree): Tree {
  const out: Tree = { ...base };
  for (const [k, v] of Object.entries(extra)) {
    const cur = out[k];
    out[k] = typeof v === 'object' && typeof cur === 'object' ? merge(cur, v) : v;
  }
  return out;
}

// Per-area overlays (en.<area>.json) are deep-merged over en.json, so areas
// can evolve their copy independently.
const overlays = import.meta.glob<Tree>('./en.*.json', { eager: true, import: 'default' });
const translation = Object.values(overlays).reduce<Tree>((acc, o) => merge(acc, o), en as Tree);

void i18n.use(initReactI18next).init({
  resources: { en: { translation } },
  lng: defaultLocale,
  fallbackLng: defaultLocale,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18n;
