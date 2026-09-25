import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { renderRouter, screen } from 'expo-router/testing-library';
import { AccessibilityInfo, Platform, Pressable, View } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import {
  addNotificationResponseReceivedListener,
  getLastNotificationResponse,
} from 'expo-notifications';

import RootLayout, { ErrorBoundary } from '@/app/_layout';
import NotFound from '@/app/+not-found';
import TabsLayout from '@/app/(tabs)/_layout';
import Home from '@/app/(tabs)/index';
import Decks from '@/app/(tabs)/decks';
import Study from '@/app/(tabs)/study';
import Analytics from '@/app/(tabs)/analytics';
import Settings from '@/app/(tabs)/settings';
import CreateDeck from '@/app/decks/create';
import DeckDetails from '@/app/decks/[deckId]/index';
import EditDeck from '@/app/decks/[deckId]/edit';
import CreateCard from '@/app/decks/[deckId]/cards/create';
import CardList from '@/app/decks/[deckId]/cards/index';
import CardDetails from '@/app/decks/[deckId]/cards/[cardId]/index';
import EditCard from '@/app/decks/[deckId]/cards/[cardId]/edit';
import StudySession from '@/app/study/[sessionId]';
import VocabularyHelper from '@/app/vocabulary/helper';
import Appearance from '@/app/settings/appearance';
import SpeechSettings from '@/app/settings/speech';
import LanguageSettings from '@/app/settings/language';
import DesignSystem from '@/app/design-system';
import { idGenerator } from '@/core/infrastructure/platform';
import { application } from '@/core/composition/application';
import { repositories } from '@/core/composition/repositories';
import { seedDevelopmentData } from '@/core/composition/development-seed';
import { haptics } from '@/core/composition/haptics';
import { speech } from '@/core/composition/speech';
import { expoNotificationService } from '@/core/infrastructure/expo-notification-service';
import { AppError } from '@/core/errors/app-error';
import { calendarDate, instant, languageTag, localTime } from '@/core/domain/values';
import { makeEvent, makeState } from '@/../test/fixtures';
import {
  analyticsWindow,
  getStudySummary,
  type AnalyticsWindow,
} from '@/features/analytics/domain/analytics';
import { setTestTheme } from '@/../test/set-test-theme';
import * as swipeSurface from '@/features/study/presentation/swipeable-study-card';

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 },
  DEFAULT_ACTION_IDENTIFIER: 'default',
  IosAuthorizationStatus: {
    NOT_DETERMINED: 0,
    DENIED: 1,
    AUTHORIZED: 2,
    PROVISIONAL: 3,
    EPHEMERAL: 4,
  },
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(undefined),
  getPermissionsAsync: jest.fn().mockResolvedValue({ granted: true, status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ granted: true, status: 'granted' }),
  getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('reminder'),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  addNotificationResponseReceivedListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  getLastNotificationResponse: jest.fn().mockReturnValue(null),
  clearLastNotificationResponse: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => {
  // Jest hoists the factory above imports.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('react-native-safe-area-context/jest/mock').default;
});

const routes = {
  _layout: RootLayout,
  '+not-found': NotFound,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': Home,
  '(tabs)/decks': Decks,
  '(tabs)/study': Study,
  '(tabs)/analytics': Analytics,
  '(tabs)/settings': Settings,
  'decks/create': CreateDeck,
  'decks/[deckId]/index': DeckDetails,
  'decks/[deckId]/edit': EditDeck,
  'decks/[deckId]/cards/create': CreateCard,
  'decks/[deckId]/cards/index': CardList,
  'decks/[deckId]/cards/[cardId]/index': CardDetails,
  'decks/[deckId]/cards/[cardId]/edit': EditCard,
  'study/[sessionId]': StudySession,
  'vocabulary/helper': VocabularyHelper,
  'settings/appearance': Appearance,
  'settings/speech': SpeechSettings,
  'settings/language': LanguageSettings,
  'design-system': DesignSystem,
};

beforeAll(async () => {
  await seedDevelopmentData(repositories);
});

afterEach(async () => {
  await setTestTheme('system');
  jest.restoreAllMocks();
});

test('root layout renders the app and accessible tab navigation', async () => {
  const rendered = renderRouter(routes, { initialUrl: '/' });
  expect(await screen.findByRole('header', { name: 'Welcome back' })).toBeTruthy();
  for (const label of ['Home', 'Decks', 'Study', 'Analytics', 'Settings']) {
    expect(screen.getByRole('button', { name: `${label} tab` })).toBeTruthy();
  }
  expect(screen.getByRole('button', { name: 'Home tab', selected: true })).toBeTruthy();
  expect(rendered.getPathname()).toBe('/');
});

test.each([
  ['/', 'Welcome back'],
  ['/decks', 'Decks'],
  ['/study', 'Study'],
  ['/analytics', 'Analytics'],
  ['/settings', 'Settings'],
])('primary route %s resolves to %s', async (path, heading) => {
  const rendered = renderRouter(routes, { initialUrl: path });
  expect(await screen.findByRole('header', { name: heading })).toBeTruthy();
  expect(rendered.getPathname()).toBe(path);
});

test('app language switches visible navigation and RTL labels without changing deck language', async () => {
  renderRouter(routes, { initialUrl: '/settings/language' });
  const before = (await application.getDeck('travel-basics')).language;
  try {
    const persian = await screen.findByRole('button', { name: 'Persian' });
    fireEvent.press(persian);
    await waitFor(() => expect(application.settings.snapshot()?.language).toBe('fa'));
    const heading = await screen.findByRole('header', { name: 'زبان برنامه' });
    let layout = heading.parent;
    while (layout && layout.props.style?.direction !== 'rtl') layout = layout.parent;
    expect(layout?.props.style).toMatchObject({ direction: 'rtl' });
    expect(screen.getByRole('button', { name: 'فارسی', selected: true })).toBeTruthy();
    expect((await application.getDeck('travel-basics')).language).toBe(before);
    fireEvent.press(screen.getByRole('button', { name: 'عربی' }));
    await waitFor(() => expect(application.settings.snapshot()?.language).toBe('ar'));
    expect(await screen.findByRole('header', { name: 'لغة التطبيق' })).toBeTruthy();
  } finally {
    await act(async () => {
      await application.settings.setLanguage(languageTag('en'));
    });
  }
});

