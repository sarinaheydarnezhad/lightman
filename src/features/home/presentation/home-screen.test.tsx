import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { makeDeck } from '@/../test/fixtures';
import { formatNumber, resolveDirection, translate } from '@/shared/localization/localization';
import { useLocalization } from '@/shared/localization/localization-provider';
import { ThemeProvider } from '@/shared/theme/theme-provider';
import { HomeScreen } from './home-screen';

let mockPreference: 'light' | 'dark' = 'light';
const mockSettings = { light: { theme: 'light' }, dark: { theme: 'dark' } };
const mockStart = jest.fn();
const mockHome = {
  loading: false,
  error: null,
  refresh: jest.fn(),
  dueCount: 48,
  cardCount: 48,
  reviewedToday: 0,
  streak: 0,
  featuredDecks: [makeDeck({ name: 'Aaa' })],
};
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/core/composition/application', () => ({
  application: {
    settings: { subscribe: () => () => {}, snapshot: () => mockSettings[mockPreference] },
  },
}));
jest.mock('@/shared/localization/localization-provider', () => ({ useLocalization: jest.fn() }));
jest.mock('./use-home-view-model', () => ({ useHomeViewModel: () => mockHome }));
jest.mock('@/features/study/presentation/use-start-study', () => ({
  useStartStudy: () => ({ start: mockStart, starting: false, error: null }),
}));

beforeEach(() => jest.clearAllMocks());

test.each([
  ['en', 'light'],
  ['en', 'dark'],
  ['fa', 'light'],
  ['fa', 'dark'],
] as const)('%s home retains real metrics and navigation in %s appearance', (language, theme) => {
  mockPreference = theme;
  jest.mocked(useLocalization).mockReturnValue({
    language,
    direction: resolveDirection(language),
    t: (key, values) => translate(language, key, values),
    number: (value) => formatNumber(value, language),
  });
  render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      }}
    >
      <ThemeProvider>
        <HomeScreen />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  expect(screen.getByRole('header', { name: translate(language, 'home.welcome') })).toBeTruthy();
  expect(screen.getByText(formatNumber(48, language))).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: translate(language, 'study.start') }));
  expect(mockStart).toHaveBeenCalledWith({ kind: 'all-decks' });
  fireEvent.press(
    screen.getByRole('button', { name: translate(language, 'home.openDeck', { name: 'Aaa' }) }),
  );
  expect(router.push).toHaveBeenCalledWith({
    pathname: '/decks/[deckId]',
    params: { deckId: mockHome.featuredDecks[0]!.id },
  });
  fireEvent.press(screen.getByRole('button', { name: translate(language, 'home.browse') }));
  expect(router.push).toHaveBeenCalledWith('/decks');
});
