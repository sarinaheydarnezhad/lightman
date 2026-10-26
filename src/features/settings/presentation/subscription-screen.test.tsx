import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
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
import { FreePlanLimit } from '@/shared/access/free-plan-limit';
import * as theme from '@/shared/theme/theme-provider';
import { palette } from '@/shared/theme/tokens';

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
        { durationMonths: 1, priceToman: 70000 },
        { durationMonths: 6, priceToman: 294000 },
        { durationMonths: 12, priceToman: 420000 },
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

afterEach(() => jest.restoreAllMocks());

test.each([
  ['en', 'light'],
  ['fa', 'light'],
  ['en', 'dark'],
  ['fa', 'dark'],
] as const)('verified plan cards adapt to %s and %s mode', async (locale, mode) => {
  language(locale);
  jest.spyOn(theme, 'useThemeColors').mockReturnValue(palette[mode]);
  render(<SubscriptionScreen />);
  await screen.findByTestId('plus-plan-1');
  expect(screen.getByText(translate(locale, 'account.purchaseLoginHint'))).toHaveStyle({
    writingDirection: resolveDirection(locale),
  });
  const title = translate(locale, 'paywall.title');
  expect(screen.getByRole('header', { name: title }).props.allowFontScaling).toBe(true);
  expect(screen.getByText(translate(locale, 'paywall.introTitle'))).toBeTruthy();
  const freePlan = screen.getByTestId('free-plan');
  const plusPlan = screen.getByTestId('plus-plan');
  const premiumPlan = screen.getByTestId('premium-plan');
  expect(premiumPlan).toHaveStyle({ backgroundColor: palette[mode].surface });
  expect(
    within(premiumPlan).getByRole('header', { name: translate(locale, 'paywall.premiumPlan') }),
  ).toBeTruthy();
  expect(
    within(premiumPlan).getByText(translate(locale, 'access.premiumUnavailable')),
  ).toBeTruthy();
  expect(within(premiumPlan).getByText(translate(locale, 'paywall.premiumStatus'))).toBeTruthy();
  expect(within(premiumPlan).queryAllByRole('button')).toHaveLength(0);
  expect(freePlan).toHaveStyle({ backgroundColor: palette[mode].surface });
  expect(plusPlan).toHaveStyle({
    backgroundColor: palette[mode].surface,
    borderColor: palette[mode].primary,
  });
  expect(
    within(freePlan).getByRole('header', { name: translate(locale, 'account.freePlan') }),
  ).toBeTruthy();
  expect(
    within(plusPlan).getByRole('header', { name: translate(locale, 'paywall.plusPlan') }),
  ).toBeTruthy();
  for (const [key, count] of [
    ['paywall.freeDecks', 1],
    ['paywall.freeCards', 50],
  ] as const) {
    expect(
      within(freePlan).getByText(translate(locale, key, { count: formatNumber(count, locale) })),
    ).toBeTruthy();
  }
  const freeStudy = within(freePlan).getByText(translate(locale, 'paywall.freeStudy'));
  expect(freeStudy).toHaveStyle({ writingDirection: resolveDirection(locale) });
  let featureRow = freeStudy.parent;
  while (featureRow && !featureRow.props.className?.includes('items-start'))
    featureRow = featureRow.parent;
  expect(featureRow?.props.className.split(' ')).toContain(
    locale === 'fa' ? 'flex-row-reverse' : 'flex-row',
  );
  for (const key of ['paywall.plusDecks', 'paywall.plusCards', 'paywall.study'] as const) {
    expect(within(plusPlan).getByText(translate(locale, key))).toBeTruthy();
  }
  expect(within(plusPlan).queryByText(translate(locale, 'paywall.cloud'))).toBeNull();
  expect(
    screen.getByRole('button', { name: translate(locale, 'paywall.purchaseUnavailable') }),
  ).toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: translate(locale, 'sync.signIn') }));
  expect(router.push).toHaveBeenCalledWith('/auth');
  expect(engine.planCatalog).toHaveBeenCalledTimes(1);
});

test.each(['en', 'fa'] as const)(
  'catalog and account loading stay visible in %s',
  async (locale) => {
    language(locale);
    account();
    jest.mocked(engine.planCatalog).mockReturnValue(new Promise(() => {}));
    jest.mocked(engine.subscription).mockReturnValue(new Promise(() => {}));
    render(<SubscriptionScreen />);
    expect(screen.queryByText(translate(locale, 'account.purchaseLoginHint'))).toBeNull();
    expect(
      screen.getByRole('progressbar', { name: translate(locale, 'paywall.loading') }),
    ).toBeTruthy();
    expect(
      screen.getByRole('progressbar', { name: translate(locale, 'subscription.loading') }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: translate(locale, 'access.refresh') })).toBeNull();
    expect(
      screen.getByRole('button', { name: translate(locale, 'paywall.purchaseUnavailable') }),
    ).toBeDisabled();
    await waitFor(() => expect(engine.subscription).toHaveBeenCalledTimes(1));
  },
);