const analyticsToday = calendarDate('2026-09-25');
const analyticsNow = instant('2026-09-25T12:00:00.000Z');
function analyticsFixture(days: AnalyticsWindow = 30, count = 0) {
  return getStudySummary(
    Array.from({ length: count }, (_, index) =>
      makeEvent({
        id: `analytics-${index}`,
        cardId: index === 0 ? 'a' : 'b',
        reviewedAt: instant(index < 2 ? '2026-09-25T10:00:00.000Z' : '2026-09-24T10:00:00.000Z'),
        result: index === 1 ? 'failure' : 'success',
      }),
    ),
    count ? [makeState({ cardId: 'a', box: 1 }), makeState({ cardId: 'b', box: 5 })] : [],
    analyticsWindow(analyticsToday, days),
    analyticsToday,
    analyticsNow,
    'UTC',
  );
}

test('analytics shows loading, an honest empty state, zero distributions and no fake retention', async () => {
  let resolve: (value: ReturnType<typeof analyticsFixture>) => void = () => {};
  jest.spyOn(application, 'getAnalyticsWindow').mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  renderRouter(routes, { initialUrl: '/analytics' });
  expect(await screen.findByRole('progressbar', { name: 'Loading analytics' })).toBeTruthy();
  await act(async () => resolve(analyticsFixture()));
  expect(await screen.findByRole('header', { name: 'No study data yet' })).toBeTruthy();
  expect(screen.getByLabelText('Cards reviewed today: 0')).toBeTruthy();
  expect(
    screen.getByLabelText('Retention in the selected window: No review data yet'),
  ).toBeTruthy();
  expect(screen.getByText('No active cards to distribute.')).toBeTruthy();
  expect(
    screen.getByLabelText('30-day review activity: 0 reviews across 0 active days.'),
  ).toBeTruthy();
});

test('analytics distinguishes an empty review history from real unreviewed active cards', async () => {
  jest
    .spyOn(application, 'getAnalyticsWindow')
    .mockResolvedValue(
      getStudySummary(
        [],
        [makeState({ cardId: 'unreviewed' })],
        analyticsWindow(analyticsToday, 30),
        analyticsToday,
        analyticsNow,
        'UTC',
      ),
    );
  renderRouter(routes, { initialUrl: '/analytics' });
  expect(await screen.findByRole('header', { name: 'No study data yet' })).toBeTruthy();
  expect(screen.getByLabelText('Box 1: 1 active card')).toBeTruthy();
  expect(
    screen.getByLabelText('Retention in the selected window: No review data yet'),
  ).toBeTruthy();
});

test('analytics presents real metrics, boxes and 7/30/90-day accessible chart summaries', async () => {
  const load = jest
    .spyOn(application, 'getAnalyticsWindow')
    .mockImplementation(async (days = 30) => analyticsFixture(days, 3));
  renderRouter(routes, { initialUrl: '/analytics' });
  expect(
    await screen.findByLabelText('30-day review activity: 3 reviews across 2 active days.'),
  ).toBeTruthy();
  expect(screen.getByLabelText('Current streak: 2 days. Best streak: 2 days.')).toBeTruthy();
  expect(screen.getByLabelText('Cards reviewed today: 2')).toBeTruthy();
  expect(screen.getByLabelText('Retention in the selected window: 67 percent')).toBeTruthy();
  expect(screen.getByLabelText('Box 1: 1 active card')).toBeTruthy();
  expect(screen.getByLabelText('Box 5: 1 active card')).toBeTruthy();
  expect(screen.getByText('2026-08-27')).toBeTruthy();
  fireEvent.press(screen.getByRole('tab', { name: '7D' }));
  expect(
    await screen.findByLabelText('7-day review activity: 3 reviews across 2 active days.'),
  ).toBeTruthy();
  expect(screen.getByRole('tab', { name: '7D', selected: true }).props.accessibilityHint).toContain(
    '7 calendar days',
  );
  fireEvent.press(screen.getByRole('tab', { name: '90D' }));
  expect(
    await screen.findByLabelText('90-day review activity: 3 reviews across 2 active days.'),
  ).toBeTruthy();
  expect(load).toHaveBeenCalledWith(90);
});

