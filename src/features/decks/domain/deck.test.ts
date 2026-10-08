import { AppError } from '@/core/errors/app-error';
import { makeDeck } from '@/../test/fixtures';
import { validateDeck, validateDeckTitle } from './deck';

test('trims a valid title and rejects blank titles', () => {
  expect(validateDeckTitle('  Languages  ')).toBe('Languages');
  expect(() => validateDeckTitle('  ')).toThrow(AppError);
});

test('deck validates language, alignment, typography and instants', () => {
  expect(validateDeck(makeDeck({ name: '  Languages  ', textAlignment: 'rtl' })).name).toBe(
    'Languages',
  );
  expect(() => validateDeck(makeDeck({ language: '!!' as never }))).toThrow(AppError);
  expect(() => validateDeck(makeDeck({ textAlignment: 'justify' as never }))).toThrow(AppError);
  expect(() => validateDeck(makeDeck({ typographySize: 'huge' as never }))).toThrow(AppError);
  expect(() => validateDeck(makeDeck({ updatedAt: 'not-a-date' as never }))).toThrow(AppError);
});

test('unsupported languages are rejected for new decks but remain readable as legacy data', () => {
  const legacy = makeDeck({ language: 'ar' as never });
  expect(() => validateDeck(legacy)).toThrow(AppError);
  expect(validateDeck(legacy, true).language).toBe('ar');
  expect(() => validateDeck(makeDeck({ language: 'es' as never }))).toThrow(AppError);
});
