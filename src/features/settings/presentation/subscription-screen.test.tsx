import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';
import { LearningAccessController, serverEntitlementCache } from '@/core/access/learning-access';
import { syncEngine } from '@/core/composition/sync';
import type { CurrentSubscription, Entitlements, PlanCatalog } from '@/core/sync/subscription';
import { useLocalization } from '@/shared/localization/localization-provider';
import {
  formatNumber,
  resolveDirection,
  translate,
  type UiLanguage,
} from '@/shared/localization/localization';
import { SubscriptionScreen } from './subscription-screen';

let mockAccess: LearningAccessController;
let mockUsage = { decks: 1, cards: 50 };
const mockScope = {
  value: {
    decks: {
      list: async () =>
        Array.from({ length: mockUsage.decks }, (_, index) => ({
          id: String(index),
          archivedAt: null,
        })),
    },
    cards: { countByDeck: async (id: string) => (id === '0' ? mockUsage.cards : 0) },
  },
};
jest.mock('@/core/composition/learning-access', () => ({ learningAccess: () => mockAccess }));
jest.mock('@/core/composition/application', () => ({ application: {} }));
jest.mock('@/core/composition/repositories', () => ({
  storageScopes: {
    current: () => mockScope,
    snapshot: () => ({ revision: 1 }),
    assertCurrent: jest.fn(),
  },
}));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (effect: () => (() => void) | void) => {
    const react = jest.requireActual<typeof import('react')>('react');
    react.useEffect(effect, [effect]);
  },
}));
jest.mock('@/core/composition/sync', () => ({
  syncEngine: {
    available: true,
    planCatalog: jest.fn(),
    subscription: jest.fn(),
  },
}));
jest.mock('@/shared/localization/localization-provider', () => ({ useLocalization: jest.fn() }));

const engine = syncEngine!;
const catalog: PlanCatalog = {
  currency: 'Toman',
  purchaseSupported: false,
  freeLimits: { decks: 1, cards: 50 },
  plans: [
    {
      plan: 'Plus',
      isPurchasable: false,
      unavailableReason: 'payment_provider_not_configured',
      limits: { decks: null, cards: null },
      features: { unlimitedDecks: true, unlimitedCards: true },
      prices: [
        { durationMonths: 1, priceToman: 49000 },
        { durationMonths: 6, priceToman: 279000 },
        { durationMonths: 12, priceToman: 499000 },
      ],
    },
    {
      plan: 'Full',
      isPurchasable: false,
      unavailableReason: 'coming_soon',
      limits: null,
      features: null,
      prices: [],
    },
  ],
};

function entitlements(paid = false): Entitlements {
  const now = Date.now();
  return {
    currentPlan: paid ? 'Plus' : 'Free',
    isActive: paid,
    startsAtUtc: paid ? new Date(now - 1000).toISOString() : null,
    expiresAtUtc: paid ? new Date(now + 86400000).toISOString() : null,
    features: { unlimitedDecks: paid, unlimitedCards: paid },
    limits: paid ? { decks: null, cards: null } : { decks: 1, cards: 50 },
    isPurchasable: false,
    purchaseSupported: false,
    withinFreeTierLimits: mockUsage.decks <= 1 && mockUsage.cards <= 50,
    usage: { ...mockUsage },
    validatedAtUtc: new Date(now).toISOString(),
  };
}

function account(paid = false) {
  const response = entitlements(paid);
  mockAccess = new LearningAccessController({
    userId: 'owner',
    usage: async () => mockUsage,
    online: async () => true,
    fetch: async () => response,
  });
  jest
    .mocked(engine.subscription)
    .mockResolvedValue({ subscription: null, entitlements: response });
  return response;
}

