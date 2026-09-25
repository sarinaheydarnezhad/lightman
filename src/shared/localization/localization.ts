import { ar, en, fa, type Dictionary, type MessageKey } from './messages';

export type UiLanguage = 'en' | 'fa' | 'ar';
export type UiDirection = 'ltr' | 'rtl';
const translations: Record<UiLanguage, Dictionary> = { en, fa, ar };
const missing = new Set<string>();

/** Unknown UI languages retain a safe English UI until a translation is provided. */
export function resolveUiLanguage(tag: string | null | undefined): UiLanguage {
  const base = tag?.toLowerCase().replaceAll('_', '-').split('-')[0];
  return base === 'fa' || base === 'ar' ? base : 'en';
}

export function resolveDirection(tag: string | null | undefined): UiDirection {
  return resolveUiLanguage(tag) === 'en' ? 'ltr' : 'rtl';
}

export function deckLanguageLabel(tag: string, uiLanguage: UiLanguage): string {
  const base = tag.toLowerCase().replaceAll('_', '-').split('-')[0];
  return base === 'en' || base === 'fa' || base === 'ar'
    ? translate(uiLanguage, `language.${base}`)
    : translate(uiLanguage, 'language.other', { tag });
}

export function formatNumber(value: number, language: UiLanguage): string {
  return new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : language === 'ar' ? 'ar' : 'en-US', {
    maximumFractionDigits: 1,
  }).format(value);
}

/** Isolate inserted card titles, numbers and time values from adjacent RTL punctuation. */
export function isolate(value: string, language: UiLanguage): string {
  return language === 'en' ? value : `\u2068${value}\u2069`;
}

export function translate(
  tag: string | null | undefined,
  key: MessageKey,
  values: Record<string, string | number> = {},
): string {
  const language = resolveUiLanguage(tag);
  const template = translations[language][key] ?? en[key] ?? 'Translation unavailable';
  if (
    __DEV__ &&
    language !== 'en' &&
    !translations[language][key] &&
    !missing.has(`${language}:${key}`)
  ) {
    missing.add(`${language}:${key}`);
    console.warn(`Missing ${language} translation: ${key}`);
  }
  return template.replace(/\{([a-zA-Z]+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(values, name) ? isolate(String(values[name]), language) : placeholder,
  );
}
