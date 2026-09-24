import { AppError } from '@/core/errors/app-error';
import { makeCard } from '@/../test/fixtures';
import { validateCard, validateCardContent } from './card';

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

test('optional content normalizes at boundaries while preserving sentence spacing and long text', () => {
  const sentence = 'A  sentence with   deliberate spacing.';
  const longMeaning = 'An extended explanation. '.repeat(100);
  const content = validateCardContent({
    frontText: '  term  ',
    meaning: `  ${longMeaning}  `,
    phonetic: '  /term/  ',
    category: '  Nouns  ',
    examples: [{ sentence: `  ${sentence}  `, translation: '  uno  ', notes: '  usage  ' }],
  });
  expect(content.frontText).toBe('term');
  expect(content.meaning).toBe(longMeaning.trim());
  expect(content.phonetic).toBe('/term/');
  expect(content.category).toBe('Nouns');
  expect(content.examples).toEqual([{ sentence, translation: 'uno', notes: 'usage' }]);
  expect(validateCard(makeCard({ phonetic: null, category: null, examples: [] }))).toMatchObject({
    phonetic: null,
    category: null,
    examples: [],
  });
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
