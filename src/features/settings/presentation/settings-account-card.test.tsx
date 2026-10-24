import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { UserRound } from 'lucide-react-native';
import { syncEngine } from '@/core/composition/sync';
import type { StorageState } from '@/core/storage/local-storage-scopes';
import type { AccountProfile } from '@/core/sync/cloud-client';
import { CloudError } from '@/core/sync/cloud-client';
import type { BackupMetadata, BackupOverview } from '@/core/sync/server-backup';
import { useLocalization } from '@/shared/localization/localization-provider';
import {
  formatNumber,
  resolveDirection,
  translate,
  type UiLanguage,
} from '@/shared/localization/localization';
import { StyleSheet } from 'react-native';
import { SettingsAccountCard } from './settings-account-card';
import { LearningAccessController, serverEntitlementCache } from '@/core/access/learning-access';
import type { Entitlements, CurrentSubscription } from '@/core/sync/subscription';
import * as theme from '@/shared/theme/theme-provider';
import { icons, palette, spacing } from '@/shared/theme/tokens';

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
] as const)('Settings opens the same Plus Paywall for %s in %s', async (mode, language) => {
  setLanguage(language);
  mockState = {
    phase: 'ready',
    mode,
    userId: mode === 'account' ? account.id : null,
    revision: 1,
  };
  render(<SettingsAccountCard />);
  if (mode === 'account') await screen.findByText(account.displayName);
  fireEvent.press(
    screen.getByRole('button', { name: translate(language, 'settings.upgradePlus') }),
  );
  expect(screen.queryByRole('button', { name: translate(language, 'access.plans') })).toBeNull();
  expect(router.push).toHaveBeenCalledWith('/settings/subscription');
});

test.each(['en', 'fa'] as const)(
  'guest sign-in remains visible with cloud unavailable in %s',
  (language) => {
    setLanguage(language);
    Object.defineProperty(engine, 'available', { configurable: true, value: false });
    render(<SettingsAccountCard />);
    fireEvent.press(
      screen.getByRole('button', { name: translate(language, 'account.loginSignup') }),
    );
    expect(router.push).toHaveBeenCalledWith('/auth');
    expect(engine.accountProfile).not.toHaveBeenCalled();
    expect(screen.getByText(translate(language, 'settings.accountSubtitle'))).toBeTruthy();
  },
);

test('authenticated account shows its username and mobile instead of sign-in', async () => {
  mockState = { phase: 'ready', mode: 'account', userId: account.id, revision: 1 };
  render(<SettingsAccountCard />);
  expect(await screen.findByText(account.displayName)).toBeTruthy();
  expect(screen.getByText('•••• ••67')).toBeTruthy();
  expect(screen.queryByText(account.phoneNumber!)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Log In / Sign Up' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Cloud sync' }));
  expect(router.push).toHaveBeenCalledWith('/settings/cloud');
  fireEvent.press(screen.getByRole('button', { name: 'Log Out' }));
  expect(router.push).toHaveBeenCalledWith('/settings/logout');
});

test.each(['en', 'fa'] as const)(
  'account settings does not offer a manual guest-data transfer in %s',
  async (language) => {
    setLanguage(language);
    mockState = { phase: 'ready', mode: 'account', userId: account.id, revision: 1 };
    render(<SettingsAccountCard />);
    await screen.findByText(account.displayName);
    expect(screen.queryByRole('button', { name: translate(language, 'migration.title') })).toBeNull();
    expect(screen.getByRole('button', { name: translate(language, 'sync.title') })).toBeTruthy();
    expect(screen.getByRole('button', { name: translate(language, 'account.logout') })).toBeTruthy();
  },
);

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
  expect(await screen.findByText(translate('en', 'account.error'))).toBeTruthy();
  expect(screen.getByText('Account status: Signed in')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Log In / Sign Up' })).toBeNull();
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
  expect(screen.getByRole('button', { name: 'Log In / Sign Up' })).toBeTruthy();
  expect(screen.queryByText(account.displayName)).toBeNull();
  expect(screen.queryByText(account.phoneNumber!)).toBeNull();
  expect(screen.queryByText('Account: account-a')).toBeNull();
});

test('a profile for another owner is not displayed', async () => {
  mockState = { phase: 'ready', mode: 'account', userId: 'account-b', revision: 1 };
  render(<SettingsAccountCard />);
  await waitFor(() => expect(engine.accountProfile).toHaveBeenCalledTimes(1));
  expect(await screen.findByText(translate('en', 'account.error'))).toBeTruthy();
  expect(screen.queryByText(account.displayName)).toBeNull();
});