function language(value: UiLanguage) {
  jest.mocked(useLocalization).mockReturnValue({
    language: value,
    direction: resolveDirection(value),
    t: (key, values) => translate(value, key, values),
    number: (amount) => formatNumber(amount, value),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUsage = { decks: 1, cards: 50 };
  mockAccess = new LearningAccessController({ userId: null, usage: async () => mockUsage });
  Object.defineProperty(engine, 'available', { configurable: true, value: true });
  jest.mocked(engine.planCatalog).mockReset().mockResolvedValue(catalog);
  jest.mocked(engine.subscription).mockReset();
  language('en');
});

test.each(['en', 'fa'] as const)(
  'server prices, accessible selection and local usage render in %s',
  async (locale) => {
    language(locale);
    const amount = (value: number) =>
      locale === 'fa' ? `\u2066${formatNumber(value, locale)}\u2069` : formatNumber(value, locale);
    render(<SubscriptionScreen />);
    const first = await screen.findByTestId('plus-plan-1');
    expect(first.props.accessibilityState.selected).toBe(true);
    expect(
      screen.getByText(translate(locale, 'paywall.monthPrice', { amount: amount(49000) })),
    ).toBeTruthy();
    expect(
      screen.getByText(
        translate(locale, 'access.price', {
          months: formatNumber(6, locale),
          amount: amount(279000),
        }),
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        translate(locale, 'access.price', {
          months: formatNumber(12, locale),
          amount: amount(499000),
        }),
      ),
    ).toBeTruthy();
    fireEvent.press(screen.getByTestId('plus-plan-6'));
    expect(screen.getByTestId('plus-plan-6').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('plus-plan-1').props.accessibilityState.selected).toBe(false);
    expect(screen.getByTestId('selected-plan').props.children).toBe(
      translate(locale, 'paywall.total', {
        months: formatNumber(6, locale),
        amount: formatNumber(279000, locale),
      }),
    );
    expect(
      StyleSheet.flatten(screen.getByText(translate(locale, 'paywall.title')).props.style),
    ).toMatchObject({
      writingDirection: resolveDirection(locale),
      textAlign: locale === 'fa' ? 'right' : 'left',
    });
    await waitFor(() =>
      expect(screen.getByText(translate(locale, 'paywall.withinLimits'))).toBeTruthy(),
    );
    expect(engine.subscription).not.toHaveBeenCalled();
  },
);

test.each(['fa', 'en'] as const)(
  '%s plan amounts preserve grouping with LTR isolation only in Persian',
  async (locale) => {
    const prices = [
      { durationMonths: 1, priceToman: 49000 },
      { durationMonths: 3, priceToman: 99000 },
      { durationMonths: 6, priceToman: 100000 },
      { durationMonths: 12, priceToman: 1234567 },
    ];
    const formatted =
      locale === 'fa'
        ? ['۴۹٬۰۰۰', '۹۹٬۰۰۰', '۱۰۰٬۰۰۰', '۱٬۲۳۴٬۵۶۷']
        : ['49,000', '99,000', '100,000', '1,234,567'];
    language(locale);
    jest.mocked(engine.planCatalog).mockResolvedValue({
      ...catalog,
      plans: [{ ...catalog.plans[0]!, prices }],
    });
    render(<SubscriptionScreen />);
    await screen.findByTestId('plus-plan-12');

    for (const [index, price] of prices.entries()) {
      const button = screen.getByTestId(`plus-plan-${price.durationMonths}`);
      const label = button.props.accessibilityLabel;
      if (locale === 'fa') {
        expect(label).toContain(`\u2068\u2066${formatted[index]}\u2069\u2069 تومان`);
      } else {
        expect(label).toBe(
          `${price.durationMonths} ${price.durationMonths === 1 ? 'month' : 'months'}: ${formatted[index]} toman`,
        );
      }
      expect(screen.getByText(label)).toHaveStyle({ writingDirection: resolveDirection(locale) });
      fireEvent.press(button);
      expect(button.props.accessibilityState.selected).toBe(true);
      expect(screen.getByTestId('selected-plan').props.children).toBe(
        translate(locale, price.durationMonths === 1 ? 'paywall.monthTotal' : 'paywall.total', {
          months: formatNumber(price.durationMonths, locale),
          amount: formatNumber(price.priceToman, locale),
        }),
      );
    }

    expect(
      screen.getByRole('button', { name: translate(locale, 'paywall.purchaseUnavailable') }),
    ).toBeDisabled();
    expect(engine.planCatalog).toHaveBeenCalledTimes(1);
    expect(engine.subscription).not.toHaveBeenCalled();
  },
);

test('prices come from the response, not a second mobile price list', async () => {
  jest.mocked(engine.planCatalog).mockResolvedValue({
    ...catalog,
    plans: [{ ...catalog.plans[0]!, prices: [{ durationMonths: 3, priceToman: 123456 }] }],
  });
  render(<SubscriptionScreen />);
  expect(await screen.findByText('3 months: 123,456 toman')).toBeTruthy();
  expect(screen.queryByTestId('plus-plan-1')).toBeNull();
});

test('no provider means no purchase request, activation, simulated cancellation or success; Full is never selectable', async () => {
  render(<SubscriptionScreen />);
  await screen.findByTestId('plus-plan-12');
  const purchase = screen.getByRole('button', { name: 'Purchase unavailable' });
  expect(purchase.props.accessibilityState.disabled).toBe(true);
  fireEvent.press(purchase);
  fireEvent.press(purchase);
  fireEvent.press(screen.getByTestId('plus-plan-12'));
  expect(screen.getByText(/does not charge you or activate Plus/)).toBeTruthy();
  expect(screen.getByText('Full is not available.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Full/ })).toBeNull();
  expect(engine.subscription).not.toHaveBeenCalled();
  expect(engine.planCatalog).toHaveBeenCalledTimes(1);
  expect(mockAccess.snapshot().entitlements).toBeNull();
});

test('active Plus displays server status and local expiration; a repeated purchase remains disabled', async () => {
  const response = account(true);
  render(<SubscriptionScreen />);
  expect(await screen.findByText('Subscription status: Plus active')).toBeTruthy();
  expect(screen.getByText(/Another purchase is not allowed/)).toBeTruthy();
  expect(
    screen.getByText(
      translate('en', 'access.expires', {
        time: new Date(response.expiresAtUtc!).toLocaleString('en-US'),
      }),
    ),
  ).toBeTruthy();
  const purchase = screen.getByRole('button', { name: 'Purchase unavailable' });
  fireEvent.press(purchase);
  expect(purchase.props.accessibilityState.disabled).toBe(true);
  await waitFor(() => expect(engine.subscription).toHaveBeenCalledTimes(1));
});

test.each([
  ['deck', 1, 50, 'paywall.deckReason'],
  ['card', 1, 50, 'paywall.cardReason'],
  ['study', 2, 51, 'paywall.studyReason'],
] as const)(
  '%s denial survives the paywall refresh with the specific triggering reason',
  async (operation, decks, cards, reason) => {
    mockUsage = { decks, cards };
    await expect(mockAccess.assertAllowed(operation)).rejects.toMatchObject({
      code: 'free-tier-limit',
    });
    render(<SubscriptionScreen />);
    await screen.findByTestId('plus-plan-1');
    expect(screen.getByText(translate('en', reason))).toBeTruthy();
    expect(mockUsage).toEqual({ decks, cards });
  },
);

test('expired account retains metadata and data, uses free limits and does not enable purchases', async () => {
  const response = account();
  const starts = new Date(Date.now() - 86400000).toISOString();
  const expires = new Date(Date.now() - 1000).toISOString();
  jest.mocked(engine.subscription).mockResolvedValue({
    entitlements: { ...response, startsAtUtc: starts, expiresAtUtc: expires },
    subscription: {
      id: 'sub',
      plan: 'Plus',
      storedStatus: 'Active',
      status: 'Expired',
      startsAtUtc: starts,
      expiresAtUtc: expires,
      createdAtUtc: starts,
      updatedAtUtc: starts,
    },
  });
  render(<SubscriptionScreen />);
  expect(await screen.findByText('Subscription status: Expired')).toBeTruthy();
  expect(screen.getByText(/Your subscription expired/)).toBeTruthy();
  expect(mockUsage).toEqual({ decks: 1, cards: 50 });
  expect(
    screen.getByRole('button', { name: 'Purchase unavailable' }).props.accessibilityState.disabled,
  ).toBe(true);
});

test('failed and empty catalogs have actionable retry and never invented prices; repeated refresh is coalesced', async () => {
  jest
    .mocked(engine.planCatalog)
    .mockRejectedValueOnce(new Error('network unavailable'))
    .mockResolvedValueOnce({ ...catalog, plans: [] })
    .mockResolvedValue(catalog);
  render(<SubscriptionScreen />);
  await screen.findByText(translate('en', 'access.unavailable'));
  expect(screen.queryByTestId('selected-plan')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Refresh access' }));
  expect(await screen.findByText(translate('en', 'paywall.empty'))).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Refresh access' }));
  fireEvent.press(screen.getByRole('button', { name: 'Refresh access' }));
  await screen.findByTestId('plus-plan-1');
  expect(engine.planCatalog).toHaveBeenCalledTimes(3);
});

test('offline/native-unavailable catalog has no hardcoded prices or cloud availability claim', async () => {
  Object.defineProperty(engine, 'available', { value: false });
  render(<SubscriptionScreen />);
  expect(await screen.findByText(translate('en', 'access.unavailable'))).toBeTruthy();
  expect(screen.getByText(translate('en', 'paywall.cloudUnavailable'))).toBeTruthy();
  expect(engine.planCatalog).not.toHaveBeenCalled();
  expect(screen.queryByTestId('selected-plan')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(router.push).toHaveBeenCalledWith('/auth');
});

test('authentication failure is not displayed as active or as a payment outcome', async () => {
  account();
  jest.mocked(engine.subscription).mockRejectedValue({ status: 401 });
  render(<SubscriptionScreen />);
  expect(await screen.findByText(translate('en', 'paywall.statusError'))).toBeTruthy();
  expect(screen.queryByText('Subscription status: Plus active')).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Purchase unavailable' }).props.accessibilityState.disabled,
  ).toBe(true);
});

test('offline last-known Plus is explicitly provisional, and unknown access never becomes Plus', async () => {
  const now = Date.now();
  const paid = entitlements(true);
  mockAccess = new LearningAccessController({
    userId: 'owner',
    usage: async () => mockUsage,
    online: async () => false,
    readCache: async () => serverEntitlementCache(paid, now),
  });
  jest.mocked(engine.subscription).mockRejectedValue(new Error('offline'));
  const view = render(<SubscriptionScreen />);
  expect(
    await screen.findByText(
      translate('en', 'paywall.status', { status: translate('en', 'paywall.activeProvisional') }),
    ),
  ).toBeTruthy();
  expect(screen.getByText(translate('en', 'access.provisional'))).toBeTruthy();
  view.unmount();
  mockAccess = new LearningAccessController({
    userId: 'owner',
    usage: async () => mockUsage,
    online: async () => false,
  });
  render(<SubscriptionScreen />);
  expect(await screen.findByText('Subscription status: Unconfirmed')).toBeTruthy();
  expect(screen.queryByText('Subscription status: Plus active')).toBeNull();
  expect(
    screen.getByRole('button', { name: 'Purchase unavailable' }).props.accessibilityState.disabled,
  ).toBe(true);
});

test('an unmounted account paywall ignores a late status response', async () => {
  account();
  let complete!: (value: CurrentSubscription) => void;
  jest.mocked(engine.subscription).mockReturnValue(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  const accountView = render(<SubscriptionScreen />);
  await waitFor(() => expect(engine.subscription).toHaveBeenCalledTimes(1));
  accountView.unmount();
  mockAccess = new LearningAccessController({ userId: null, usage: async () => mockUsage });
  render(<SubscriptionScreen />);
  await act(async () => {
    complete({ subscription: null, entitlements: entitlements() });
  });
  expect(
    await screen.findByText(
      translate('en', 'paywall.status', { status: translate('en', 'guest.mode') }),
    ),
  ).toBeTruthy();
  expect(screen.queryByText('Subscription status: Plus active')).toBeNull();
});
