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
import { LearningAccessController, serverEntitlementCache } from '@/core/access/learning-access';
import type { Entitlements } from '@/core/sync/subscription';

let mockAccess: LearningAccessController;
jest.mock('@/core/composition/learning-access', () => ({ learningAccess: () => mockAccess }));

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
  syncEngine: {
    available: true,
    accountProfile: jest.fn(),
    backupStatus: jest.fn(),
    createBackup: jest.fn(),
    subscription: jest.fn(),
  },
}));
jest.mock('@/shared/localization/localization-provider', () => ({ useLocalization: jest.fn() }));

const engine = syncEngine!;
const account: AccountProfile = {
  id: 'account-a',
  displayName: 'Lerona Student',
  phoneNumber: '+989121234567',
  email: null,
};

function free(): Entitlements {
  return {
    currentPlan: 'Free',
    isActive: false,
    startsAtUtc: null,
    expiresAtUtc: null,
    features: { unlimitedDecks: false, unlimitedCards: false },
    limits: { decks: 1, cards: 50 },
    isPurchasable: false,
    purchaseSupported: false,
    withinFreeTierLimits: true,
    usage: { decks: 1, cards: 50 },
    validatedAtUtc: new Date().toISOString(),
  };
}

function setAccess(entitlements = free()) {
  mockAccess = new LearningAccessController({
    userId: 'owner',
    usage: async () => entitlements.usage,
    online: async () => true,
    fetch: async () => entitlements,
  });
  jest.mocked(engine.subscription).mockResolvedValue({ subscription: null, entitlements });
}

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
  jest
    .mocked(engine.backupStatus)
    .mockReset()
    .mockResolvedValue({ latest: null, lastSuccessful: null });
  jest.mocked(engine.createBackup).mockReset();
  setLanguage('en');
  jest.mocked(engine.subscription).mockReset();
  setAccess();
});

afterEach(() => jest.restoreAllMocks());

test.each([
  ['guest', 'en'],
  ['guest', 'fa'],
  ['account', 'en'],
  ['account', 'fa'],
] as const)('Settings opens subscription details for %s in %s', async (mode, language) => {
  setLanguage(language);
  mockState = {
    phase: 'ready',
    mode,
    userId: mode === 'account' ? account.id : null,
    revision: 1,
  };
  render(<SettingsAccountCard />);
  if (mode === 'account') await screen.findByText(account.phoneNumber!);
  fireEvent.press(screen.getByRole('button', { name: translate(language, 'subscription.title') }));
  expect(router.push).toHaveBeenCalledWith('/settings/subscription');
  expect(
    screen.queryByRole('button', { name: translate(language, 'settings.upgradePlus') }),
  ).toBeNull();
  expect(screen.queryByRole('button', { name: translate(language, 'access.refresh') })).toBeNull();
});

test.each(['en', 'fa'] as const)('active Plus settings stays compact in %s', async (language) => {
  setLanguage(language);
  const now = Date.now();
  setAccess({
    ...free(),
    currentPlan: 'Plus',
    isActive: true,
    startsAtUtc: new Date(now - 86400000).toISOString(),
    expiresAtUtc: new Date(now + 86400000).toISOString(),
    features: { unlimitedDecks: true, unlimitedCards: true },
    limits: { decks: null, cards: null },
  });
  mockState = { phase: 'ready', mode: 'account', userId: account.id, revision: 1 };
  render(<SettingsAccountCard />);
  await screen.findByText(account.phoneNumber!);
  const label = translate(language, 'subscription.current', {
    plan: translate(language, 'account.plusPlan'),
  });
  fireEvent.press(await screen.findByRole('button', { name: label }));
  expect(router.push).toHaveBeenCalledWith('/settings/subscription');
  expect(screen.getAllByRole('button')).toHaveLength(2);
  for (const key of [
    'account.signedIn',
    'account.activePurchaseBlocked',
    'settings.accountSubtitle',
    'settings.subscription.title',
    'settings.subscription.unlimited',
    'settings.subscription.purchaseUnavailable',
    'account.subscription',
  ] as const) {
    expect(screen.queryByText(translate(language, key))).toBeNull();
  }
  expect(screen.queryByText(account.displayName)).toBeNull();
  expect(screen.queryByTestId('settings-backup-card')).toBeNull();
  expect(
    screen.queryByRole('button', { name: translate(language, 'settings.upgradePlus') }),
  ).toBeNull();
  expect(screen.queryByRole('button', { name: translate(language, 'access.refresh') })).toBeNull();
  expect(screen.queryByRole('button', { name: translate(language, 'migration.title') })).toBeNull();
  expect(engine.subscription).not.toHaveBeenCalled();
  expect(engine.backupStatus).not.toHaveBeenCalled();
});

test.each(['en', 'fa'] as const)(
  'guest sign-in remains available without cloud in %s',
  (language) => {
    setLanguage(language);
    Object.defineProperty(engine, 'available', { configurable: true, value: false });
    render(<SettingsAccountCard />);
    fireEvent.press(
      screen.getByRole('button', { name: translate(language, 'account.loginSignup') }),
    );
    expect(router.push).toHaveBeenCalledWith('/auth');
    expect(engine.accountProfile).not.toHaveBeenCalled();
  },
);

