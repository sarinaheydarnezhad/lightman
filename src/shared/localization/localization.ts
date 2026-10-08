import { en, fa, type Dictionary, type MessageKey } from './messages';

export type UiLanguage = 'en' | 'fa';
export type UiDirection = 'ltr' | 'rtl';
const translations: Record<UiLanguage, Dictionary> = { en, fa };
const missing = new Set<string>();

/** Unsupported UI language tags safely fall back to English without rewriting stored data. */
export function resolveUiLanguage(tag: string | null | undefined): UiLanguage {
  const base = tag?.toLowerCase().replaceAll('_', '-').split('-')[0];
  return base === 'fa' ? 'fa' : 'en';
}

export function resolveDirection(tag: string | null | undefined): UiDirection {
  return resolveUiLanguage(tag) === 'fa' ? 'rtl' : 'ltr';
}

/** Resolve a direction from a supported language tag or the first strong character in text. */
export function getTextDirection(langOrText: string | null | undefined): UiDirection {
  const value = langOrText?.trim() ?? '';
  const tag = /^(fa|en)(?:[-_][a-z0-9]{2,8})*$/i.exec(value);
  if (tag) return tag[1]!.toLowerCase() === 'fa' ? 'rtl' : 'ltr';
  for (const character of value) {
    if (character === '\u200f') return 'rtl';
    if (character === '\u200e') return 'ltr';
    if (!/\p{Letter}/u.test(character)) continue;
    if (/[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefc]/u.test(character)) return 'rtl';
    return 'ltr';
  }
  return 'ltr';
}

export function deckLanguageLabel(tag: string, uiLanguage: string): string {
  const base = tag.toLowerCase().replaceAll('_', '-').split('-')[0];
  return base === 'en' || base === 'fa'
    ? translate(uiLanguage, `language.${base}`)
    : translate(uiLanguage, 'language.other', { tag });
}

export function formatNumber(value: number, language: UiLanguage): string {
  return new Intl.NumberFormat(language === 'fa' ? 'fa-IR' : 'en-US', {
    maximumFractionDigits: 1,
  }).format(value);
}

/** Isolate inserted card titles, numbers and time values from adjacent RTL punctuation. */
export function isolate(value: string, language: string): string {
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
