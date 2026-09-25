import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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
}: {
  existing?: ReturnType<typeof makeCard>;
  deck?: ReturnType<typeof makeDeck>;
} = {}) {
  const onSubmit = jest.fn(async () => {});
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 400, height: 850 },
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      }}
    >
      <ThemeProvider>
        <CardForm deck={deck} existing={existing} onSubmit={onSubmit} />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  return onSubmit;
}

beforeEach(() => {
  jest.mocked(vocabularyHelper.lookup).mockReset().mockResolvedValue(found);
});

test('create form imports only the chosen definition; imported fields remain editable until Save', async () => {
  const submit = showForm();
  expect(vocabularyHelper.lookup).not.toHaveBeenCalled();
  fireEvent.changeText(screen.getByLabelText('Front text'), '  hello  ');
  fireEvent.press(screen.getByRole('button', { name: 'Find suggestions' }));
  expect(screen.getByRole('button', { name: 'Create card' })).toBeTruthy();
  expect(await screen.findByRole('button', { name: 'Use this definition 1' })).toBeTruthy();
  expect(screen.getByText('interjection')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Use this definition 1' }));
  expect(screen.getByLabelText('Meaning').props.value).toBe('');
  fireEvent.press(screen.getByRole('button', { name: 'Apply suggestion' }));
  expect(screen.getByLabelText('Phonetic (optional)').props.value).toBe('/hello/');
  expect(screen.getByLabelText('Meaning').props.value).toBe('A greeting.');
  expect(screen.getByLabelText('Sentence 1').props.value).toBe('Hello,  friend.');
  fireEvent.changeText(screen.getByLabelText('Meaning'), 'My revised meaning.');
  fireEvent.changeText(screen.getByLabelText('Sentence 1'), 'I revised the sentence.');
  fireEvent.press(screen.getByRole('button', { name: 'Create card' }));
  await waitFor(() =>
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        frontText: 'hello',
        meaning: 'My revised meaning.',
        phonetic: '/hello/',
        examples: [{ sentence: 'I revised the sentence.' }, { sentence: 'Hello there.' }],
      }),
    ),
  );
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
});

test('offline lookup allows retry once, hiding results, and manual card saving', async () => {
  jest.mocked(vocabularyHelper.lookup).mockResolvedValue({ status: 'offline' });
  const submit = showForm();
  fireEvent.changeText(screen.getByLabelText('Front text'), 'local term');
  fireEvent.press(screen.getByRole('button', { name: 'Find suggestions' }));
  expect(await screen.findByText(/You appear to be offline/)).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Retry suggestions' }));
  await waitFor(() => expect(vocabularyHelper.lookup).toHaveBeenCalledTimes(2));
  expect(screen.queryByRole('button', { name: 'Retry suggestions' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Hide suggestions' }));
  fireEvent.changeText(screen.getByLabelText('Meaning'), 'My own meaning');
  fireEvent.press(screen.getByRole('button', { name: 'Create card' }));
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
    expect(screen.getByText("Dictionary help isn't available for this language yet.")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create card' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Find suggestions' })).toBeNull();
    unmount();
  }
  await act(async () => setTestTheme('system'));
  expect(vocabularyHelper.lookup).not.toHaveBeenCalled();
});
