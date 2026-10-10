import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { CreateCardInput } from '@/core/application/create-application';
import { makeCard, makeDeck } from '@/../test/fixtures';
import { vocabularyHelper } from '@/core/composition/vocabulary';
import { languageTag } from '@/core/domain/values';
import type { DictionaryLookupResult } from '@/features/vocabulary/domain/dictionary';
import { ThemeProvider } from '@/shared/theme/theme-provider';
import { setTestTheme } from '@/../test/set-test-theme';
import { CardForm } from './card-form';

jest.mock('@/core/composition/vocabulary', () => ({
  vocabularyHelper: {
    supports: jest.fn((language: string) => language.startsWith('en')),
    lookup: jest.fn(),
  },
}));

const found: DictionaryLookupResult = {
  status: 'found',
  suggestion: {
    word: 'hello',
    phonetic: '/hello/',
    meanings: [
      {
        definition: 'A greeting.',
        partOfSpeech: 'interjection',
        examples: ['Hello,  friend.', 'Hello there.'],
      },
      { definition: 'An utterance.', examples: [] },
    ],
  },
};

function showForm({
  existing,
  deck = makeDeck(),
  onSubmit,
}: {
  existing?: ReturnType<typeof makeCard>;
  deck?: ReturnType<typeof makeDeck>;
  onSubmit?: (content: Omit<CreateCardInput, 'deckId'>) => Promise<void>;
} = {}) {
  const submit = jest.fn(onSubmit ?? (async () => {}));
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 400, height: 850 },
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      }}
    >
      <ThemeProvider>
        <CardForm deck={deck} existing={existing} onSubmit={submit} />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  return submit;
}

beforeEach(() => {
  jest.mocked(vocabularyHelper.lookup).mockReset().mockResolvedValue(found);
});

test('create form hides vocabulary help and clears fields after successful manual saves', async () => {
  const submit = showForm();
  expect(vocabularyHelper.lookup).not.toHaveBeenCalled();
  expect(screen.queryByRole('header', { name: 'Vocabulary helper' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Find suggestions' })).toBeNull();
  fireEvent.changeText(screen.getByLabelText('Front text'), '  hello  ');
  expect(screen.queryByRole('button', { name: 'Find suggestions' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Create card' })).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Phonetic (optional)'), '/hello/');
  fireEvent.changeText(screen.getByLabelText('Meaning'), 'My revised meaning.');
  fireEvent.press(screen.getByRole('button', { name: 'Add example' }));
  fireEvent.changeText(screen.getByLabelText('Sentence 1'), 'I revised the sentence.');
  fireEvent.changeText(screen.getByLabelText('Category (optional)'), 'Greetings');
  fireEvent.changeText(screen.getByLabelText('Translation 1 (optional)'), 'Translated greeting');
  fireEvent.changeText(screen.getByLabelText('Notes 1 (optional)'), 'Usage note');
  fireEvent.press(screen.getByRole('button', { name: 'Add example' }));
  fireEvent.changeText(screen.getByLabelText('Sentence 2'), 'Hello there.');
  fireEvent.press(screen.getByRole('button', { name: 'Preview card' }));
  fireEvent.press(screen.getByRole('button', { name: 'Create card' }));
  await waitFor(() =>
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        frontText: 'hello',
        meaning: 'My revised meaning.',
        phonetic: '/hello/',
        category: 'Greetings',
        examples: [
          {
            sentence: 'I revised the sentence.',
            translation: 'Translated greeting',
            notes: 'Usage note',
          },
          { sentence: 'Hello there.' },
        ],
      }),
    ),
  );
  expect(
    await screen.findByText('Card added successfully. You can add another card.'),
  ).toBeTruthy();
  for (const label of ['Front text', 'Phonetic (optional)', 'Category (optional)', 'Meaning']) {
    expect(screen.getByLabelText(label).props.value).toBe('');
  }
  expect(screen.queryByLabelText('Sentence 1')).toBeNull();
  expect(screen.queryByLabelText('Translation 1 (optional)')).toBeNull();
  expect(screen.queryByLabelText('Notes 1 (optional)')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Hide preview' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Hide suggestions' })).toBeNull();
  expect(screen.queryByText('Suggestion added. Review and save when ready.')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Find suggestions' })).toBeNull();
  expect(vocabularyHelper.lookup).not.toHaveBeenCalled();

  fireEvent.changeText(screen.getByLabelText('Front text'), 'second term');
  fireEvent.changeText(screen.getByLabelText('Meaning'), 'Second meaning');
  fireEvent.press(screen.getByRole('button', { name: 'Create card' }));
  await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
  expect(submit).toHaveBeenLastCalledWith({
    frontText: 'second term',
    phonetic: null,
    category: null,
    meaning: 'Second meaning',
    examples: [],
  });
  await waitFor(() => expect(screen.getByLabelText('Front text').props.value).toBe(''));
});