test('logout remains available from the compact account card', async () => {
  mockState = { phase: 'ready', mode: 'account', userId: account.id, revision: 1 };
  render(<SettingsAccountCard />);
  await screen.findByText(account.phoneNumber!);
  expect(screen.queryByRole('button', { name: 'Log In / Sign Up' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Log Out' }));
  expect(router.push).toHaveBeenCalledWith('/settings/logout');
});

test('legacy accounts show their email when there is no phone', async () => {
  mockState = { phase: 'ready', mode: 'account', userId: account.id, revision: 1 };
  jest.mocked(engine.accountProfile).mockResolvedValue({
    ...account,
    phoneNumber: null,
    email: 'student@example.test',
  });
  render(<SettingsAccountCard />);
  await screen.findByText('student@example.test');
  expect(screen.queryByText(account.displayName)).toBeNull();
});

test('profile failures use a modal and preserve subscription navigation and logout', async () => {
  mockState = { phase: 'ready', mode: 'account', userId: account.id, revision: 1 };
  jest.mocked(engine.accountProfile).mockRejectedValueOnce(new Error('secret connection details'));
  render(<SettingsAccountCard />);
  await screen.findByText(translate('en', 'account.error'));
  expect(screen.getByTestId('feedback-modal')).toBeTruthy();
  expect(screen.queryByText('secret connection details')).toBeNull();
  expect(screen.getByRole('button', { name: 'Subscription' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Log Out' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Log In / Sign Up' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: translate('en', 'account.retry') }));
  await screen.findByText(account.phoneNumber!);
  expect(engine.accountProfile).toHaveBeenCalledTimes(2);
});

test('logout ignores a late account profile response', async () => {
  let complete!: (value: AccountProfile) => void;
  jest.mocked(engine.accountProfile).mockReturnValue(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  mockState = { phase: 'ready', mode: 'account', userId: account.id, revision: 1 };
  render(<SettingsAccountCard />);
  await waitFor(() => expect(engine.accountProfile).toHaveBeenCalledTimes(1));
  update({ phase: 'ready', mode: 'guest', userId: null, revision: 2 });
  await act(async () => complete(account));
  expect(screen.queryByText(account.phoneNumber!)).toBeNull();
  expect(screen.getByRole('button', { name: 'Log In / Sign Up' })).toBeTruthy();
});

test('switching accounts removes the old phone and rejects a foreign profile', async () => {
  mockState = { phase: 'ready', mode: 'account', userId: account.id, revision: 1 };
  render(<SettingsAccountCard />);
  await screen.findByText(account.phoneNumber!);
  update({ phase: 'ready', mode: 'account', userId: 'account-b', revision: 2 });
  expect(screen.queryByText(account.phoneNumber!)).toBeNull();
  await screen.findByText(translate('en', 'account.error'));
  expect(screen.queryByText(account.phoneNumber!)).toBeNull();
});

test('locked account scope shows no previous phone or subscription controls', async () => {
  mockState = { phase: 'ready', mode: 'account', userId: account.id, revision: 1 };
  render(<SettingsAccountCard />);
  await screen.findByText(account.phoneNumber!);
  update({ phase: 'loading', mode: 'account', userId: account.id, revision: 2 });
  expect(screen.queryByText(account.phoneNumber!)).toBeNull();
  expect(screen.queryByRole('button')).toBeNull();
});

test.each([false, true])(
  'offline cache never advertises a confirmed paid plan (Plus %s)',
  async (paid) => {
    const now = Date.now();
    const response: Entitlements = paid
      ? {
          ...free(),
          currentPlan: 'Plus',
          isActive: true,
          startsAtUtc: new Date(now - 1000).toISOString(),
          expiresAtUtc: new Date(now + 86400000).toISOString(),
          features: { unlimitedDecks: true, unlimitedCards: true },
          limits: { decks: null, cards: null },
        }
      : free();
    mockAccess = new LearningAccessController({
      userId: account.id,
      usage: async () => response.usage,
      online: async () => false,
      readCache: async () => serverEntitlementCache(response, now),
    });
    mockState = { phase: 'ready', mode: 'account', userId: account.id, revision: 1 };
    render(<SettingsAccountCard />);
    await screen.findByText(account.phoneNumber!);
    expect(screen.getByRole('button', { name: 'Subscription' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Subscription (Plus)' })).toBeNull();
    expect(screen.queryByTestId('feedback-modal')).toBeNull();
  },
);

test('entitlement invalidation removes the paid label immediately', async () => {
  const now = Date.now();
  setAccess({
    ...free(),
    currentPlan: 'Plus',
    isActive: true,
    startsAtUtc: new Date(now - 1000).toISOString(),
    expiresAtUtc: new Date(now + 86400000).toISOString(),
    features: { unlimitedDecks: true, unlimitedCards: true },
    limits: { decks: null, cards: null },
  });
  mockState = { phase: 'ready', mode: 'account', userId: account.id, revision: 1 };
  render(<SettingsAccountCard />);
  await screen.findByRole('button', { name: 'Subscription (Plus)' });
  await act(async () => mockAccess.invalidate('Account changed'));
  expect(screen.queryByRole('button', { name: 'Subscription (Plus)' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Subscription' })).toBeTruthy();
});
