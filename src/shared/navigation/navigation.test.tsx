import { fireEvent, render } from '@testing-library/react-native';
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
import CardDetails from '@/app/decks/[deckId]/cards/[cardId]/index';
import EditCard from '@/app/decks/[deckId]/cards/[cardId]/edit';
import StudySession from '@/app/study/[sessionId]';
import VocabularyHelper from '@/app/vocabulary/helper';
import Appearance from '@/app/settings/appearance';
import DesignSystem from '@/app/design-system';
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
  fireEvent.press(screen.getByRole('button', { name: 'Open Everyday phrases deck' }));
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

test('appearance selection uses the existing session preference', async () => {
  renderRouter(routes, { initialUrl: '/settings' });
  await screen.findByRole('header', { name: 'Settings' });
  fireEvent.press(screen.getByRole('button', { name: 'Theme, Current: Follow system' }));
  expect(await screen.findByRole('header', { name: 'Appearance' })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'OLED' }));
  expect(useUiStore.getState().themePreference).toBe('oled');
  expect(screen.getByRole('button', { name: 'OLED', selected: true })).toBeTruthy();
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