test('editing offers explicit meaning and phonetic choices without overwriting existing examples', async () => {
  const submit = showForm({
    existing: makeCard({
      phonetic: '/old/',
      meaning: 'Handwritten.',
      examples: [{ sentence: 'Hello, friend.', notes: 'mine' }],
    }),
  });
  fireEvent.press(screen.getByRole('button', { name: 'Find suggestions' }));
  fireEvent.press(await screen.findByRole('button', { name: 'Use this definition 1' }));
  expect(screen.getByRole('button', { name: 'Apply suggestion', disabled: true })).toBeTruthy();
  expect(screen.getByLabelText('Meaning').props.value).toBe('Handwritten.');
  fireEvent.press(screen.getByRole('button', { name: 'Append meaning' }));
  fireEvent.press(screen.getByRole('button', { name: 'Keep phonetic' }));
  fireEvent.press(screen.getByRole('button', { name: 'Apply suggestion' }));
  expect(screen.getByLabelText('Meaning').props.value).toBe('Handwritten.\n\nA greeting.');
  expect(screen.getByLabelText('Phonetic (optional)').props.value).toBe('/old/');
  expect(screen.getByLabelText('Sentence 1').props.value).toBe('Hello, friend.');
  expect(screen.getByLabelText('Sentence 2').props.value).toBe('Hello there.');
  fireEvent.press(screen.getByRole('button', { name: 'Save card' }));
  await waitFor(() =>
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        examples: [{ sentence: 'Hello, friend.', notes: 'mine' }, { sentence: 'Hello there.' }],
      }),
    ),
  );
  expect(screen.getByLabelText('Front text').props.value).toBe('hello');
  expect(screen.getByLabelText('Meaning').props.value).toBe('Handwritten.\n\nA greeting.');
  expect(screen.queryByText('Card added successfully. You can add another card.')).toBeNull();
});

test('failed creation preserves all fields and preview for retry', async () => {
  const submit = showForm({
    onSubmit: async () => {
      throw new Error('Save failed');
    },
  });
  fireEvent.changeText(screen.getByLabelText('Front text'), 'unsaved term');
  fireEvent.changeText(screen.getByLabelText('Phonetic (optional)'), '/term/');
  fireEvent.changeText(screen.getByLabelText('Category (optional)'), 'Category');
  fireEvent.changeText(screen.getByLabelText('Meaning'), 'Unsaved meaning');
  fireEvent.press(screen.getByRole('button', { name: 'Add example' }));
  fireEvent.changeText(screen.getByLabelText('Sentence 1'), 'Example sentence');
  fireEvent.changeText(screen.getByLabelText('Translation 1 (optional)'), 'Translation');
  fireEvent.changeText(screen.getByLabelText('Notes 1 (optional)'), 'Notes');
  fireEvent.press(screen.getByRole('button', { name: 'Preview card' }));
  fireEvent.press(screen.getByRole('button', { name: 'Create card' }));
  expect(await screen.findByText('Unable to save this card. Try again.')).toBeTruthy();
  expect(submit).toHaveBeenCalledTimes(1);
  for (const [label, value] of [
    ['Front text', 'unsaved term'],
    ['Phonetic (optional)', '/term/'],
    ['Category (optional)', 'Category'],
    ['Meaning', 'Unsaved meaning'],
    ['Sentence 1', 'Example sentence'],
    ['Translation 1 (optional)', 'Translation'],
    ['Notes 1 (optional)', 'Notes'],
  ] as const) {
    expect(screen.getByLabelText(label).props.value).toBe(value);
  }
  expect(screen.getByRole('button', { name: 'Hide preview' })).toBeTruthy();
  expect(screen.queryByText('Card added successfully. You can add another card.')).toBeNull();
});

test('offline lookup allows retry once, hiding results, and manual card saving', async () => {
  jest.mocked(vocabularyHelper.lookup).mockResolvedValue({ status: 'offline' });
  const submit = showForm({ existing: makeCard() });
  fireEvent.changeText(screen.getByLabelText('Front text'), 'local term');
  fireEvent.press(screen.getByRole('button', { name: 'Find suggestions' }));
  expect(await screen.findByText(/You appear to be offline/)).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Retry suggestions' }));
  await waitFor(() => expect(vocabularyHelper.lookup).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole('button', { name: 'Retry suggestions' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Hide suggestions' }));
  fireEvent.changeText(screen.getByLabelText('Meaning'), 'My own meaning');
  fireEvent.press(screen.getByRole('button', { name: 'Save card' }));
  await waitFor(() =>
    expect(submit).toHaveBeenCalledWith(expect.objectContaining({ meaning: 'My own meaning' })),
  );
});

test('unsupported RTL decks never query an English provider; all themes keep manual entry available', async () => {
  for (const themePreference of ['light', 'dark', 'oled'] as const) {
    await act(async () => setTestTheme(themePreference));
    const { unmount } = render(
      <ThemeProvider>
        <CardForm
          deck={makeDeck({ language: languageTag('fa-IR'), textAlignment: 'rtl' })}
          onSubmit={jest.fn()}
        />
      </ThemeProvider>,
    );
    expect(screen.queryByText("Dictionary help isn't available for this language yet.")).toBeNull();
    expect(screen.queryByRole('header', { name: 'Vocabulary helper' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Create card' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Find suggestions' })).toBeNull();
    unmount();
  }
  await act(async () => setTestTheme('system'));
  expect(vocabularyHelper.lookup).not.toHaveBeenCalled();
});
