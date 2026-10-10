import {
  deckLanguageLabel,
  formatNumber,
  isolate,
  resolveDirection,
  resolveUiLanguage,
  translate,
} from './localization';
import { en, fa } from './messages';

test('card creation confirmation is localized in English and Persian', () => {
  expect(translate('en', 'form.cardCreated')).toBe(
    'Card added successfully. You can add another card.',
  );
  expect(translate('fa', 'form.cardCreated')).toBe(
    'کارت با موفقیت اضافه شد. می‌توانید کارت دیگری اضافه کنید.',
  );
});

test('resolves explicit UI language and direction independently of deck content', () => {
  expect(resolveUiLanguage('en-US')).toBe('en');
  expect(resolveUiLanguage('fa-IR')).toBe('fa');
  expect(resolveUiLanguage('ar-EG')).toBe('en');
  expect(resolveUiLanguage('es')).toBe('en');
  expect(resolveDirection('en')).toBe('ltr');
  expect(resolveDirection('fa')).toBe('rtl');
  expect(resolveDirection('ar')).toBe('ltr');
  expect(deckLanguageLabel('en-US', 'fa')).toBe('انگلیسی');
  expect(deckLanguageLabel('ar-SA', 'en')).toContain('ar-SA');
  expect(deckLanguageLabel('fr-CA', 'en')).toContain('fr-CA');
});

test('uses readable translated labels and falls back to English for missing keys', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  expect(translate('fa', 'nav.study')).toBe('مطالعه');
  expect(translate('ar', 'settings.appearance')).toBe('Appearance');
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
  expect(isolate('19:00', 'fa')).toBe('\u206819:00\u2069');
});
