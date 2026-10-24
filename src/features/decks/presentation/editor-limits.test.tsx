import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { makeDeck } from '@/../test/fixtures';
import { application } from '@/core/composition/application';
import { AppError } from '@/core/errors/app-error';
import { useLocalization } from '@/shared/localization/localization-provider';
import { formatNumber, resolveDirection, translate } from '@/shared/localization/localization';
import { DeckEditorScreen } from './deck-editor-screen';
import { CardEditorScreen } from './card-editor-screen';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn() },
  useFocusEffect: (effect: () => void) => {
    const React = jest.requireActual('react');
    React.useEffect(effect, [effect]);
  },
}));
jest.mock('@/core/composition/application', () => ({
  application: {
    assertLearningAccess: jest.fn(),
    getDeck: jest.fn(),
    getCard: jest.fn(),
  },
}));
jest.mock('@/core/composition/haptics', () => ({
  haptics: { actionRejected: jest.fn(), actionConfirmed: jest.fn() },
}));
jest.mock('./deck-form', () => ({ DeckForm: () => null }));
jest.mock('./card-form', () => ({ CardForm: () => null }));
jest.mock('@/shared/localization/localization-provider', () => ({
  useLocalization: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(application.getDeck).mockResolvedValue(makeDeck());
});

test.each([
  ['en', 'deck'],
  ['en', 'card'],
  ['fa', 'deck'],
  ['fa', 'card'],
] as const)(
  '%s %s creation explains the free-plan maximum instead of unavailable',
  async (language, operation) => {
    jest.mocked(useLocalization).mockReturnValue({
      language,
      direction: resolveDirection(language),
      t: (key, values) => translate(language, key, values),
      number: (value) => formatNumber(value, language),
    });
    jest
      .mocked(application.assertLearningAccess)
      .mockRejectedValue(new AppError('free-tier-limit', 'Quota'));
    render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 320, height: 850 },
          insets: { top: 0, right: 0, bottom: 0, left: 0 },
        }}
      >
        {operation === 'deck' ? <DeckEditorScreen /> : <CardEditorScreen deckId="deck" />}
      </SafeAreaProvider>,
    );
    expect(await screen.findByText(translate(language, 'guest.limitTitle'))).toBeTruthy();
    expect(
      screen.getByText(
        translate(language, operation === 'deck' ? 'guest.deckLimit' : 'guest.cardLimit'),
      ),
    ).toBeTruthy();
    expect(application.assertLearningAccess).toHaveBeenCalledWith(operation);
    expect(screen.getByTestId('feedback-modal')).toBeTruthy();
    expect(
      screen.queryByText(
        translate(
          language,
          operation === 'deck' ? 'details.deckUnavailable' : 'details.cardUnavailable',
        ),
      ),
    ).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: translate(language, 'common.close') }));
    expect(screen.queryByTestId('feedback-modal')).toBeNull();
    expect(screen.queryByText(translate(language, 'guest.limitTitle'))).toBeNull();
    expect(
      screen.queryByRole('button', { name: translate(language, 'common.tryAgain') }),
    ).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: translate(language, 'access.plans') }));
    expect(router.push).toHaveBeenCalledWith('/settings/subscription');
    fireEvent.press(
      screen.getByRole('button', { name: translate(language, 'common.browseDecks') }),
    );
    expect(router.replace).toHaveBeenCalledWith('/decks');
  },
);
