import { makeCard } from '@/../test/fixtures';
import { mergeSuggestion } from './merge-suggestion';

const selection = {
  definition: 'A greeting.',
  phonetic: '/həˈloʊ/',
  examples: ['Hello,  friend.', 'NEW sentence.'],
};

test('empty draft imports fields and examples as editable card content', () => {
  const result = mergeSuggestion({ meaning: '', phonetic: '', examples: [] }, selection, {
    meaning: 'keep',
    phonetic: 'keep',
  });
  expect(result.fields).toEqual({
    meaning: 'A greeting.',
    phonetic: '/həˈloʊ/',
    examples: [{ sentence: 'Hello,  friend.' }, { sentence: 'NEW sentence.' }],
  });
});

test('existing meaning requires deliberate replace or append and examples preserve notes/translation', () => {
  const example = { sentence: 'Hello, friend.', notes: 'mine', translation: 'manual' };
  const draft = { meaning: 'Existing.', phonetic: '/old/', examples: [example] };
  const keep = mergeSuggestion(draft, selection, { meaning: 'keep', phonetic: 'keep' });
  expect(keep.fields).toEqual({ ...draft, examples: [example, { sentence: 'NEW sentence.' }] });
  const append = mergeSuggestion(draft, selection, { meaning: 'append', phonetic: 'replace' });
  expect(append.fields.meaning).toBe('Existing.\n\nA greeting.');
  expect(append.fields.phonetic).toBe('/həˈloʊ/');
  expect(
    mergeSuggestion(draft, selection, { meaning: 'replace', phonetic: 'keep' }).fields.meaning,
  ).toBe('A greeting.');
  expect(makeCard({ meaning: append.fields.meaning }).meaning).toContain('Existing.');
});

test('full example list stays intact and reports skipped new sentences', () => {
  const draft = {
    meaning: '',
    phonetic: 'manual',
    examples: Array.from({ length: 20 }, (_, i) => ({ sentence: `Item ${i}` })),
  };
  const result = mergeSuggestion(draft, selection, { meaning: 'keep', phonetic: 'keep' });
  expect(result.fields.examples).toEqual(draft.examples);
  expect(result.limitedExamples).toBe(2);
});