test.each(['en', 'fa'] as const)('free-limit actions keep View plans in %s', (locale) => {
  language(locale);
  render(<FreePlanLimit operation="deck" />);
  fireEvent.press(screen.getByRole('button', { name: translate(locale, 'access.plans') }));
  expect(router.push).toHaveBeenCalledWith('/settings/subscription');
  expect(
    screen.queryByRole('button', { name: translate(locale, 'settings.upgradePlus') }),
  ).toBeNull();
});

test.each(['en', 'fa'] as const)(
  'server prices and accessible selection render without usage diagnostics in %s',
  async (locale) => {
    language(locale);
    const amount = (value: number) =>
      locale === 'fa' ? `\u2066${formatNumber(value, locale)}\u2069` : formatNumber(value, locale);
    render(<SubscriptionScreen />);
    const first = await screen.findByTestId('plus-plan-1');
    expect(first.props.accessibilityState.selected).toBe(true);
    expect(
      screen.getByText(translate(locale, 'paywall.monthPrice', { amount: amount(70000) })),
    ).toBeTruthy();
    expect(screen.queryByTestId('selected-plan-monthly')).toBeNull();
    for (const [months, total, monthly, discount] of [
      [6, 294000, 49000, 30],
      [12, 420000, 35000, 50],
    ] as const) {
      const label = `${translate(locale, 'access.price', { months: formatNumber(months, locale), amount: amount(total) })}\n${translate(locale, 'paywall.perMonth', { amount: amount(monthly) })} · ${translate(locale, 'paywall.discount', { percent: formatNumber(discount, locale) })}`;
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
    }
    fireEvent.press(screen.getByTestId('plus-plan-6'));
    expect(screen.getByTestId('plus-plan-6').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('plus-plan-1').props.accessibilityState.selected).toBe(false);
    expect(screen.getByTestId('selected-plan').props.children).toBe(
      translate(locale, 'paywall.total', {
        months: formatNumber(6, locale),
        amount: formatNumber(294000, locale),
      }),
    );
    expect(screen.getByTestId('selected-plan-monthly').props.children).toBe(
      translate(locale, 'paywall.perMonth', { amount: amount(49000) }),
    );
    fireEvent.press(screen.getByTestId('plus-plan-12'));
    expect(screen.getByTestId('plus-plan-12').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('selected-plan-monthly').props.children).toBe(
      translate(locale, 'paywall.perMonth', { amount: amount(35000) }),
    );
    expect(
      StyleSheet.flatten(screen.getByText(translate(locale, 'paywall.title')).props.style),
    ).toMatchObject({
      fontFamily: 'Vazirmatn-Bold',
      fontWeight: 'normal',
      writingDirection: resolveDirection(locale),
      textAlign: locale === 'fa' ? 'right' : 'left',
    });
    expect(screen.queryByText(translate(locale, 'paywall.withinLimits'))).toBeNull();
    expect(engine.subscription).not.toHaveBeenCalled();
  },
);

