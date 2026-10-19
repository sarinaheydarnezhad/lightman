import * as SecureStore from 'expo-secure-store';
import { CloudClient } from './cloud-client';
import { SyncEngine } from './sync-engine';
import type { SyncStore } from './sync-store';
import {
  validateEntitlements,
  validatePlanCatalog,
  validateSubscription,
  type CurrentSubscription,
  type Entitlements,
  type PlanCatalog,
} from './subscription';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(),
  addNetworkStateListener: jest.fn(),
}));

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
const free: Entitlements = {
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
  validatedAtUtc: '2026-10-15T12:00:00+00:00',
};
const plus: CurrentSubscription = {
  subscription: {
    id: '11111111-1111-1111-1111-111111111111',
    plan: 'Plus',
    storedStatus: 'Active',
    status: 'Active',
    startsAtUtc: '2026-10-01T00:00:00+00:00',
    expiresAtUtc: '2026-11-01T00:00:00+00:00',
    createdAtUtc: '2026-10-01T00:00:00+00:00',
    updatedAtUtc: '2026-10-01T00:00:00+00:00',
  },
  entitlements: {
    ...free,
    currentPlan: 'Plus',
    isActive: true,
    startsAtUtc: '2026-10-01T00:00:00+00:00',
    expiresAtUtc: '2026-11-01T00:00:00+00:00',
    limits: { decks: null, cards: null },
    features: { unlimitedDecks: true, unlimitedCards: true },
    withinFreeTierLimits: false,
    usage: { decks: 2, cards: 51 },
  },
};
const credentials = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  accessExpiresAtUtc: '2099-01-01T00:00:00Z',
  userId: '11111111-1111-1111-1111-111111111111',
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  jest
    .mocked(SecureStore.getItemAsync)
    .mockReset()
    .mockImplementation(async (key) =>
      key === 'lerona.cloud.credentials.v1' ? JSON.stringify(credentials) : null,
    );
  jest.mocked(SecureStore.setItemAsync).mockReset().mockResolvedValue();
  jest.mocked(SecureStore.deleteItemAsync).mockReset().mockResolvedValue();
});
afterEach(() => {
  delete process.env.EXPO_PUBLIC_API_URL;
});

test('catalog preserves actual server pricing without a mobile price table or purchase activation', () => {
  expect(validatePlanCatalog(catalog)).toBe(catalog);
  expect(validatePlanCatalog(catalog).plans[0]!.prices).toEqual(catalog.plans[0]!.prices);
});

test.each([
  null,
  { ...catalog, currency: 'IRR' },
  { ...catalog, purchaseSupported: true },
  { ...catalog, plans: [{ ...catalog.plans[1], isPurchasable: true }] },
  { ...catalog, plans: [{ ...catalog.plans[1], prices: [{ durationMonths: 1, priceToman: 1 }] }] },
  {
    ...catalog,
    plans: [{ ...catalog.plans[0], prices: [{ durationMonths: 0, priceToman: 49000 }] }],
  },
])('unsupported or malformed purchase catalogs fail closed: %j', (value) => {
  expect(() => validatePlanCatalog(value)).toThrow();
});

test('Free and active Plus models match server metadata, limits and validated time', () => {
  expect(validateSubscription({ subscription: null, entitlements: free }).entitlements).toEqual(
    free,
  );
  expect(validateSubscription(plus)).toBe(plus);
});

test.each(['Expired', 'Scheduled', 'Cancelled', 'Unavailable'] as const)(
  'inactive status %s retains subscription metadata without granting Plus',
  (status) => {
    const current = {
      subscription: {
        ...plus.subscription!,
        status,
        plan: status === 'Unavailable' ? 'Full' : 'Plus',
      },
      entitlements: {
        ...free,
        startsAtUtc: plus.subscription!.startsAtUtc,
        expiresAtUtc: plus.subscription!.expiresAtUtc,
      },
    };
    expect(validateSubscription(current).entitlements.currentPlan).toBe('Free');
    expect(validateSubscription(current).entitlements.isActive).toBe(false);
  },
);

test.each([
  null,
  { ...free, isActive: true },
  { ...free, purchaseSupported: true },
  { ...free, usage: { decks: -1, cards: 0 } },
  { ...free, validatedAtUtc: 'not-a-date' },
  { ...plus.entitlements, expiresAtUtc: free.validatedAtUtc },
  { ...plus.entitlements, startsAtUtc: '2026-10-16T00:00:00Z' },
])('invalid entitlements never fall back to assumed paid access: %j', (value) => {
  expect(() => validateEntitlements(value)).toThrow();
});

test('missing or inconsistent subscription ownership-neutral metadata fails validation', () => {
  expect(() =>
    validateSubscription({ subscription: null, entitlements: plus.entitlements }),
  ).toThrow();
  expect(() =>
    validateSubscription({ ...plus, subscription: { ...plus.subscription, id: 'invalid' } }),
  ).toThrow();
  expect(() =>
    validateSubscription({ ...plus, subscription: { ...plus.subscription, plan: 'Full' } }),
  ).toThrow();
});

test('public catalog read uses the actual versioned endpoint and does not require or send credentials', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => catalog });
  expect(await new CloudClient().planCatalog()).toEqual(catalog);
  expect(fetch).toHaveBeenCalledWith(
    'https://api.example.test/api/v1/plans',
    expect.objectContaining({ method: 'GET' }),
  );
  expect(jest.mocked(fetch).mock.calls[0]![1]!.headers).not.toHaveProperty('Authorization');
  expect(SecureStore.getItemAsync).not.toHaveBeenCalled();
});