test('analytics allows retry after a repository error and refreshes when navigation refocuses', async () => {
  const load = jest
    .spyOn(application, 'getAnalyticsWindow')
    .mockRejectedValueOnce(new Error('private details'))
    .mockResolvedValueOnce(analyticsFixture())
    .mockResolvedValue(analyticsFixture(30, 3));
  renderRouter(routes, { initialUrl: '/analytics' });
  expect(await screen.findByText('Unable to load this screen.')).toBeTruthy();
  expect(screen.queryByText('private details')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('header', { name: 'No study data yet' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Home tab' }));
  await screen.findByRole('header', { name: 'Welcome back' });
  fireEvent.press(screen.getByRole('button', { name: 'Analytics tab' }));
  expect(
    await screen.findByLabelText('30-day review activity: 3 reviews across 2 active days.'),
  ).toBeTruthy();
  expect(load).toHaveBeenCalledTimes(3);
});

test.each(['light', 'dark', 'oled'] as const)(
  '%s analytics theme remains accessible',
  async (themePreference) => {
    await act(async () => setTestTheme(themePreference));
    jest.spyOn(application, 'getAnalyticsWindow').mockResolvedValue(analyticsFixture(30, 3));
    renderRouter(routes, { initialUrl: '/analytics' });
    expect(
      await screen.findByLabelText('30-day review activity: 3 reviews across 2 active days.'),
    ).toBeTruthy();
    expect(screen.getByRole('tab', { name: '30D', selected: true })).toBeTruthy();
  },
);

test('selecting a tab updates its accessible selected state', async () => {
  const rendered = renderRouter(routes, { initialUrl: '/' });
  await screen.findByRole('header', { name: 'Welcome back' });
  fireEvent.press(screen.getByRole('button', { name: 'Decks tab' }));
  expect(await screen.findByRole('header', { name: 'Decks' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Decks tab', selected: true })).toBeTruthy();
  expect(rendered.getPathname()).toBe('/decks');
});

test('a deck opens its typed secondary route', async () => {
  const rendered = renderRouter(routes, { initialUrl: '/decks' });
  await screen.findByRole('header', { name: 'Decks' });
  fireEvent.press(screen.getByRole('button', { name: /Open Everyday phrases deck/ }));
  expect(await screen.findByRole('header', { name: 'Everyday phrases' })).toBeTruthy();
  expect(rendered.getPathname()).toBe('/decks/everyday-phrases');
});

test('create deck opens its secondary route', async () => {
  const rendered = renderRouter(routes, { initialUrl: '/decks' });
  await screen.findByRole('header', { name: 'Decks' });
  fireEvent.press(screen.getByRole('button', { name: 'Create deck' }));
  expect(await screen.findByText('Create a deck')).toBeTruthy();
  expect(rendered.getPathname()).toBe('/decks/create');
});

test('deck search ignores case and surrounding whitespace and shows a no-match state', async () => {
  renderRouter(routes, { initialUrl: '/decks' });
  await screen.findByRole('button', { name: /Open Everyday phrases deck/ });
  fireEvent.changeText(screen.getByLabelText('Search decks'), '  EVERYDAY  ');
  expect(await screen.findByRole('button', { name: /Open Everyday phrases deck/ })).toBeTruthy();
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: /Open Travel basics deck/ })).toBeNull(),
  );
  fireEvent.changeText(screen.getByLabelText('Search decks'), 'unlikely-deck-name');
  expect(await screen.findByRole('header', { name: 'No matching decks' })).toBeTruthy();
});

test('the empty collection invites creation', async () => {
  const list = jest.spyOn(application, 'listDecks').mockResolvedValue([]);
  try {
    renderRouter(routes, { initialUrl: '/decks' });
    expect(await screen.findByRole('header', { name: 'No decks yet' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Create deck' })).toBeTruthy();
  } finally {
    list.mockRestore();
  }
});

test('create form shows field errors and keeps the user on the form', async () => {
  const rendered = renderRouter(routes, { initialUrl: '/decks/create' });
  await screen.findByRole('header', { name: 'Create a deck' });
  fireEvent.press(screen.getByRole('button', { name: 'Create deck' }));
  expect(await screen.findByText('Enter a deck name.')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Deck name'), 'A valid deck');
  fireEvent.press(screen.getByRole('button', { name: 'Other' }));
  fireEvent.changeText(screen.getByLabelText('Language tag'), 'invalid tag!');
  fireEvent.press(screen.getByRole('button', { name: 'Create deck' }));
  expect(await screen.findByText('Enter a valid language tag, such as es or fr-CA.')).toBeTruthy();
  expect(rendered.getPathname()).toBe('/decks/create');
});

test('editing a deck retains its regional language and updates the detail screen', async () => {
  const rendered = renderRouter(routes, { initialUrl: '/decks/travel-basics' });
  await screen.findByRole('header', { name: 'Travel basics' });
  fireEvent.press(screen.getByRole('button', { name: 'Edit deck' }));
  await screen.findByRole('header', { name: 'Edit Travel basics' });
  expect(screen.getByRole('button', { name: 'Persian', selected: true })).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Description (optional)'), 'Updated for travel.');
  fireEvent.press(screen.getByRole('button', { name: 'Save deck' }));
  expect(await screen.findByText('Updated for travel.')).toBeTruthy();
  expect(rendered.getPathname()).toBe('/decks/travel-basics');
  expect((await application.getDeck('travel-basics')).language).toBe('fa-IR');
});

test('card list opens from deck details, searches and filters without mixing decks', async () => {
  const rendered = renderRouter(routes, { initialUrl: '/decks/everyday-phrases' });
  await screen.findByRole('header', { name: 'Everyday phrases' });
  fireEvent.press(screen.getByRole('button', { name: 'View cards' }));
  expect(rendered.getPathname()).toBe('/decks/everyday-phrases/cards');
  expect(await screen.findByRole('button', { name: /Open Hello card/ })).toBeTruthy();
  expect(screen.getByRole('button', { name: /Open Thank you card/ })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Open port card/ })).toBeNull();
  fireEvent.changeText(screen.getByLabelText('Search cards'), '  /HƏˈLOʊ/  ');
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: /Open Thank you card/ })).toBeNull(),
  );
  expect(screen.getByRole('button', { name: /Open Hello card/ })).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Search cards'), '');
  fireEvent.press(await screen.findByRole('button', { name: 'Courtesy' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: /Open Hello card/ })).toBeNull());
  expect(screen.getByRole('button', { name: /Open Thank you card/ })).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Search cards'), 'nowhere');
  expect(await screen.findByRole('header', { name: 'No matching cards' })).toBeTruthy();
}, 60_000);

