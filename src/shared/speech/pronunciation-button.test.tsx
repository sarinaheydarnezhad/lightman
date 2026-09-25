import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { makeCard, makeDeck } from '@/../test/fixtures';
import { speech } from '@/core/composition/speech';
import { languageTag } from '@/core/domain/values';
import { StudyCard } from '@/features/study/presentation/study-card';
import { ThemeProvider } from '@/shared/theme/theme-provider';
import { useUiStore } from '@/store/ui-store';

jest.mock('@/core/composition/speech', () => ({
  speech: jest
    .requireActual<typeof import('@/../test/fake-speech')>('@/../test/fake-speech')
    .createFakeSpeechService(),
}));

beforeEach(() => {
  act(() => {
    void speech.stop();
  });
  jest.mocked(speech.speak).mockClear();
  jest.mocked(speech.stop).mockClear();
  jest.mocked(speech.getAvailableVoices).mockClear();
});

test('StudyCard has a labelled audio action for only the front term in RTL', async () => {
  const card = makeCard({ frontText: 'کتاب', meaning: 'book', phonetic: '/ketab/' });
  render(
    <ThemeProvider>
      <StudyCard
        card={card}
        deck={makeDeck({ language: languageTag('fa-IR'), textAlignment: 'rtl' })}
        revealed={false}
        backTab="meaning"
        onSelectBackTab={jest.fn()}
      />
    </ThemeProvider>,
  );
  const button = screen.getByRole('button', { name: 'Pronounce کتاب' });
  fireEvent.press(button);
  await waitFor(() =>
    expect(speech.speak).toHaveBeenCalledWith(
      'کتاب',
      expect.objectContaining({ language: 'fa-IR' }),
    ),
  );
  expect(screen.getByRole('button', { name: 'Stop pronunciation of کتاب' })).toBeTruthy();
  expect(speech.speak).toHaveBeenCalledTimes(1);
});

test('pressing while speaking stops; next press starts again without stacking requests', async () => {
  render(
    <ThemeProvider>
      <StudyCard
        card={makeCard()}
        deck={makeDeck()}
        revealed={false}
        backTab="meaning"
        onSelectBackTab={jest.fn()}
      />
    </ThemeProvider>,
  );
  fireEvent.press(screen.getByRole('button', { name: 'Pronounce hello' }));
  await screen.findByRole('button', { name: 'Stop pronunciation of hello' });
  fireEvent.press(screen.getByRole('button', { name: 'Stop pronunciation of hello' }));
  await waitFor(() => expect(speech.stop).toHaveBeenCalledTimes(1));
  expect(speech.speak).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole('button', { name: 'Pronounce hello' }));
  await waitFor(() => expect(speech.speak).toHaveBeenCalledTimes(2));
});

test('unavailable voice reports an accessible message and card change stops speech', async () => {
  jest.mocked(speech.speak).mockResolvedValueOnce(false);
  const props = {
    deck: makeDeck(),
    revealed: false,
    backTab: 'meaning' as const,
    onSelectBackTab: jest.fn(),
  };
  const { rerender } = render(
    <ThemeProvider>
      <StudyCard card={makeCard()} {...props} />
    </ThemeProvider>,
  );
  fireEvent.press(screen.getByRole('button', { name: 'Pronounce hello' }));
  expect(await screen.findByText('Pronunciation is unavailable on this device.')).toBeTruthy();
  rerender(
    <ThemeProvider>
      <StudyCard card={makeCard({ id: 'new', frontText: 'next' })} {...props} />
    </ThemeProvider>,
  );
  await waitFor(() => expect(speech.stop).toHaveBeenCalledTimes(1));
  expect(screen.getByRole('button', { name: 'Pronounce next' })).toBeTruthy();
});

test.each(['light', 'dark', 'oled'] as const)(
  '%s theme keeps the audio button accessible without loading voices',
  (mode) => {
    useUiStore.setState({ themePreference: mode });
    try {
      render(
        <ThemeProvider>
          <StudyCard
            card={makeCard()}
            deck={makeDeck()}
            revealed={false}
            backTab="meaning"
            onSelectBackTab={jest.fn()}
          />
        </ThemeProvider>,
      );
      expect(screen.getByRole('button', { name: 'Pronounce hello' })).toBeTruthy();
      expect(speech.getAvailableVoices).not.toHaveBeenCalled();
    } finally {
      act(() => {
        useUiStore.setState({ themePreference: 'system' });
      });
    }
  },
);
