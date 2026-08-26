import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';

export const defaultLocale = 'en' as const;

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: defaultLocale,
  fallbackLng: defaultLocale,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export default i18n;