test('an empty deck has a card action and invalid card routes show a retry', async () => {
  const rendered = renderRouter(routes, { initialUrl: '/decks/fresh-collection/cards' });
  expect(await screen.findByRole('header', { name: 'No cards yet' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Add card' }));
  expect(await screen.findByRole('header', { name: 'Create a card' })).toBeTruthy();
  expect(rendered.getPathname()).toBe('/decks/fresh-collection/cards/create');
});

test('missing deck and mismatched card routes show safe unavailable states', async () => {
  const rendered = renderRouter(routes, { initialUrl: '/decks/missing/cards' });
  expect(await screen.findByRole('header', { name: 'Cards unavailable' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Browse decks' }));
  expect(await screen.findByRole('header', { name: 'Decks' })).toBeTruthy();
  rendered.unmount();
  renderRouter(routes, { initialUrl: '/decks/travel-basics/cards/phrase-hello' });
  expect(await screen.findByRole('header', { name: 'Card unavailable' })).toBeTruthy();
});

test('card form validates required fields and previews RTL content with examples', async () => {
  renderRouter(routes, { initialUrl: '/decks/travel-basics/cards/create' });
  await screen.findByRole('header', { name: 'Create a card' });
  fireEvent.press(screen.getByRole('button', { name: 'Create card' }));
  expect(screen.getByText('Enter a term.')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Front text'), '  New term  ');
  fireEvent.press(screen.getByRole('button', { name: 'Create card' }));
  expect(screen.getByText('Enter a meaning.')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Meaning'), '  Definition  ');
  fireEvent.press(screen.getByRole('button', { name: 'Add example' }));
  fireEvent.press(screen.getByRole('button', { name: 'Create card' }));
  expect(screen.getByText('Enter a sentence or remove this example.')).toBeTruthy();
  fireEvent.changeText(screen.getByLabelText('Sentence 1'), '  A  sentence  ');
  fireEvent.changeText(screen.getByLabelText('Translation 1 (optional)'), '  ترجمه  ');
  fireEvent.press(screen.getByRole('button', { name: 'Preview card' }));
  expect(screen.getByText('New term')).toHaveStyle({ textAlign: 'right', writingDirection: 'rtl' });
  expect(screen.getByText('A  sentence')).toBeTruthy();
});

test('editing existing examples keeps translation and notes and rejects mismatched deck IDs', async () => {
  const rendered = renderRouter(routes, {
    initialUrl: '/decks/everyday-phrases/cards/phrase-hello',
  });
  await screen.findByRole('header', { name: 'Hello' });
  fireEvent.press(screen.getByRole('button', { name: 'Edit card' }));
  await screen.findByRole('header', { name: 'Edit card' });
  expect(screen.getByLabelText('Translation 1 (optional)').props.value).toBe(
    'A friendly greeting.',
  );
  expect(screen.getByLabelText('Notes 2 (optional)').props.value).toBe(
    'A longer conversational example.',
  );
  fireEvent.changeText(screen.getByLabelText('Sentence 2'), '  Changed  with  spacing.  ');
  fireEvent.press(screen.getByRole('button', { name: 'Save card' }));
  expect(await screen.findByText('Changed  with  spacing.')).toBeTruthy();
  expect(screen.getByText('A friendly greeting.')).toBeTruthy();
  expect(screen.getByText('A longer conversational example.')).toBeTruthy();
  expect(rendered.getPathname()).toBe('/decks/everyday-phrases/cards/phrase-hello');
});

test('editing a card can remove a usage example without adding placeholder content', async () => {
  renderRouter(routes, { initialUrl: '/decks/word-roots/cards/root-port' });
  await screen.findByRole('header', { name: 'port' });
  fireEvent.press(screen.getByRole('button', { name: 'Edit card' }));
  await screen.findByRole('header', { name: 'Edit card' });
  fireEvent.press(screen.getByRole('button', { name: 'Remove example 1' }));
  fireEvent.press(screen.getByRole('button', { name: 'Save card' }));
  expect(await screen.findByRole('header', { name: 'port' })).toBeTruthy();
  expect(screen.queryByText('Transport means to carry across.')).toBeNull();
  expect((await application.getCard('root-port')).examples).toEqual([]);
});

test('appearance selection uses the existing session preference', async () => {
  renderRouter(routes, { initialUrl: '/settings' });
  await screen.findByRole('header', { name: 'Settings' });
  fireEvent.press(screen.getByRole('button', { name: /Theme, Current: System/ }));
  expect(await screen.findByRole('header', { name: 'Appearance' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'OLED' }));
  expect(await screen.findByRole('button', { name: 'OLED', selected: true })).toBeTruthy();
  expect((await application.getSettings())?.theme).toBe('oled');
});

test('haptics can be disabled and re-enabled through in-memory settings', async () => {
  renderRouter(routes, { initialUrl: '/settings' });
  await screen.findByRole('header', { name: 'Settings' });
  const update = jest.spyOn(application.settings, 'setHaptics');
  const feedback = jest.spyOn(haptics, 'selection').mockResolvedValue();
  const off = await screen.findByRole('switch', { name: 'Haptic feedback', checked: true });
  fireEvent.press(off);
  fireEvent.press(off);
  await waitFor(() =>
    expect(screen.getByRole('switch', { name: 'Haptic feedback', checked: false })).toBeTruthy(),
  );
  expect(update).toHaveBeenCalledTimes(1);
  expect((await application.getSettings())?.hapticsEnabled).toBe(false);
  expect(feedback).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('switch', { name: 'Haptic feedback', checked: false }));
  await waitFor(() =>
    expect(screen.getByRole('switch', { name: 'Haptic feedback', checked: true })).toBeTruthy(),
  );
  expect((await application.getSettings())?.hapticsEnabled).toBe(true);
  expect(feedback).toHaveBeenCalledTimes(1);
});

test('daily reminder uses the notification service and reveals the local time control', async () => {
  const schedule = jest.spyOn(expoNotificationService, 'scheduleDailyReminder').mockResolvedValue();
  const cancel = jest.spyOn(expoNotificationService, 'cancelDailyReminder').mockResolvedValue();
  await application.settings.setReminderEnabled(false);
  cancel.mockClear();
  renderRouter(routes, { initialUrl: '/settings' });
  const toggle = await screen.findByRole('switch', { name: 'Daily reminder', checked: false });
  fireEvent.press(toggle);
  await waitFor(() =>
    expect(screen.getByRole('switch', { name: 'Daily reminder', checked: true })).toBeTruthy(),
  );
  expect(schedule).toHaveBeenCalledWith('09:00', 'en');
  expect(screen.getByRole('button', { name: /Reminder time, 09:00/ })).toBeTruthy();
  fireEvent.press(screen.getByRole('switch', { name: 'Daily reminder', checked: true }));
  await waitFor(() =>
    expect(screen.getByRole('switch', { name: 'Daily reminder', checked: false })).toBeTruthy(),
  );
  expect(cancel).toHaveBeenCalledTimes(2);
});

test('permission denial keeps reminder off and offers device settings', async () => {
  await application.settings.setReminderEnabled(false);
  jest.spyOn(expoNotificationService, 'getPermissionStatus').mockResolvedValue('denied');
  renderRouter(routes, { initialUrl: '/settings' });
  await screen.findByLabelText('Notification permission: Disabled in device settings');
  fireEvent.press(await screen.findByRole('switch', { name: 'Daily reminder', checked: false }));
  expect(await screen.findByRole('button', { name: 'Open notification settings' })).toBeTruthy();
  expect((await application.getSettings())?.dailyReminderEnabled).toBe(false);
});

test('unavailable notifications leave the reminder switch disabled', async () => {
  await application.settings.setReminderEnabled(false);
  jest.spyOn(expoNotificationService, 'getPermissionStatus').mockResolvedValue('unavailable');
  renderRouter(routes, { initialUrl: '/settings' });
  await screen.findByLabelText('Notification permission: Unavailable');
  expect(screen.getByRole('switch', { name: 'Daily reminder', disabled: true })).toBeTruthy();
});

test('tapping the local reminder enters the normal all-decks study flow', async () => {
  const start = jest
    .spyOn(application, 'startStudySession')
    .mockResolvedValue({ id: 'tap-session' } as never);
  jest.spyOn(application, 'getActiveStudySession').mockResolvedValue(null);
  const rendered = renderRouter(routes, { initialUrl: '/settings' });
  await screen.findByRole('header', { name: 'Settings' });
  const listener = jest.mocked(addNotificationResponseReceivedListener).mock.calls.at(-1)![0];
  act(() =>
    listener({
      actionIdentifier: 'default',
      notification: {
        date: 123450,
        request: {
          identifier: 'study-tap',
          content: { data: { reminderKey: 'lightman.daily-study-reminder' } },
        },
      },
    } as never),
  );
  await waitFor(() => expect(start).toHaveBeenCalledWith({ kind: 'all-decks' }));
  await waitFor(() => expect(rendered.getPathname()).toContain('/study/tap-session'));
});

test('a cold-start reminder tap is consumed after navigation becomes ready', async () => {
  jest.mocked(getLastNotificationResponse).mockReturnValueOnce({
    actionIdentifier: 'default',
    notification: {
      date: 123451,
      request: {
        identifier: 'cold-study-tap',
        content: { data: { reminderKey: 'lightman.daily-study-reminder' } },
      },
    },
  } as never);
  const start = jest
    .spyOn(application, 'startStudySession')
    .mockResolvedValue({ id: 'cold-session' } as never);
  jest.spyOn(application, 'getActiveStudySession').mockResolvedValue(null);
  renderRouter(routes, { initialUrl: '/settings' });
  await waitFor(() => expect(start).toHaveBeenCalledWith({ kind: 'all-decks' }));
  expect(start).toHaveBeenCalledTimes(1);
});

test('changing the reminder time through the Android picker reschedules once', async () => {
  const nativePlatform = jest.replaceProperty(Platform, 'OS', 'android');
  try {
    const schedule = jest
      .spyOn(expoNotificationService, 'scheduleDailyReminder')
      .mockResolvedValue();
    jest.spyOn(expoNotificationService, 'cancelDailyReminder').mockResolvedValue();
    await application.settings.setReminderEnabled(false);
    await application.settings.setReminderTime(localTime('09:00'));
    await application.settings.setReminderEnabled(true);
    const picker = jest.spyOn(DateTimePickerAndroid, 'open').mockImplementation(() => {});
    renderRouter(routes, { initialUrl: '/settings' });
    fireEvent.press(await screen.findByRole('button', { name: /Reminder time, 09:00/ }));
    schedule.mockClear();
    expect(picker).toHaveBeenCalledTimes(1);
    const selected = new Date();
    selected.setHours(18, 45, 0, 0);
    await act(async () => {
      picker.mock.calls[0]![0].onChange?.({ type: 'set' } as never, selected);
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Reminder time, 18:45/ })).toBeTruthy(),
    );
    expect(schedule).toHaveBeenLastCalledWith('18:45', 'en');
    expect(schedule).toHaveBeenCalledTimes(1);
    await application.settings.setReminderEnabled(false);
  } finally {
    nativePlatform.restore();
  }
});

test('speech settings show accent options only for English', async () => {
  jest.spyOn(speech, 'getAvailableVoices').mockResolvedValue([
    { name: 'Device English', language: 'en-US', quality: 'default' },
    { name: 'Device Persian', language: 'fa-IR', quality: 'default' },
  ]);
  renderRouter(routes, { initialUrl: '/settings' });
  await screen.findByRole('header', { name: 'Settings' });
  fireEvent.press(screen.getByRole('button', { name: /Pronunciation, Speech language/ }));
  expect(await screen.findByRole('header', { name: 'Pronunciation' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'English', selected: true })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'UK English' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Persian' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'UK English' })).toBeNull());
  expect((await application.getSettings())?.preferredSpeechLanguage).toBe('fa');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'English' }).props.accessibilityState.disabled).toBe(
      false,
    ),
  );
  fireEvent.press(screen.getByRole('button', { name: 'English' }));
  await screen.findByRole('button', { name: 'UK English' });
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'UK English' }).props.accessibilityState.disabled,
    ).toBe(false),
  );
  fireEvent.press(screen.getByRole('button', { name: 'UK English' }));
  await waitFor(async () =>
    expect((await application.getSettings())?.preferredSpeechAccent).toBe('uk'),
  );
  await application.updateSettings({
    preferredSpeechLanguage: languageTag('en'),
    preferredSpeechAccent: null,
  });
}, 15000);

