import {
  deckLanguageLabel,
  formatNumber,
  isolate,
  resolveDirection,
  resolveUiLanguage,
  translate,
} from './localization';
import { en, fa } from './messages';

test('resolves explicit UI language and direction independently of deck content', () => {
  expect(resolveUiLanguage('en-US')).toBe('en');
  expect(resolveUiLanguage('fa-IR')).toBe('fa');
  expect(resolveUiLanguage('ar-EG')).toBe('ar');
  expect(resolveUiLanguage('es')).toBe('en');
  expect(resolveDirection('en')).toBe('ltr');
  expect(resolveDirection('fa')).toBe('rtl');
  expect(resolveDirection('ar')).toBe('rtl');
  expect(deckLanguageLabel('en-US', 'fa')).toBe('انگلیسی');
  expect(deckLanguageLabel('ar-SA', 'en')).toBe('Arabic');
  expect(deckLanguageLabel('fr-CA', 'ar')).toContain('fr-CA');
});

test('uses readable translated labels and falls back to English for missing keys', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  expect(translate('fa', 'nav.study')).toBe('مطالعه');
  expect(translate('ar', 'settings.appearance')).toBe('المظهر');
  expect(translate('fa', 'study.flashcard', { term: 'English port' })).toContain(
    isolate('English port', 'fa'),
  );
  const key = Object.keys(en).find((value) => !Object.hasOwn(fa, value)) as keyof typeof en;
  expect(key).toBeTruthy();
  expect(translate('fa', key)).toBe(en[key]);
  expect(translate('es', 'nav.study')).toBe('Study');
  warn.mockRestore();
});

test('numbers remain coherent inside an RTL sentence', () => {
  const digits = formatNumber(1234, 'fa');
  expect(digits).not.toBe('4321');
  expect(
    translate('fa', 'analytics.summary', { reviews: digits, days: formatNumber(7, 'fa') }),
  ).toContain(isolate(digits, 'fa'));
  expect(isolate('19:00', 'ar')).toBe('\u206819:00\u2069');
});