test('storage switching hides account information until the next scope is ready', async () => {
  mockState = { phase: 'ready', mode: 'account', userId: account.id, revision: 1 };
  render(<SettingsAccountCard />);
  await screen.findByText(account.displayName);
  update({ ...mockState, phase: 'loading', revision: 2 });
  expect(screen.queryByText(account.displayName)).toBeNull();
  expect(screen.queryByText(account.phoneNumber!)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Log In / Sign Up' })).toBeNull();
  update({ phase: 'ready', mode: 'guest', userId: null, revision: 2 });
  expect(screen.getByRole('button', { name: 'Log In / Sign Up' })).toBeTruthy();
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

const completedAtUtc = new Date().toISOString();
const backup: BackupMetadata = {
  id: '11111111-1111-1111-1111-111111111111',
  status: 'Completed',
  formatVersion: 1,
  createdAtUtc: completedAtUtc,
  completedAtUtc,
  expiresAtUtc: new Date(Date.parse(completedAtUtc) + 7 * 86_400_000).toISOString(),
  retentionDays: 7,
  syncVersion: 4,
  sizeBytes: 1000,
  failureCode: null,
  isExpired: false,
  canRestore: false,
};

function authenticated() {
  mockState = { phase: 'ready', mode: 'account', userId: account.id, revision: 1 };
  return render(<SettingsAccountCard />);
}

function subscriptionState(active: boolean, overLimit = false): CurrentSubscription {
  const now = Date.now();
  const startsAtUtc = new Date(now - 86400000).toISOString();
  const expiresAtUtc = new Date(now + (active ? 86400000 : -1000)).toISOString();
  const entitlements: Entitlements = {
    ...free(),
    currentPlan: active ? 'Plus' : 'Free',
    isActive: active,
    startsAtUtc,
    expiresAtUtc,
    features: { unlimitedDecks: active, unlimitedCards: active },
    limits: active ? { decks: null, cards: null } : { decks: 1, cards: 50 },
    withinFreeTierLimits: !overLimit,
    usage: overLimit ? { decks: 2, cards: 51 } : { decks: 1, cards: 50 },
  };
  return {
    entitlements,
    subscription: {
      id: '11111111-1111-1111-1111-111111111111',
      plan: 'Plus',
      storedStatus: 'Active',
      status: active ? 'Active' : 'Expired',
      startsAtUtc,
      expiresAtUtc,
      createdAtUtc: startsAtUtc,
      updatedAtUtc: startsAtUtc,
    },
  };
}

test.each([
  ['en', 'light', false],
  ['fa', 'light', false],
  ['en', 'dark', false],
  ['fa', 'dark', false],
  ['en', 'light', true],
  ['fa', 'light', true],
  ['en', 'dark', true],
  ['fa', 'dark', true],
] as const)(
  'inline status and benefits respect %s / %s with active Plus %s',
  async (language, mode, active) => {
    setLanguage(language);
    jest.spyOn(theme, 'useThemeColors').mockReturnValue(palette[mode]);
    const current = active ? subscriptionState(true) : { subscription: null, entitlements: free() };
    setAccess(current.entitlements);
    jest.mocked(engine.subscription).mockResolvedValue(current);
    authenticated();
    const currentAccess = translate(language, 'access.current', {
      plan: translate(language, active ? 'paywall.plusPlan' : 'account.freePlan'),
    });
    await screen.findByLabelText(currentAccess);
    const card = within(screen.getByTestId('settings-subscription-card'));
    const heading = card.getByRole('header', {
      name: translate(language, 'settings.subscription.title'),
    });
    expect(heading).toHaveStyle({ writingDirection: resolveDirection(language) });
    expect(heading.props.allowFontScaling).toBe(true);
    expect(screen.getByTestId('settings-subscription-card')).toHaveStyle({
      backgroundColor: palette[mode].surface,
    });
    expect(screen.getByTestId('settings-subscription-benefits')).toHaveStyle({
      backgroundColor: palette[mode].primarySoft,
    });
    for (const [key, count] of [
      ['paywall.freeDecks', 1],
      ['paywall.freeCards', 50],
    ] as const) {
      const label = translate(language, key, { count: formatNumber(count, language) });
      if (active) expect(card.queryByText(label)).toBeNull();
      else expect(card.getByText(label)).toBeTruthy();
    }
    if (!active) {
      expect(card.queryByText(/Subscription start|شروع اشتراک/)).toBeNull();
      expect(card.queryByText(/Subscription expiration|انقضای اشتراک/)).toBeNull();
    }
    for (const key of [
      'settings.subscription.plusSubtitle',
      'settings.subscription.unlimited',
      'settings.subscription.study',
      'settings.subscription.purchaseUnavailable',
      'settings.subscription.purchaseNotice',
    ] as const) {
      expect(card.getByText(translate(language, key))).toBeTruthy();
    }
    const benefit = card.getByText(translate(language, 'settings.subscription.unlimited'));
    expect(benefit).toHaveStyle({ writingDirection: resolveDirection(language) });
    let row = benefit.parent;
    while (row && !row.props.className?.includes('items-start')) row = row.parent;
    expect(row?.props.className.split(' ')).toContain(
      language === 'fa' ? 'flex-row-reverse' : 'flex-row',
    );
    expect(card.getAllByRole('button')).toHaveLength(2);
    expect(card.getByRole('button', { name: translate(language, 'access.refresh') })).toBeEnabled();
    fireEvent.press(
      card.getByRole('button', { name: translate(language, 'settings.upgradePlus') }),
    );
    expect(router.push).toHaveBeenCalledWith('/settings/subscription');
    expect(engine.subscription).toHaveBeenCalledTimes(1);
  },
);

test('inline loading never confirms Free or Plus and preserves upgrade navigation', async () => {
  jest.mocked(engine.subscription).mockReturnValue(new Promise(() => {}));
  authenticated();
  await waitFor(() => expect(engine.subscription).toHaveBeenCalledTimes(1));
  const card = within(screen.getByTestId('settings-subscription-card'));
  expect(card.getByRole('progressbar', { name: translate('en', 'access.refresh') })).toBeTruthy();
  expect(card.getByText('Subscription status: Unconfirmed')).toBeTruthy();
  for (const plan of ['account.freePlan', 'paywall.plusPlan'] as const) {
    expect(
      card.queryByLabelText(translate('en', 'access.current', { plan: translate('en', plan) })),
    ).toBeNull();
  }
  const refresh = card.getByRole('button', { name: translate('en', 'access.refresh') });
  expect(refresh).toBeDisabled();
  expect(refresh.props.accessibilityState.busy).toBe(true);
  fireEvent.press(refresh);
  expect(engine.subscription).toHaveBeenCalledTimes(1);
  fireEvent.press(card.getByRole('button', { name: translate('en', 'settings.upgradePlus') }));
  expect(router.push).toHaveBeenCalledWith('/settings/subscription');
});

test.each(['Cancelled', 'Scheduled', 'Unavailable'] as const)(
  'inline status preserves %s metadata without implying active Plus',
  async (status) => {
    const previous = subscriptionState(false);
    const now = Date.now();
    const startsAtUtc = new Date(
      now + (status === 'Scheduled' ? 86400000 : -86400000),
    ).toISOString();
    const expiresAtUtc = new Date(now + 2 * 86400000).toISOString();
    const current: CurrentSubscription = {
      entitlements: { ...previous.entitlements, startsAtUtc, expiresAtUtc },
      subscription: {
        ...previous.subscription!,
        plan: status === 'Unavailable' ? 'Full' : 'Plus',
        storedStatus: status === 'Cancelled' ? 'Cancelled' : 'Active',
        status,
        startsAtUtc,
        expiresAtUtc,
      },
    };
    setAccess(current.entitlements);
    jest.mocked(engine.subscription).mockResolvedValue(current);
    authenticated();
    await screen.findByText(
      translate('en', 'paywall.status', { status: translate('en', `paywall.status.${status}`) }),
    );
    expect(
      screen.getByLabelText(
        translate('en', 'access.current', { plan: translate('en', 'account.freePlan') }),
      ),
    ).toBeTruthy();
    expect(screen.queryByText(translate('en', 'account.activePurchaseBlocked'))).toBeNull();
    expect(screen.queryByText(translate('en', 'paywall.expired'))).toBeNull();
    expect(
      screen.getByText(
        translate('en', 'access.expires', {
          time: new Date(expiresAtUtc).toLocaleString('en-US'),
        }),
      ),
    ).toBeTruthy();
  },
);

test.each([
  ['en', false],
  ['fa', false],
  ['en', true],
  ['fa', true],
] as const)('confirmed access can be refreshed in %s (Plus %s)', async (language, active) => {
  setLanguage(language);
  const current = active ? subscriptionState(true) : { subscription: null, entitlements: free() };
  setAccess(current.entitlements);
  const refreshAccess = jest.spyOn(mockAccess, 'refresh');
  jest.mocked(engine.subscription).mockResolvedValue(current);
  authenticated();
  const currentAccess = translate(language, 'access.current', {
    plan: translate(language, active ? 'paywall.plusPlan' : 'account.freePlan'),
  });
  await screen.findByLabelText(currentAccess);
  const card = within(screen.getByTestId('settings-subscription-card'));
  const refresh = card.getByRole('button', { name: translate(language, 'access.refresh') });
  expect(refresh).toBeEnabled();
  expect(refresh.props.className.split(' ')).toEqual(
    expect.arrayContaining(['min-h-button', 'bg-surface', 'border-border']),
  );
  let complete!: (value: CurrentSubscription) => void;
  jest.mocked(engine.subscription).mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  fireEvent.press(refresh);
  await waitFor(() => expect(engine.subscription).toHaveBeenCalledTimes(2));
  const pendingRefresh = card.getByRole('button', {
    name: translate(language, 'access.refresh'),
  });
  expect(pendingRefresh).toBeDisabled();
  expect(pendingRefresh.props.accessibilityState.busy).toBe(true);
  expect(card.queryByLabelText(currentAccess)).toBeNull();
  fireEvent.press(pendingRefresh);
  expect(refreshAccess).toHaveBeenCalledTimes(2);
  expect(engine.subscription).toHaveBeenCalledTimes(2);
  await act(async () => complete(current));
  await screen.findByLabelText(currentAccess);
  expect(card.getByRole('button', { name: translate(language, 'access.refresh') })).toBeEnabled();
  expect(engine.accountProfile).toHaveBeenCalledTimes(1);
  expect(engine.backupStatus).toHaveBeenCalledTimes(1);
});

test.each(['en', 'fa'] as const)(
  'invalid entitlement dates remain unconfirmed and are never displayed in %s',
  async (language) => {
    setLanguage(language);
    const current = subscriptionState(true);
    setAccess({ ...current.entitlements, startsAtUtc: 'invalid', expiresAtUtc: 'invalid' });
    jest.mocked(engine.subscription).mockResolvedValue(current);
    authenticated();
    await screen.findByText(translate(language, 'account.subscriptionUnknown'));
    const card = within(screen.getByTestId('settings-subscription-card'));
    expect(card.queryByText(/Invalid Date|Subscription start|Subscription expiration/)).toBeNull();
    for (const plan of ['account.freePlan', 'paywall.plusPlan'] as const) {
      expect(
        card.queryByLabelText(
          translate(language, 'access.current', { plan: translate(language, plan) }),
        ),
      ).toBeNull();
    }
  },
);

test.each([
  ['en', 'light'],
  ['fa', 'light'],
  ['en', 'dark'],
  ['fa', 'dark'],
] as const)(
  'compact guest card preserves theme, direction, actions and account isolation in %s / %s',
  (language, mode) => {
    setLanguage(language);
    jest.spyOn(theme, 'useThemeColors').mockReturnValue(palette[mode]);
    render(<SettingsAccountCard />);
    const card = screen.getByTestId('settings-account-card');
    expect(card).toHaveStyle({ backgroundColor: palette[mode].surface, padding: spacing.lg });
    expect(card.props.className.split(' ')).toContain('border-border');
    const heading = screen.getByRole('header', { name: translate(language, 'settings.account') });
    const subtitle = screen.getByText(translate(language, 'settings.accountSubtitle'));
    for (const text of [heading, subtitle]) {
      expect(text).toHaveStyle({
        writingDirection: resolveDirection(language),
        textAlign: language === 'fa' ? 'right' : 'left',
      });
      expect(text.props.allowFontScaling).toBe(true);
      expect(text.props.numberOfLines).toBeUndefined();
    }
    expect(subtitle.props.className.split(' ')).toEqual(
      expect.arrayContaining(['text-bodySmall', 'text-secondaryText']),
    );
    const icon = screen.UNSAFE_getByType(UserRound);
    expect(icon.props).toMatchObject({ size: icons.medium, color: palette[mode].secondaryText });
    let header = icon.parent;
    while (header && !header.props.className?.includes('items-center')) header = header.parent;
    expect(header?.props.className.split(' ')).toContain(
      language === 'fa' ? 'flex-row-reverse' : 'flex-row',
    );
    const login = screen.getByRole('button', { name: translate(language, 'account.loginSignup') });
    const upgrade = screen.getByRole('button', {
      name: translate(language, 'settings.upgradePlus'),
    });
    expect(screen.getAllByRole('button')).toEqual([login, upgrade]);
    expect(login.props.className.split(' ')).toEqual(
      expect.arrayContaining(['min-h-button', 'bg-primary', 'border-primary']),
    );
    expect(upgrade.props.className.split(' ')).toEqual(
      expect.arrayContaining(['min-h-button', 'bg-surface', 'border-border']),
    );
    let actions = login.parent;
    while (actions && actions.props.className !== 'gap-sm') actions = actions.parent;
    expect(actions).not.toBeNull();
    expect(within(actions!).getAllByRole('button')).toEqual([login, upgrade]);
    fireEvent.press(login);
    fireEvent.press(upgrade);
    expect(jest.mocked(router.push).mock.calls).toEqual([['/auth'], ['/settings/subscription']]);
    expect(screen.queryByText(translate(language, 'guest.mode'))).toBeNull();
    expect(screen.queryByText(translate(language, 'account.guestLocal'))).toBeNull();
    expect(screen.queryByTestId('settings-subscription-card')).toBeNull();
    expect(screen.queryByTestId('settings-backup-card')).toBeNull();
    expect(engine.subscription).not.toHaveBeenCalled();
    expect(engine.backupStatus).not.toHaveBeenCalled();
  },
);

test.each(['en', 'fa'] as const)(
  'active subscription, masked phone and localized dates in %s',
  async (language) => {
    setLanguage(language);
    const current = subscriptionState(true);
    setAccess(current.entitlements);
    jest.mocked(engine.subscription).mockResolvedValue(current);
    authenticated();
    await screen.findByText(
      translate(language, 'paywall.status', { status: translate(language, 'paywall.active') }),
    );
    expect(screen.getByText(translate(language, 'account.activePurchaseBlocked'))).toBeTruthy();
    expect(screen.getByText('•••• ••67')).toBeTruthy();
    expect(screen.queryByText(account.phoneNumber!)).toBeNull();
    expect(
      screen.getByText(
        translate(language, 'account.starts', {
          time: new Date(current.subscription!.startsAtUtc).toLocaleString(
            language === 'fa' ? 'fa-IR' : 'en-US',
          ),
        }),
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        translate(language, 'access.expires', {
          time: new Date(current.subscription!.expiresAtUtc).toLocaleString(
            language === 'fa' ? 'fa-IR' : 'en-US',
          ),
        }),
      ),
    ).toBeTruthy();
    expect(
      StyleSheet.flatten(
        screen.getByText(translate(language, 'settings.subscription.title')).props.style,
      ),
    ).toMatchObject({ writingDirection: resolveDirection(language) });
    expect(engine.subscription).toHaveBeenCalledTimes(1);
  },
);

test.each([false, true])(
  'expired subscription preserves the free/over-limit access explanation (%s)',
  async (overLimit) => {
    const current = subscriptionState(false, overLimit);
    setAccess(current.entitlements);
    jest.mocked(engine.subscription).mockResolvedValue(current);
    authenticated();
    await screen.findByText('Subscription status: Expired');
    expect(screen.getByText(translate('en', 'paywall.expired'))).toBeTruthy();
    expect(
      screen.getByText(
        translate('en', overLimit ? 'access.restricted' : 'settings.subscription.freeAccess'),
      ),
    ).toBeTruthy();
    expect(engine.createBackup).not.toHaveBeenCalled();
  },
);

test('a subscription failure leaves profile and backup available and never exposes internal errors or cached active state', async () => {
  const current = subscriptionState(true);
  setAccess(current.entitlements);
  const refresh = jest.spyOn(mockAccess, 'refresh');
  jest.mocked(engine.subscription).mockRejectedValue(new Error('secret connection details'));
  jest.mocked(engine.backupStatus).mockResolvedValue({ latest: backup, lastSuccessful: backup });
  authenticated();
  await screen.findByText(translate('en', 'account.subscriptionUnknown'));
  expect(screen.getByText('Subscription status: Unconfirmed')).toBeTruthy();
  expect(screen.getByText(account.displayName)).toBeTruthy();
  expect(screen.getByText('Backup completed')).toBeTruthy();
  expect(screen.queryByText('Subscription status: Plus active')).toBeNull();
  expect(screen.queryByText('secret connection details')).toBeNull();
  expect(refresh).toHaveBeenCalledTimes(1);
  let finish!: (value: CurrentSubscription) => void;
  jest.mocked(engine.subscription).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  fireEvent.press(screen.getByRole('button', { name: 'Refresh access' }));
  await waitFor(() => expect(engine.subscription).toHaveBeenCalledTimes(2));
  const card = within(screen.getByTestId('settings-subscription-card'));
  expect(refresh).toHaveBeenCalledTimes(2);
  expect(card.getByRole('progressbar', { name: 'Refresh access' })).toBeTruthy();
  expect(card.getByRole('button', { name: 'Refresh access' })).toBeDisabled();
  expect(card.getByText('Subscription status: Unconfirmed')).toBeTruthy();
  await act(async () => finish(current));
  await screen.findByText('Subscription status: Plus active');
  expect(engine.backupStatus).toHaveBeenCalledTimes(1);
  expect(engine.accountProfile).toHaveBeenCalledTimes(1);
});

test('backup failure is independent of subscription and profile; account failure has its own retry', async () => {
  const current = subscriptionState(true);
  setAccess(current.entitlements);
  jest.mocked(engine.subscription).mockResolvedValue(current);
  jest.mocked(engine.accountProfile).mockRejectedValueOnce(new Error('private server error'));
  jest.mocked(engine.backupStatus).mockRejectedValue(new CloudError(503));
  authenticated();
  await screen.findByText(translate('en', 'account.error'));
  await screen.findByText('Subscription status: Plus active');
  expect(screen.queryByText(translate('en', 'backup.unavailable'))).toBeNull();
  expect(screen.queryByText('private server error')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Refresh account details' }));
  expect(await screen.findByText(translate('en', 'backup.unavailable'))).toBeTruthy();
  expect(screen.getAllByTestId('feedback-modal')).toHaveLength(1);
  await screen.findByText(account.displayName);
  expect(engine.subscription).toHaveBeenCalledTimes(1);
  expect(engine.backupStatus).toHaveBeenCalledTimes(1);
});

test.each([false, true])('offline cached access is never confirmed (Plus %s)', async (active) => {
  const current = active ? subscriptionState(true) : { subscription: null, entitlements: free() };
  mockAccess = new LearningAccessController({
    userId: 'owner',
    usage: async () => current.entitlements.usage,
    online: async () => false,
    readCache: async () => serverEntitlementCache(current.entitlements, Date.now()),
  });
  jest.mocked(engine.subscription).mockResolvedValue(current);
  authenticated();
  await screen.findByText(translate('en', 'account.subscriptionUnknown'));
  expect(screen.queryByText('Subscription status: Plus active')).toBeNull();
  expect(screen.getByText('Subscription status: Unconfirmed')).toBeTruthy();
  const card = within(screen.getByTestId('settings-subscription-card'));
  for (const plan of ['account.freePlan', 'paywall.plusPlan'] as const) {
    expect(
      card.queryByLabelText(translate('en', 'access.current', { plan: translate('en', plan) })),
    ).toBeNull();
  }
  expect(card.queryByText(/Subscription start|Subscription expiration/)).toBeNull();
});

test('current entitlement invalidation immediately hides subscription details without affecting backups', async () => {
  const current = subscriptionState(true);
  setAccess(current.entitlements);
  jest.mocked(engine.subscription).mockResolvedValue(current);
  authenticated();
  await screen.findByText('Subscription status: Plus active');
  await act(async () => {
    await mockAccess.invalidate('Refresh account permissions');
  });
  expect(screen.getByText('Subscription status: Unconfirmed')).toBeTruthy();
  expect(screen.queryByText(translate('en', 'account.activePurchaseBlocked'))).toBeNull();
  expect(screen.getByTestId('settings-backup-card')).toBeTruthy();
});

test('switching accounts ignores a late subscription response and removes all previous subscription metadata', async () => {
  const current = subscriptionState(true);
  let complete!: (value: CurrentSubscription) => void;
  jest.mocked(engine.subscription).mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  authenticated();
  await waitFor(() => expect(engine.subscription).toHaveBeenCalledTimes(1));
  setAccess();
  jest
    .mocked(engine.accountProfile)
    .mockResolvedValue({ ...account, id: 'account-b', displayName: 'Other Student' });
  update({ phase: 'ready', mode: 'account', userId: 'account-b', revision: 2 });
  await act(async () => {
    complete(current);
  });
  await screen.findByText('Other Student');
  await screen.findByText('Subscription status: Free account — no subscription');
  expect(screen.queryByText('Subscription status: Plus active')).toBeNull();
  expect(engine.subscription).toHaveBeenCalledTimes(2);
});

test('Settings loads owned backup metadata once and shows local timestamps and remaining retention', async () => {
  jest.mocked(engine.backupStatus).mockResolvedValue({ latest: backup, lastSuccessful: backup });
  authenticated();
  expect(await screen.findByText('Backup completed')).toBeTruthy();
  expect(
    screen.getByText(
      `Last successful backup: ${new Date(completedAtUtc).toLocaleString('en')} (local time)`,
    ),
  ).toBeTruthy();
  expect(
    screen.getByText(`Expires: ${new Date(backup.expiresAtUtc).toLocaleString('en')} (local time)`),
  ).toBeTruthy();
  expect(screen.getByText(/Retention remaining: up to/)).toBeTruthy();
  expect(engine.backupStatus).toHaveBeenCalledTimes(1);
  expect(engine.createBackup).not.toHaveBeenCalled();
});

test.each(['en', 'fa'] as const)(
  'empty backup status and manual action are localized in %s',
  async (language) => {
    setLanguage(language);
    authenticated();
    await screen.findByText(translate(language, 'backup.never'));
    expect(screen.getByRole('button', { name: translate(language, 'backup.now') })).toBeTruthy();
  },
);

test('manual backup waits for backend verification, blocks duplicates and refreshes status', async () => {
  let finish!: (value: Awaited<ReturnType<typeof engine.createBackup>>) => void;
  jest.mocked(engine.createBackup).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  authenticated();
  await screen.findByText('Never backed up');
  fireEvent.press(screen.getByRole('button', { name: 'Back Up Now' }));
  fireEvent.press(screen.getByRole('button', { name: 'Back Up Now' }));
  expect(engine.createBackup).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Backup in progress')).toBeTruthy();
  expect(screen.queryByText('The server confirmed and verified the backup.')).toBeNull();
  jest.mocked(engine.backupStatus).mockResolvedValue({ latest: backup, lastSuccessful: backup });
  await act(async () => finish(backup as Awaited<ReturnType<typeof engine.createBackup>>));
  await screen.findByText('The server confirmed and verified the backup.');
  expect(screen.getByText('Backup completed')).toBeTruthy();
  expect(engine.backupStatus).toHaveBeenCalledTimes(2);
});

test('failed manual backup preserves the last successful metadata and can be retried', async () => {
  jest.mocked(engine.backupStatus).mockResolvedValue({ latest: backup, lastSuccessful: backup });
  jest.mocked(engine.createBackup).mockRejectedValueOnce(new CloudError(0));
  authenticated();
  await screen.findByText('Backup completed');
  fireEvent.press(screen.getByRole('button', { name: 'Back Up Now' }));
  await screen.findByText('Backup failed');
  expect(screen.getByText(/The server cannot be reached/)).toBeTruthy();
  expect(screen.getByText(/Last successful backup:/)).toBeTruthy();
  expect(screen.queryByText('The server confirmed and verified the backup.')).toBeNull();
  jest
    .mocked(engine.createBackup)
    .mockResolvedValue(backup as Awaited<ReturnType<typeof engine.createBackup>>);
  fireEvent.press(screen.getByRole('button', { name: 'Back Up Now' }));
  await screen.findByText('The server confirmed and verified the backup.');
  expect(engine.createBackup).toHaveBeenCalledTimes(2);
});

test('backup capacity errors explain the operational cleanup dependency rather than a sync conflict', async () => {
  jest
    .mocked(engine.createBackup)
    .mockRejectedValueOnce(new CloudError(409, undefined, undefined, 'backup_capacity_reached'));
  authenticated();
  await screen.findByText('Never backed up');
  fireEvent.press(screen.getByRole('button', { name: 'Back Up Now' }));
  await screen.findByText(/Stored backup capacity is reached/);
  expect(screen.getByText('Backup failed')).toBeTruthy();
});

test('an explicit status refresh resolves an uncertain failed operation using actual server completion', async () => {
  jest.mocked(engine.createBackup).mockRejectedValueOnce(new CloudError(0));
  authenticated();
  await screen.findByText('Never backed up');
  fireEvent.press(screen.getByRole('button', { name: 'Back Up Now' }));
  await screen.findByText('Backup failed');
  jest
    .mocked(engine.backupStatus)
    .mockResolvedValueOnce({ latest: backup, lastSuccessful: backup });
  fireEvent.press(screen.getByRole('button', { name: 'Refresh backup status' }));
  await screen.findByText('Backup completed');
  expect(screen.queryByText('Backup failed')).toBeNull();
  expect(screen.queryByText('The server confirmed and verified the backup.')).toBeNull();
  expect(engine.createBackup).toHaveBeenCalledTimes(1);
});

test.each([
  [0, 'backup.networkError'],
  [401, 'backup.authError'],
  [429, 'backup.rateError'],
  [503, 'backup.unavailable'],
  [413, 'backup.sizeError'],
] as const)(
  'status failure %s is unconfirmed with an actionable error and refresh',
  async (status, key) => {
    jest.mocked(engine.backupStatus).mockRejectedValueOnce(new CloudError(status));
    authenticated();
    await screen.findByText(translate('en', key));
    expect(screen.getByText('Server backup status is unconfirmed.')).toBeTruthy();
    expect(screen.queryByText('Never backed up')).toBeNull();
    expect(screen.queryByText('Backup completed')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Refresh backup status' }));
    await screen.findByText('Never backed up');
    expect(engine.backupStatus).toHaveBeenCalledTimes(2);
  },
);

test('expired latest backup is not reported as a retained completed backup', async () => {
  const expired = {
    ...backup,
    status: 'Expired' as const,
    isExpired: true,
    createdAtUtc: '2020-01-01T00:00:00Z',
    completedAtUtc: '2020-01-01T00:00:00Z',
    expiresAtUtc: '2020-01-08T00:00:00Z',
  };
  jest.mocked(engine.backupStatus).mockResolvedValue({ latest: expired, lastSuccessful: null });
  authenticated();
  await waitFor(() =>
    expect(screen.getAllByText('Backup expired — create a new backup.').length).toBeGreaterThan(0),
  );
  expect(screen.queryByText('Backup completed')).toBeNull();
  expect(screen.getByText(/Last successful backup:/)).toBeTruthy();
});

test.each(['Pending', 'Failed'] as const)(
  'backend %s status is displayed without a success claim',
  async (status) => {
    jest.mocked(engine.backupStatus).mockResolvedValue({
      latest: {
        ...backup,
        status,
        completedAtUtc: null,
        sizeBytes: null,
        syncVersion: null,
        failureCode: status === 'Failed' ? 'backup_storage_failed' : null,
      },
      lastSuccessful: null,
    });
    authenticated();
    await screen.findByText(status === 'Pending' ? 'Backup in progress' : 'Backup failed');
    expect(screen.queryByText('Backup completed')).toBeNull();
  },
);

test('logout removes backup metadata immediately and ignores a late account response', async () => {
  let finish!: (value: BackupOverview) => void;
  jest.mocked(engine.backupStatus).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  authenticated();
  update({ phase: 'ready', mode: 'guest', userId: null, revision: 2 });
  await act(async () => finish({ latest: backup, lastSuccessful: backup }));
  expect(screen.queryByTestId('settings-backup-card')).toBeNull();
  expect(screen.queryByText(/Last successful backup:/)).toBeNull();
  expect(screen.getByRole('button', { name: 'Log In / Sign Up' })).toBeTruthy();
});

test('switching accounts never reuses the previous backup metadata', async () => {
  jest
    .mocked(engine.backupStatus)
    .mockResolvedValueOnce({ latest: backup, lastSuccessful: backup });
  authenticated();
  await screen.findByText('Backup completed');
  update({ phase: 'ready', mode: 'account', userId: 'account-b', revision: 2 });
  expect(screen.queryByText(/Last successful backup:/)).toBeNull();
  await screen.findByText('Never backed up');
  expect(engine.backupStatus).toHaveBeenCalledTimes(2);
});

test('logout during manual backup ignores its late result and never refreshes metadata as a guest', async () => {
  let finish!: (value: Awaited<ReturnType<typeof engine.createBackup>>) => void;
  jest.mocked(engine.createBackup).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  authenticated();
  await screen.findByText('Never backed up');
  fireEvent.press(screen.getByRole('button', { name: 'Back Up Now' }));
  update({ phase: 'ready', mode: 'guest', userId: null, revision: 2 });
  await act(async () => finish(backup as Awaited<ReturnType<typeof engine.createBackup>>));
  expect(screen.queryByTestId('settings-backup-card')).toBeNull();
  expect(screen.queryByText('The server confirmed and verified the backup.')).toBeNull();
  expect(engine.backupStatus).toHaveBeenCalledTimes(1);
});

test('metadata refresh failure after a verified manual backup does not invent a failed creation', async () => {
  jest
    .mocked(engine.createBackup)
    .mockResolvedValue(backup as Awaited<ReturnType<typeof engine.createBackup>>);
  authenticated();
  await screen.findByText('Never backed up');
  jest.mocked(engine.backupStatus).mockRejectedValueOnce(new CloudError(0));
  fireEvent.press(screen.getByRole('button', { name: 'Back Up Now' }));
  await screen.findByText('The server confirmed and verified the backup.');
  expect(screen.getByText('Backup completed')).toBeTruthy();
  expect(screen.queryByText(/The server cannot be reached/)).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  expect(await screen.findByText(/The server cannot be reached/)).toBeTruthy();
  expect(screen.getAllByTestId('feedback-modal')).toHaveLength(1);
});