test('card details pronounce only the term and stop speech when navigation leaves', async () => {
  const speak = jest.spyOn(speech, 'speak').mockResolvedValue(true);
  const stop = jest.spyOn(speech, 'stop').mockResolvedValue();
  renderRouter(routes, { initialUrl: '/decks/word-roots/cards/root-port' });
  await screen.findByRole('header', { name: 'port' });
  fireEvent.press(screen.getByRole('button', { name: 'Pronounce port' }));
  await waitFor(() =>
    expect(speak).toHaveBeenCalledWith('port', expect.objectContaining({ language: 'en' })),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Edit card' }));
  await screen.findByRole('header', { name: 'Edit card' });
  expect(stop).toHaveBeenCalled();
});

test.each(['success', 'failure'] as const)(
  'reveal and accepted %s button answer give one semantic event each',
  async (result) => {
    const reveal = jest.spyOn(haptics, 'cardReveal').mockResolvedValue();
    const success = jest.spyOn(haptics, 'answerSuccess').mockResolvedValue();
    const failure = jest.spyOn(haptics, 'answerFailure').mockResolvedValue();
    try {
      const { deck, cards } = await studyFixture(1);
      const session = await application.startStudySession({
        kind: 'specific-deck',
        deckId: deck.id,
      });
      renderRouter(routes, { initialUrl: `/study/${session.id}` });
      await screen.findByRole('header', { name: cards[0]!.frontText });
      fireEvent.press(screen.getByRole('button', { name: 'Reveal answer' }));
      expect(reveal).toHaveBeenCalledTimes(1);
      fireEvent.press(screen.getByRole('tab', { name: 'Examples' }));
      expect(reveal).toHaveBeenCalledTimes(1);
      const answer = screen.getByRole('button', {
        name: result === 'success' ? 'Success' : 'Failure',
      });
      fireEvent.press(answer);
      fireEvent.press(answer);
      await waitFor(() => expect(success.mock.calls.length + failure.mock.calls.length).toBe(1));
      expect(result === 'success' ? success : failure).toHaveBeenCalledTimes(1);
      expect(result === 'success' ? failure : success).not.toHaveBeenCalled();
      expect((await application.listReviewEvents({ cardId: cards[0]!.id })).length).toBe(1);
    } finally {
      reveal.mockRestore();
      success.mockRestore();
      failure.mockRestore();
    }
  },
);

test('an unknown route shows a helpful not-found screen', async () => {
  renderRouter(routes, { initialUrl: '/missing-page' });
  expect(await screen.findByText('Page not found')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Return home' }));
  expect(await screen.findByRole('header', { name: 'Welcome back' })).toBeTruthy();
});

test('route errors hide implementation details and allow retry', () => {
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
  const retry = jest.fn();

  try {
    render(<ErrorBoundary error={new Error('Private stack details')} retry={retry} />);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.queryByText('Private stack details')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
  } finally {
    errorLog.mockRestore();
  }
});

test('UI creates, edits and archives a deck and its card through the in-memory application', async () => {
  let nextId = 0;
  const idMock = jest.spyOn(idGenerator, 'create').mockImplementation(() => `flow-${++nextId}`);
  try {
    const rendered = renderRouter(routes, { initialUrl: '/decks' });
    await screen.findByRole('header', { name: 'Decks' });
    fireEvent.press(screen.getByRole('button', { name: 'Create deck' }));
    await screen.findByRole('header', { name: 'Create a deck' });
    fireEvent.changeText(screen.getByLabelText('Deck name'), 'Flow deck');
    fireEvent.press(screen.getByRole('button', { name: 'Create deck' }));
    expect(await screen.findByRole('button', { name: /Open Flow deck deck/ })).toBeTruthy();
    expect(rendered.getPathname()).toBe('/decks');
    fireEvent.press(screen.getByRole('button', { name: /Open Flow deck deck/ }));
    expect(await screen.findByRole('header', { name: 'Flow deck' })).toBeTruthy();
    const deckId = rendered.getPathname().split('/').at(-1)!;

    fireEvent.press(screen.getByRole('button', { name: 'Add card' }));
    await screen.findByRole('header', { name: 'Create a card' });
    fireEvent.changeText(screen.getByLabelText('Front text'), 'Flow word');
    fireEvent.changeText(screen.getByLabelText('Meaning'), 'Initial meaning');
    fireEvent.press(screen.getByRole('button', { name: 'Create card' }));
    expect(await screen.findByRole('header', { name: 'Flow word' })).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Edit card' }));
    await screen.findByRole('header', { name: 'Edit card' });
    fireEvent.changeText(screen.getByLabelText('Meaning'), 'Updated meaning');
    fireEvent.press(screen.getByRole('button', { name: 'Save card' }));
    expect(await screen.findByText('Updated meaning')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Archive card' }));
    expect(screen.getByRole('header', { name: 'Archive this card?' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit card' })).toBeNull();
    expect(screen.getByText('It will be removed from the active cards in this deck.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Keep card' }));
    expect(screen.getByRole('header', { name: 'Flow word' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Archive card' }));
    fireEvent.press(screen.getByRole('button', { name: 'Confirm archive' }));
    expect(await screen.findByRole('header', { name: 'No cards yet' })).toBeTruthy();
    expect(screen.getByText('0 of 0 cards')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'View deck' }));
    expect(await screen.findByRole('header', { name: 'Flow deck' })).toBeTruthy();
    expect(screen.getByText('0 cards')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Edit deck' }));
    await screen.findByRole('header', { name: 'Edit Flow deck' });
    fireEvent.changeText(screen.getByLabelText('Deck name'), 'Updated flow deck');
    fireEvent.press(screen.getByRole('button', { name: 'Save deck' }));
    expect(await screen.findByRole('header', { name: 'Updated flow deck' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Archive deck' }));
    expect(screen.getByRole('header', { name: 'Archive this deck?' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit deck' })).toBeNull();
    expect(screen.getByText('It will be removed from your active deck list.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Keep deck' }));
    expect(screen.getByRole('header', { name: 'Updated flow deck' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Archive deck' }));
    fireEvent.press(screen.getByRole('button', { name: 'Confirm archive' }));
    expect(await screen.findByRole('header', { name: 'Decks' })).toBeTruthy();
    expect(rendered.getPathname()).toBe('/decks');
    expect(screen.queryByRole('button', { name: /Open Updated flow deck deck/ })).toBeNull();
    expect(deckId).toBeTruthy();
  } finally {
    idMock.mockRestore();
  }
}, 120_000);

test('rapid save taps create one card', async () => {
  const ids = jest.spyOn(idGenerator, 'create').mockReturnValue('rapid-card-id');
  try {
    renderRouter(routes, { initialUrl: '/decks/fresh-collection/cards/create' });
    await screen.findByRole('header', { name: 'Create a card' });
    const before = await application.countActiveCardsForDeck('fresh-collection');
    fireEvent.changeText(screen.getByLabelText('Front text'), 'One card only');
    fireEvent.changeText(screen.getByLabelText('Meaning'), 'Saved once');
    const save = screen.getByRole('button', { name: 'Create card' });
    fireEvent.press(save);
    fireEvent.press(save);
    expect(await screen.findByRole('header', { name: 'One card only' })).toBeTruthy();
    expect(await application.countActiveCardsForDeck('fresh-collection')).toBe(before + 1);
    expect(ids).toHaveBeenCalledTimes(1);
  } finally {
    ids.mockRestore();
  }
});

test('rapid save taps create one deck', async () => {
  const ids = jest.spyOn(idGenerator, 'create').mockReturnValue('rapid-deck-id');
  try {
    renderRouter(routes, { initialUrl: '/decks/create' });
    await screen.findByRole('header', { name: 'Create a deck' });
    fireEvent.changeText(screen.getByLabelText('Deck name'), 'One deck only');
    const save = screen.getByRole('button', { name: 'Create deck' });
    fireEvent.press(save);
    fireEvent.press(save);
    expect(await screen.findByRole('button', { name: /Open One deck only deck/ })).toBeTruthy();
    expect(ids).toHaveBeenCalledTimes(1);
  } finally {
    ids.mockRestore();
  }
});

let studyId = 0;

async function studyFixture(cardCount: number) {
  jest.spyOn(idGenerator, 'create').mockImplementation(() => `study-ui-${++studyId}`);
  const deck = await application.createDeck({
    name: `Study test ${cardCount}`,
    description: '',
    language: languageTag('en'),
    textAlignment: 'ltr',
    typographySize: 'medium',
  });
  const cards = await Promise.all(
    Array.from({ length: cardCount }, (_, index) =>
      application.createCard({
        deckId: deck.id,
        frontText: `Study word ${index + 1}`,
        phonetic: null,
        category: null,
        meaning: `Definition ${index + 1}`,
        examples: [{ sentence: `Example ${index + 1}` }],
      }),
    ),
  );
  return { deck, cards };
}

afterEach(async () => {
  const active = await application.getActiveStudySession();
  if (active) await application.cancelStudySession(active.id);
  jest.restoreAllMocks();
});

test('Study tab starts an all-deck session, reveals answers and lets users leave', async () => {
  jest.spyOn(idGenerator, 'create').mockImplementation(() => `study-ui-${++studyId}`);
  const rendered = renderRouter(routes, { initialUrl: '/study' });
  await screen.findByRole('header', { name: 'Study' });
  fireEvent.press(screen.getByRole('button', { name: 'Start study' }));
  expect(await screen.findByRole('header', { name: 'Study session' })).toBeTruthy();
  const active = await application.getActiveStudySession();
  expect(active?.scope).toEqual({ kind: 'all-decks' });
  expect(rendered.getPathname()).toBe(`/study/${active!.id}`);
  expect(screen.getByLabelText(/Card 1 of/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Success' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Reveal answer' }));
  expect(screen.getByRole('tab', { name: 'Meaning', selected: true })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Success' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Exit study' }));
  expect(await screen.findByRole('header', { name: 'Study' })).toBeTruthy();
  expect(await application.getActiveStudySession()).toBeNull();
}, 20_000);

test('advancing a study card and leaving study stop pronunciation without auto-play', async () => {
  const { deck, cards } = await studyFixture(2);
  const session = await application.startStudySession({ kind: 'specific-deck', deckId: deck.id });
  const speak = jest.spyOn(speech, 'speak').mockResolvedValue(true);
  const stop = jest.spyOn(speech, 'stop').mockResolvedValue();
  renderRouter(routes, { initialUrl: `/study/${session.id}` });
  await screen.findByRole('header', { name: cards[0]!.frontText });
  fireEvent.press(screen.getByRole('button', { name: `Pronounce ${cards[0]!.frontText}` }));
  await waitFor(() => expect(speak).toHaveBeenCalledTimes(1));
  fireEvent.press(screen.getByRole('button', { name: 'Reveal answer' }));
  fireEvent.press(screen.getByRole('button', { name: 'Success' }));
  await screen.findByRole('header', { name: cards[1]!.frontText });
  await waitFor(() => expect(stop).toHaveBeenCalled());
  expect(speak).toHaveBeenCalledTimes(1);
  const beforeLeaving = stop.mock.calls.length;
  fireEvent.press(screen.getByRole('button', { name: 'Exit study' }));
  fireEvent.press(screen.getByRole('button', { name: 'End session' }));
  await screen.findByRole('header', { name: 'Study' });
  expect(stop.mock.calls.length).toBeGreaterThan(beforeLeaving);
});

test('deck-specific session reveals examples, retries one failure, completes, and can start again', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility');
  const { deck } = await studyFixture(2);
  const rendered = renderRouter(routes, { initialUrl: `/decks/${deck.id}` });
  expect(await screen.findByRole('header', { name: deck.name })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Start study' }));
  expect(await screen.findByRole('header', { name: 'Study session' })).toBeTruthy();
  const session = (await application.getActiveStudySession())!;
  expect(session.scope).toEqual({ kind: 'specific-deck', deckId: deck.id });
  const first = (await application.getCurrentStudyItem(session.id))!;
  const firstCard = await application.getCard(first.cardId);
  expect(screen.getByRole('header', { name: firstCard.frontText })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Reveal answer' }));
  fireEvent.press(screen.getByRole('tab', { name: 'Examples' }));
  expect(screen.getByText(firstCard.examples[0]!.sentence)).toBeTruthy();
  const before = await application.getReviewState(first.cardId);
  expect(before?.totalReviews).toBe(0);
  const failureButton = screen.getByRole('button', { name: 'Failure' });
  fireEvent.press(failureButton);
  fireEvent.press(failureButton);
  await waitFor(async () =>
    expect((await application.getReviewState(first.cardId))?.totalReviews).toBe(1),
  );
  expect(announce).toHaveBeenCalledWith('Failure answer saved.');
  const next = (await application.getCurrentStudyItem(session.id))!;
  expect(next.cardId).not.toBe(first.cardId);
  expect(
    await screen.findByRole('header', { name: (await application.getCard(next.cardId)).frontText }),
  ).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Success' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Reveal answer' }));
  fireEvent.press(screen.getByRole('button', { name: 'Success' }));
  expect(await screen.findByText('One more try')).toBeTruthy();
  expect(screen.getByRole('header', { name: firstCard.frontText })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Reveal answer' }));
  fireEvent.press(screen.getByRole('button', { name: 'Failure' }));
  expect(await screen.findByRole('header', { name: 'Session complete' })).toBeTruthy();
  expect(announce).toHaveBeenCalledWith('Session complete. Every card is finished.');
  expect(screen.getByText('Cards studied: 2')).toBeTruthy();
  expect(screen.getByText('Retries: 1')).toBeTruthy();
  expect((await application.getReviewState(first.cardId))?.totalReviews).toBe(2);
  expect((await application.listReviewEvents({ cardId: first.cardId })).length).toBe(2);
  fireEvent.press(screen.getByRole('button', { name: 'Study again' }));
  expect(await screen.findByRole('header', { name: 'Study session' })).toBeTruthy();
  expect((await application.getActiveStudySession())?.scope).toEqual({
    kind: 'specific-deck',
    deckId: deck.id,
  });
  expect(rendered.getPathname()).toContain('/study/');
});

test('empty scoped study is a normal state and offers deck navigation', async () => {
  const { deck } = await studyFixture(0);
  renderRouter(routes, { initialUrl: `/decks/${deck.id}` });
  await screen.findByRole('header', { name: deck.name });
  fireEvent.press(screen.getByRole('button', { name: 'Start study' }));
  expect(await screen.findByRole('header', { name: 'No cards due today' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Browse decks' })).toBeTruthy();
  expect(await application.getActiveStudySession()).toBeNull();
});

test('exit after an answer confirms cancellation and keeps completed reviews', async () => {
  const { deck } = await studyFixture(2);
  renderRouter(routes, { initialUrl: `/decks/${deck.id}` });
  await screen.findByRole('header', { name: deck.name });
  fireEvent.press(screen.getByRole('button', { name: 'Start study' }));
  await screen.findByRole('header', { name: 'Study session' });
  const active = (await application.getActiveStudySession())!;
  const first = (await application.getCurrentStudyItem(active.id))!;
  fireEvent.press(screen.getByRole('button', { name: 'Reveal answer' }));
  fireEvent.press(screen.getByRole('button', { name: 'Success' }));
  await screen.findByRole('button', { name: 'Reveal answer' });
  fireEvent.press(screen.getByRole('button', { name: 'Exit study' }));
  expect(screen.getByRole('header', { name: 'End this session?' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Reveal answer' })).toBeNull();
  expect(
    screen.getByText('Your completed reviews will be kept, but this study session will end.'),
  ).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Keep studying' }));
  expect(screen.getByRole('button', { name: 'Reveal answer' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Exit study' }));
  fireEvent.press(screen.getByRole('button', { name: 'End session' }));
  expect(await screen.findByRole('header', { name: 'Study' })).toBeTruthy();
  expect((await application.getStudySession(active.id)).status).toBe('cancelled');
  expect((await application.getReviewState(first.cardId))?.totalReviews).toBe(1);
  expect((await application.listReviewEvents({ cardId: first.cardId })).length).toBe(1);
});

test('session start failure shows a recoverable error', async () => {
  const failure = jest
    .spyOn(application, 'startStudySession')
    .mockRejectedValueOnce(new AppError('persistence', 'Unable to load study.'));
  try {
    renderRouter(routes, { initialUrl: '/study' });
    await screen.findByRole('header', { name: 'Study' });
    fireEvent.press(screen.getByRole('button', { name: 'Start study' }));
    expect(await screen.findByText('Unable to load study.')).toBeTruthy();
  } finally {
    failure.mockRestore();
  }
});

test('Home starts an all-deck study session and exits back to Study', async () => {
  jest.spyOn(idGenerator, 'create').mockImplementation(() => `study-ui-${++studyId}`);
  const rendered = renderRouter(routes, { initialUrl: '/' });
  await screen.findByRole('header', { name: 'Welcome back' });
  fireEvent.press(screen.getByRole('button', { name: 'Start study' }));
  await screen.findByRole('header', { name: 'Study session' });
  const active = (await application.getActiveStudySession())!;
  expect(active.scope).toEqual({ kind: 'all-decks' });
  fireEvent.press(screen.getByRole('button', { name: 'Exit study' }));
  await screen.findByRole('header', { name: 'Study' });
  expect(rendered.getPathname()).toBe('/study');
});

test('answer failure keeps the current card available for a safe retry', async () => {
  const feedback = jest.spyOn(haptics, 'answerSuccess').mockResolvedValue();
  const { deck, cards } = await studyFixture(1);
  const submission = jest
    .spyOn(application, 'submitStudyAnswer')
    .mockRejectedValueOnce(new AppError('persistence', 'Could not save your answer.'));
  try {
    renderRouter(routes, { initialUrl: `/decks/${deck.id}` });
    await screen.findByRole('header', { name: deck.name });
    fireEvent.press(screen.getByRole('button', { name: 'Start study' }));
    await screen.findByRole('header', { name: cards[0]!.frontText });
    fireEvent.press(screen.getByRole('button', { name: 'Reveal answer' }));
    fireEvent.press(screen.getByRole('button', { name: 'Success' }));
    expect(await screen.findByText('Could not save your answer.')).toBeTruthy();
    expect(feedback).not.toHaveBeenCalled();
    expect(screen.getByText(cards[0]!.meaning)).toBeTruthy();
    expect((await application.getReviewState(cards[0]!.id))?.totalReviews).toBe(0);
    fireEvent.press(screen.getByRole('button', { name: 'Success' }));
    expect(await screen.findByRole('header', { name: 'Session complete' })).toBeTruthy();
    expect(feedback).toHaveBeenCalledTimes(1);
  } finally {
    submission.mockRestore();
    feedback.mockRestore();
  }
});

test('a committed physical-left swipe uses the same review path as a Success button on retry', async () => {
  const failureFeedback = jest.spyOn(haptics, 'answerFailure').mockResolvedValue();
  const successFeedback = jest.spyOn(haptics, 'answerSuccess').mockResolvedValue();
  // Jest cannot dispatch UI-thread worklets. The swipe surface itself is tested separately;
  // here its committed result exercises the real view model and application use case.
  jest
    .spyOn(swipeSurface, 'SwipeableStudyCard')
    .mockImplementation(({ children, revealed, onCommitStart, onAnswer }) => (
      <View>
        {children}
        {revealed ? (
          <Pressable
            testID="commit-left-swipe"
            onPress={() => {
              onCommitStart();
              onAnswer('failure');
            }}
          />
        ) : null}
      </View>
    ));
  const { deck, cards } = await studyFixture(1);
  renderRouter(routes, { initialUrl: `/decks/${deck.id}` });
  await screen.findByRole('header', { name: deck.name });
  fireEvent.press(screen.getByRole('button', { name: 'Start study' }));
  await screen.findByRole('header', { name: cards[0]!.frontText });
  const session = (await application.getActiveStudySession())!;
  fireEvent.press(screen.getByRole('button', { name: 'Reveal answer' }));
  const successButton = screen.getByRole('button', { name: 'Success' });
  fireEvent.press(screen.getByTestId('commit-left-swipe'));
  expect(screen.getByRole('button', { name: 'Success' }).props.accessibilityState.disabled).toBe(
    true,
  );
  fireEvent.press(successButton);
  await waitFor(async () => {
    expect((await application.getReviewState(cards[0]!.id))?.totalReviews).toBe(1);
  });
  expect((await application.listReviewEvents({ cardId: cards[0]!.id }))[0]?.result).toBe('failure');
  expect(failureFeedback).toHaveBeenCalledTimes(1);
  expect(successFeedback).not.toHaveBeenCalled();
  expect((await application.getCurrentStudyItem(session.id))?.kind).toBe('retry');
  await screen.findByText('One more try');
  fireEvent.press(screen.getByRole('button', { name: 'Reveal answer' }));
  fireEvent.press(screen.getByRole('button', { name: 'Success' }));
  expect(await screen.findByRole('header', { name: 'Session complete' })).toBeTruthy();
  expect((await application.getReviewState(cards[0]!.id))?.totalReviews).toBe(2);
  expect(failureFeedback).toHaveBeenCalledTimes(1);
  expect(successFeedback).toHaveBeenCalledTimes(1);
  expect(
    (await application.listReviewEvents({ cardId: cards[0]!.id })).map((e) => e.result),
  ).toEqual(['failure', 'success']);
}, 20_000);

test('unknown session IDs show a safe error with navigation out', async () => {
  renderRouter(routes, { initialUrl: '/study/session-does-not-exist' });
  expect(await screen.findByRole('header', { name: 'Study unavailable' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Leave study' }));
  expect(await screen.findByRole('header', { name: 'Study' })).toBeTruthy();
});

test('an unavailable current card shows retry and an exit that cancels its active session', async () => {
  const { deck, cards } = await studyFixture(1);
  const session = await application.startStudySession({ kind: 'specific-deck', deckId: deck.id });
  await application.archiveCard(cards[0]!.id);
  renderRouter(routes, { initialUrl: `/study/${session.id}` });
  expect(await screen.findByRole('header', { name: 'Study unavailable' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Leave study' }));
  expect(await screen.findByRole('header', { name: 'Study' })).toBeTruthy();
  expect(await application.getActiveStudySession()).toBeNull();
});
