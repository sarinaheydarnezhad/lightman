import { AppError } from '@/core/errors/app-error';
import { makeCard } from '@/../test/fixtures';
import { validateCard } from './card';

test('card validation trims content and preserves multiple structured examples', () => {
  const card = validateCard(
    makeCard({
      frontText: ' hello ',
      examples: [{ sentence: ' One ', translation: ' Uno ' }, { sentence: ' Two ' }],
    }),
  );
  expect(card.frontText).toBe('hello');
  expect(card.examples).toEqual([{ sentence: 'One', translation: 'Uno' }, { sentence: 'Two' }]);
});

test.each([
  makeCard({ frontText: ' ' }),
  makeCard({ meaning: ' ' }),
  makeCard({ deckId: '' }),
  makeCard({ examples: [{ sentence: '' }] }),
  makeCard({ createdAt: 'invalid' as never }),
])('rejects invalid card data', (card) => {
  expect(() => validateCard(card)).toThrow(AppError);
});