test('subscription and entitlement reads reuse JWT requests and never send an owner or activation body', async () => {
  globalThis.fetch = jest.fn().mockImplementation(async (url) => ({
    ok: true,
    json: async () => (String(url).endsWith('/subscription') ? plus : plus.entitlements),
  }));
  const client = new CloudClient();
  expect(await client.subscription()).toEqual(plus);
  expect(await client.entitlements()).toEqual(plus.entitlements);
  expect(jest.mocked(fetch).mock.calls.map(([url]) => String(url))).toEqual([
    'https://api.example.test/api/v1/me/subscription',
    'https://api.example.test/api/v1/me/entitlements',
  ]);
  for (const [, request] of jest.mocked(fetch).mock.calls) {
    expect(request!.method).toBe('GET');
    expect(request!.body).toBeUndefined();
    expect(request!.headers).toEqual(
      expect.objectContaining({ Authorization: 'Bearer access-token' }),
    );
  }
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
});

test('expired entitlement authentication clears the existing session rather than returning cached access', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });
  const lost = jest.fn();
  await expect(new CloudClient(lost).entitlements()).rejects.toMatchObject({ status: 401 });
  expect(lost).toHaveBeenCalled();
  expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('lerona.cloud.credentials.v1');
});

test('study authorization uses the real authenticated POST endpoint without accepting a client owner or granting a lease token', async () => {
  globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => plus.entitlements });
  expect(await new CloudClient().authorizeStudy()).toEqual(plus.entitlements);
  expect(fetch).toHaveBeenCalledWith(
    'https://api.example.test/api/v1/me/study/authorize',
    expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer access-token' }),
    }),
  );
  expect(jest.mocked(fetch).mock.calls[0]![1]!.body).toBeUndefined();
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
});

test('offline subscription checks report uncertainty without changing tokens or guessing access', async () => {
  globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Offline'));
  await expect(new CloudClient().subscription()).rejects.toMatchObject({ status: 0 });
  expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
});

test('a subscription response arriving after logout is rejected by the existing epoch checks', async () => {
  let finish!: () => void;
  const gate = new Promise<void>((resolve) => {
    finish = resolve;
  });
  globalThis.fetch = jest.fn().mockImplementation(async () => {
    await gate;
    return { ok: true, json: async () => plus };
  });
  const client = new CloudClient();
  const result = client.subscription();
  const rejected = expect(result).rejects.toMatchObject({ status: 401 });
  await client.forgetLocalSession();
  finish();
  await rejected;
});

test('guest scope cannot invoke account entitlement reads, while the public catalog remains available', async () => {
  const cloud = {
    entitlements: jest.fn(),
    subscription: jest.fn(),
    planCatalog: jest.fn(async () => catalog),
  };
  const engine = new SyncEngine(
    {} as SyncStore,
    cloud as unknown as CloudClient,
    undefined,
    undefined,
    {
      isAccount: () => false,
      enterAccount: jest.fn(),
      enterGuest: jest.fn(),
    },
  );
  await expect(engine.entitlements()).rejects.toThrow('authenticated account');
  await expect(engine.subscription()).rejects.toThrow('authenticated account');
  expect(cloud.entitlements).not.toHaveBeenCalled();
  expect(cloud.subscription).not.toHaveBeenCalled();
  expect(await engine.planCatalog()).toEqual(catalog);
});

test('subscription and backup status reads do not exclude each other or an existing account operation', async () => {
  let finishWrite!: () => void;
  let finishSubscription!: (value: CurrentSubscription) => void;
  const cloud = {
    available: true,
    hasSession: jest.fn(async () => true),
    subscription: jest.fn(
      () =>
        new Promise<CurrentSubscription>((resolve) => {
          finishSubscription = resolve;
        }),
    ),
    backupStatus: jest.fn(async () => ({ latest: null, lastSuccessful: null })),
  };
  const engine = new SyncEngine({} as SyncStore, cloud as unknown as CloudClient);
  const write = engine.withAccount(
    () =>
      new Promise<void>((resolve) => {
        finishWrite = resolve;
      }),
  );
  await Promise.resolve();
  const status = engine.subscription();
  expect(await engine.backupStatus()).toEqual({ latest: null, lastSuccessful: null });
  finishSubscription(plus);
  expect(await status).toEqual(plus);
  finishWrite();
  await write;
  expect(cloud.subscription).toHaveBeenCalledTimes(1);
  expect(cloud.backupStatus).toHaveBeenCalledTimes(1);
});

test('a failed metadata read does not fail another read, and account reads reject late guest transitions', async () => {
  let signedIn = true;
  let finish!: (value: CurrentSubscription) => void;
  const cloud = {
    available: true,
    hasSession: jest.fn(async () => true),
    subscription: jest.fn(
      () =>
        new Promise<CurrentSubscription>((resolve) => {
          finish = resolve;
        }),
    ),
    backupStatus: jest.fn(async () => {
      throw new Error('offline');
    }),
  };
  const engine = new SyncEngine(
    {} as SyncStore,
    cloud as unknown as CloudClient,
    undefined,
    undefined,
    {
      isAccount: () => signedIn,
      enterAccount: jest.fn(),
      enterGuest: jest.fn(),
    },
  );
  const pending = engine.subscription();
  const rejected = expect(pending).rejects.toThrow('authenticated account');
  await expect(engine.backupStatus()).rejects.toThrow('offline');
  signedIn = false;
  finish(plus);
  await rejected;
  await expect(engine.backupStatus()).rejects.toThrow('authenticated account');
  expect(cloud.backupStatus).toHaveBeenCalledTimes(1);
});