test.each(['fa', 'en'] as const)(
  '%s plan amounts preserve grouping with LTR isolation only in Persian',
  async (locale) => {
    const prices = [
      { durationMonths: 1, priceToman: 70000 },
      { durationMonths: 3, priceToman: 99000 },
      { durationMonths: 6, priceToman: 100000 },
      { durationMonths: 12, priceToman: 1234567 },
    ];
    const formatted =
      locale === 'fa'
        ? ['۷۰٬۰۰۰', '۹۹٬۰۰۰', '۱۰۰٬۰۰۰', '۱٬۲۳۴٬۵۶۷']
        : ['70,000', '99,000', '100,000', '1,234,567'];
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
        expect(label).toContain(
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
  const option = await screen.findByTestId('plus-plan-3');
  expect(option.props.accessibilityLabel).toBe('3 months: 123,456 toman\n41,152 toman/month');
  expect(screen.queryByTestId('plus-plan-1')).toBeNull();
});

test('monthly equivalents and discounts follow server prices rather than hardcoded offers', async () => {
  jest.mocked(engine.planCatalog).mockResolvedValue({
    ...catalog,
    plans: [
      {
        ...catalog.plans[0]!,
        prices: [
          { durationMonths: 1, priceToman: 100000 },
          { durationMonths: 6, priceToman: 450000 },
        ],
      },
    ],
  });
  render(<SubscriptionScreen />);
  const option = await screen.findByTestId('plus-plan-6');
  expect(option.props.accessibilityLabel).toBe(
    '6 months: 450,000 toman\n75,000 toman/month · 25% off',
  );
  fireEvent.press(option);
  expect(screen.getByTestId('selected-plan-monthly').props.children).toBe('75,000 toman/month');
});

test('no provider means no purchase request, activation, simulated cancellation or success; Premium is never selectable', async () => {
  render(<SubscriptionScreen />);
  await screen.findByTestId('plus-plan-12');
  const purchase = screen.getByRole('button', { name: 'Purchase unavailable' });
  expect(purchase.props.accessibilityState.disabled).toBe(true);
  fireEvent.press(purchase);
  fireEvent.press(purchase);
  fireEvent.press(screen.getByTestId('plus-plan-12'));
  expect(screen.getByText(/does not charge you or activate Plus/)).toBeTruthy();
  expect(screen.getByText('Premium is not available to all users right now.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Premium/ })).toBeNull();
  expect(engine.subscription).not.toHaveBeenCalled();
  expect(engine.planCatalog).toHaveBeenCalledTimes(1);
  expect(mockAccess.snapshot().entitlements).toBeNull();
});

test.each(['en', 'fa'] as const)(
  'active Plus shows date-only details without purchase controls or access diagnostics in %s',
  async (locale) => {
    language(locale);
    const response = account(true);
    render(<SubscriptionScreen />);
    await screen.findByText(
      translate(locale, 'paywall.status', { status: translate(locale, 'paywall.active') }),
    );
    for (const [key, value] of [
      ['subscription.startDate', response.startsAtUtc!],
      ['subscription.endDate', response.expiresAtUtc!],
    ] as const) {
      const date = new Date(value).toLocaleDateString(locale === 'fa' ? 'fa-IR' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      expect(screen.getByText(translate(locale, key, { date }))).toBeTruthy();
    }
    expect(screen.queryByText(translate(locale, 'account.subscription'))).toBeNull();
    expect(screen.queryByText(translate(locale, 'paywall.alreadyActive'))).toBeNull();
    expect(screen.queryByText(translate(locale, 'paywall.choose'))).toBeNull();
    expect(screen.queryByTestId('plus-plan-1')).toBeNull();
    expect(screen.queryByTestId('selected-plan')).toBeNull();
    expect(
      screen.queryByRole('button', { name: translate(locale, 'paywall.purchaseUnavailable') }),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: translate(locale, 'access.refresh') })).toBeNull();
    expect(
      screen.queryByRole('button', { name: translate(locale, 'settings.upgradePlus') }),
    ).toBeNull();
    expect(engine.subscription).toHaveBeenCalledTimes(1);
  },
);

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
    expect(screen.getByText(translate('en', reason), { exact: false })).toBeTruthy();
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
  fireEvent.press(screen.getByRole('button', { name: translate('en', 'common.tryAgain') }));
  expect(await screen.findByText(translate('en', 'paywall.empty'))).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: translate('en', 'common.tryAgain') }));
  fireEvent.press(screen.getByRole('button', { name: translate('en', 'common.tryAgain') }));
  await screen.findByTestId('plus-plan-1');
  expect(engine.planCatalog).toHaveBeenCalledTimes(3);
});

test.each(['en', 'fa'] as const)(
  'empty Plus durations retain recovery and disabled purchasing in %s',
  async (locale) => {
    language(locale);
    jest.mocked(engine.planCatalog).mockResolvedValue({
      ...catalog,
      plans: [{ ...catalog.plans[0]!, prices: [] }],
    });
    render(<SubscriptionScreen />);
    expect(await screen.findByText(translate(locale, 'paywall.empty'))).toBeTruthy();
    expect(screen.queryByTestId('selected-plan')).toBeNull();
    expect(
      screen.getByRole('button', { name: translate(locale, 'paywall.purchaseUnavailable') }),
    ).toBeDisabled();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: translate(locale, 'common.tryAgain') }),
      ).toBeEnabled(),
    );
  },
);

test('offline/native-unavailable catalog has no hardcoded prices or cloud availability claim', async () => {
  Object.defineProperty(engine, 'available', { value: false });
  render(<SubscriptionScreen />);
  expect(await screen.findByText(translate('en', 'access.unavailable'))).toBeTruthy();
  expect(screen.queryByText(translate('en', 'paywall.cloudUnavailable'))).toBeNull();
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
  await screen.findByTestId('plus-plan-1');
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
  expect(screen.queryByText('Subscription status: Plus active')).toBeNull();
});

test('invalid subscription dates are never rendered', async () => {
  account();
  jest.mocked(engine.subscription).mockResolvedValue({
    subscription: {
      id: 'invalid',
      plan: 'Plus',
      storedStatus: 'Active',
      status: 'Expired',
      startsAtUtc: 'invalid',
      expiresAtUtc: 'invalid',
      createdAtUtc: 'invalid',
      updatedAtUtc: 'invalid',
    },
    entitlements: entitlements(),
  });
  render(<SubscriptionScreen />);
  await screen.findByText('Subscription status: Expired');
  expect(screen.queryByText(/Invalid Date|Start date:|End date:/)).toBeNull();
});

test('subscription failure offers a generic retry without an access refresh button', async () => {
  const response = account(true);
  jest
    .mocked(engine.subscription)
    .mockRejectedValueOnce(new Error('private database error'))
    .mockResolvedValueOnce({ subscription: null, entitlements: response });
  render(<SubscriptionScreen />);
  await screen.findByText(translate('en', 'paywall.statusError'));
  expect(screen.queryByText('private database error')).toBeNull();
  expect(screen.queryByText(/Start date:|End date:/)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Refresh access' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: translate('en', 'common.tryAgain') }));
  await screen.findByText(/Start date:/);
  expect(engine.subscription).toHaveBeenCalledTimes(2);
});
