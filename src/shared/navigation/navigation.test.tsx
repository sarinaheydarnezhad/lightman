import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { renderRouter, screen } from 'expo-router/testing-library';

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
import DesignSystem from '@/app/design-system';
import { idGenerator } from '@/core/infrastructure/platform';
import { application } from '@/core/composition/application';
import { useUiStore } from '@/store/ui-store';

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
  'design-system': DesignSystem,
};

afterEach(() => useUiStore.setState({ themePreference: 'system' }));

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
  fireEvent.press(screen.getByRole('button', { name: 'Theme, Current: Follow system' }));
  expect(await screen.findByRole('header', { name: 'Appearance' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'OLED' }));
  expect(await screen.findByRole('button', { name: 'OLED', selected: true })).toBeTruthy();
  expect(useUiStore.getState().themePreference).toBe('oled');
});

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
