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
    updateAccountName: jest.fn(),
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
    .mocked(engine.updateAccountName)
    .mockReset()
    .mockImplementation(async (displayName) => ({ ...account, displayName }));
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
  const purchaseLoginHint = screen.queryByText(translate(language, 'account.purchaseLoginHint'));
  if (mode === 'guest') {
    expect(purchaseLoginHint).toBeTruthy();
    expect(purchaseLoginHint).toHaveStyle({ writingDirection: resolveDirection(language) });
    expect(
      screen.queryByRole('button', { name: translate(language, 'account.editName') }),
    ).toBeNull();
  } else {
    expect(purchaseLoginHint).toBeNull();
  }
  const subscription = screen.getByRole('button', {
    name: translate(language, 'subscription.title'),
  });
  expect(subscription.props.className.split(' ')).toContain('bg-surface');
  fireEvent.press(subscription);
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
  const subscription = await screen.findByRole('button', { name: label });
  expect(subscription.props.className.split(' ')).toContain('bg-primary');
  fireEvent.press(subscription);
  expect(router.push).toHaveBeenCalledWith('/settings/subscription');
  expect(screen.getAllByRole('button')).toHaveLength(3);
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
  expect(screen.getByText(account.displayName)).toBeTruthy();
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
    expect(screen.getByText(translate(language, 'account.purchaseLoginHint'))).toBeTruthy();
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
  expect(screen.getByText(account.displayName)).toBeTruthy();
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
    expect(
      screen.getByRole('button', { name: 'Subscription' }).props.className.split(' '),
    ).toContain('bg-surface');
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
  expect(screen.getByRole('button', { name: 'Subscription' }).props.className.split(' ')).toContain(
    'bg-surface',
  );
});

test.each(['en', 'fa'] as const)(
  'account names can be edited and saved in %s',
  async (language) => {
    setLanguage(language);
    mockState = { phase: 'ready', mode: 'account', userId: account.id, revision: 1 };
    render(<SettingsAccountCard />);
    await screen.findByText(account.displayName);
    fireEvent.press(screen.getByRole('button', { name: translate(language, 'account.editName') }));
    const input = screen.getByLabelText(translate(language, 'onboarding.nameLabel'));
    expect(input.props.value).toBe(account.displayName);
    expect(input.props.maxLength).toBe(120);
    const name = language === 'fa' ? 'سارا' : 'Sara';
    fireEvent.changeText(input, `  ${name}  `);
    fireEvent.press(screen.getByRole('button', { name: translate(language, 'account.saveName') }));
    await screen.findByText(name);
    expect(engine.updateAccountName).toHaveBeenCalledWith(name);
    expect(screen.queryByLabelText(translate(language, 'onboarding.nameLabel'))).toBeNull();
    expect(screen.getByText(account.phoneNumber!)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: translate(language, 'account.editName') }));
    expect(screen.getByLabelText(translate(language, 'onboarding.nameLabel')).props.value).toBe(
      name,
    );
  },
);

test('cancelling name edits discards the draft without updating the backend', async () => {
  mockState = { phase: 'ready', mode: 'account', userId: account.id, revision: 1 };
  render(<SettingsAccountCard />);
  await screen.findByText(account.displayName);
  fireEvent.press(screen.getByRole('button', { name: 'Edit name' }));
  fireEvent.changeText(screen.getByLabelText('Your name'), 'Unsaved name');
  fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByText(account.displayName)).toBeTruthy();
  expect(screen.queryByText('Unsaved name')).toBeNull();
  expect(engine.updateAccountName).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Edit name' }));
  expect(screen.getByLabelText('Your name').props.value).toBe(account.displayName);
});

test.each(['', '   ', 'a'.repeat(121)])('invalid name edits are not saved: %j', async (name) => {
  mockState = { phase: 'ready', mode: 'account', userId: account.id, revision: 1 };
  render(<SettingsAccountCard />);
  await screen.findByText(account.displayName);
  fireEvent.press(screen.getByRole('button', { name: 'Edit name' }));
  fireEvent.changeText(screen.getByLabelText('Your name'), name);
  fireEvent.press(screen.getByRole('button', { name: 'Save name' }));
  expect(screen.getByText(translate('en', 'onboarding.nameInvalid'))).toBeTruthy();
  expect(engine.updateAccountName).not.toHaveBeenCalled();
});

test('failed name edits preserve the draft and allow retry without showing server errors', async () => {
  jest.mocked(engine.updateAccountName).mockRejectedValueOnce(new Error('Private backend error'));
  mockState = { phase: 'ready', mode: 'account', userId: account.id, revision: 1 };
  render(<SettingsAccountCard />);
  await screen.findByText(account.displayName);
  fireEvent.press(screen.getByRole('button', { name: 'Edit name' }));
  fireEvent.changeText(screen.getByLabelText('Your name'), 'Sara');
  fireEvent.press(screen.getByRole('button', { name: 'Save name' }));
  await screen.findByText(translate('en', 'onboarding.nameSaveError'));
  expect(screen.queryByText('Private backend error')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  expect(screen.getByLabelText('Your name').props.value).toBe('Sara');
  fireEvent.press(screen.getByRole('button', { name: 'Save name' }));
  await screen.findByText('Sara');
  expect(engine.updateAccountName).toHaveBeenCalledTimes(2);
});

test.each([
  { ...account, id: 'another-account', displayName: 'Sara' },
  { ...account, displayName: 'Not saved' },
])('name edits reject an unverified profile response: %j', async (response) => {
  jest.mocked(engine.updateAccountName).mockResolvedValue(response);
  mockState = { phase: 'ready', mode: 'account', userId: account.id, revision: 1 };
  render(<SettingsAccountCard />);
  await screen.findByText(account.displayName);
  fireEvent.press(screen.getByRole('button', { name: 'Edit name' }));
  fireEvent.changeText(screen.getByLabelText('Your name'), 'Sara');
  fireEvent.press(screen.getByRole('button', { name: 'Save name' }));
  await screen.findByText(translate('en', 'onboarding.nameSaveError'));
  expect(screen.getByLabelText('Your name').props.value).toBe('Sara');
});

test('pending name saves block duplicate submissions and ignore responses after account switching', async () => {
  let complete!: (value: AccountProfile) => void;
  jest.mocked(engine.updateAccountName).mockReturnValue(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  mockState = { phase: 'ready', mode: 'account', userId: account.id, revision: 1 };
  render(<SettingsAccountCard />);
  await screen.findByText(account.displayName);
  fireEvent.press(screen.getByRole('button', { name: 'Edit name' }));
  const input = screen.getByLabelText('Your name');
  fireEvent.changeText(input, 'Sara');
  const save = screen.getByRole('button', { name: 'Save name' });
  fireEvent.press(save);
  fireEvent.press(save);
  fireEvent(input, 'submitEditing');
  expect(engine.updateAccountName).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Your name')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  const nextAccount = { ...account, id: 'account-b', displayName: 'Another learner' };
  jest.mocked(engine.accountProfile).mockResolvedValue(nextAccount);
  update({ phase: 'ready', mode: 'account', userId: nextAccount.id, revision: 2 });
  await screen.findByText(nextAccount.displayName);
  await act(async () => complete({ ...account, displayName: 'Sara' }));
  expect(screen.queryByText('Sara')).toBeNull();
  expect(screen.queryByTestId('feedback-modal')).toBeNull();
  expect(screen.getByText(nextAccount.displayName)).toBeTruthy();
});
