import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { syncEngine } from '@/core/composition/sync';
import type { StorageState } from '@/core/storage/local-storage-scopes';
import type { AccountProfile } from '@/core/sync/cloud-client';
import { useLocalization } from '@/shared/localization/localization-provider';
import {
  formatNumber,
  resolveDirection,
  translate,
  type UiLanguage,
} from '@/shared/localization/localization';
import { SettingsAccountCard } from './settings-account-card';

let mockState: StorageState = { phase: 'ready', mode: 'guest', userId: null, revision: 0 };
const mockListeners = new Set<() => void>();
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (effect: () => (() => void) | void) => {
    const react = jest.requireActual<typeof import('react')>('react');
    react.useEffect(effect, [effect]);
  },
}));
jest.mock('@/core/composition/application', () => ({ application: {} }));
jest.mock('@/core/composition/repositories', () => ({
  storageScopes: {
    snapshot: () => mockState,
    subscribe: (listener: () => void) => {
      mockListeners.add(listener);
      return () => mockListeners.delete(listener);
    },
  },
}));
jest.mock('@/core/composition/sync', () => ({
  syncEngine: { available: true, accountProfile: jest.fn() },
}));
jest.mock('@/shared/localization/localization-provider', () => ({ useLocalization: jest.fn() }));

const engine = syncEngine!;
const account: AccountProfile = {
  id: 'account-a',
  displayName: 'Lerona Student',
  phoneNumber: '+989121234567',
  email: null,
};

function setLanguage(language: UiLanguage) {
  jest.mocked(useLocalization).mockReturnValue({
    language,
    direction: resolveDirection(language),
    t: (key, values) => translate(language, key, values),
    number: (value) => formatNumber(value, language),
  });
}

function update(state: StorageState) {
  act(() => {
    mockState = state;
    mockListeners.forEach((listener) => listener());
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockState = { phase: 'ready', mode: 'guest', userId: null, revision: 0 };
  Object.defineProperty(engine, 'available', { configurable: true, value: true });
  jest.mocked(engine.accountProfile).mockReset().mockResolvedValue(account);
  setLanguage('en');
});

test.each(['en', 'fa'] as const)(
  'guest sign-in remains visible with cloud unavailable in %s',
  (language) => {
    setLanguage(language);
    Object.defineProperty(engine, 'available', { configurable: true, value: false });
    render(<SettingsAccountCard />);
    fireEvent.press(screen.getByRole('button', { name: translate(language, 'sync.signIn') }));
    expect(router.push).toHaveBeenCalledWith('/auth');
    expect(engine.accountProfile).not.toHaveBeenCalled();
    expect(screen.getByText(translate(language, 'guest.mode'))).toBeTruthy();
  },
);

test('authenticated account shows its username and mobile instead of sign-in', async () => {
  mockState = { phase: 'ready', mode: 'account', userId: account.id, revision: 1 };
  render(<SettingsAccountCard />);
  expect(await screen.findByText(account.displayName)).toBeTruthy();
  expect(screen.getByText(account.phoneNumber!)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Cloud sync' }));
  expect(router.push).toHaveBeenCalledWith('/settings/cloud');
  fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  expect(router.push).toHaveBeenCalledWith('/settings/logout');
});

test('legacy email accounts display their email address', async () => {
  mockState = { phase: 'ready', mode: 'account', userId: account.id, revision: 1 };
  jest
    .mocked(engine.accountProfile)
    .mockResolvedValue({ ...account, phoneNumber: null, email: 'student@example.test' });
  render(<SettingsAccountCard />);
  expect(await screen.findByText('student@example.test')).toBeTruthy();
});

test('offline profile failure retains authenticated identity without showing a login button', async () => {
  mockState = { phase: 'ready', mode: 'account', userId: account.id, revision: 1 };
  jest.mocked(engine.accountProfile).mockRejectedValue(new Error('Offline'));
  render(<SettingsAccountCard />);
  await waitFor(() => expect(engine.accountProfile).toHaveBeenCalledTimes(1));
  expect(screen.getByText('Account: account-a')).toBeTruthy();
  expect(screen.getByText('You are signed in.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
});

test('guest transition discards account details and ignores a late profile response', async () => {
  let resolveProfile!: (value: AccountProfile) => void;
  jest.mocked(engine.accountProfile).mockReturnValue(
    new Promise((resolve) => {
      resolveProfile = resolve;
    }),
  );
  mockState = { phase: 'ready', mode: 'account', userId: account.id, revision: 1 };
  render(<SettingsAccountCard />);
  update({ phase: 'ready', mode: 'guest', userId: null, revision: 2 });
  await act(async () => {
    resolveProfile(account);
  });
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
  expect(screen.queryByText(account.displayName)).toBeNull();
  expect(screen.queryByText(account.phoneNumber!)).toBeNull();
  expect(screen.queryByText('Account: account-a')).toBeNull();
});

test('a profile for another owner is not displayed', async () => {
  mockState = { phase: 'ready', mode: 'account', userId: 'account-b', revision: 1 };
  render(<SettingsAccountCard />);
  await waitFor(() => expect(engine.accountProfile).toHaveBeenCalledTimes(1));
  expect(screen.getByText('Account: account-b')).toBeTruthy();
  expect(screen.queryByText(account.displayName)).toBeNull();
});

test('storage switching hides account information until the next scope is ready', async () => {
  mockState = { phase: 'ready', mode: 'account', userId: account.id, revision: 1 };
  render(<SettingsAccountCard />);
  await screen.findByText(account.displayName);
  update({ ...mockState, phase: 'loading', revision: 2 });
  expect(screen.queryByText(account.displayName)).toBeNull();
  expect(screen.queryByText(account.phoneNumber!)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Sign in' })).toBeNull();
  update({ phase: 'ready', mode: 'guest', userId: null, revision: 2 });
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
});

test('changing accounts hides the former profile immediately', async () => {
  mockState = { phase: 'ready', mode: 'account', userId: account.id, revision: 1 };
  render(<SettingsAccountCard />);
  await screen.findByText(account.displayName);
  jest.mocked(engine.accountProfile).mockResolvedValue({
    ...account,
    id: 'account-b',
    displayName: 'Other Student',
    phoneNumber: '+989121234568',
  });
  update({ phase: 'ready', mode: 'account', userId: 'account-b', revision: 2 });
  expect(screen.queryByText(account.displayName)).toBeNull();
  expect(await screen.findByText('Other Student')).toBeTruthy();
});
