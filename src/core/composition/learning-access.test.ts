import { LocalStorageScopes } from '@/core/storage/local-storage-scopes';
import type { Repositories } from '@/core/ports/repositories';
import { RealSqliteDatabase } from '@/../test/real-sqlite';
import { runMigrations } from '@/core/database/migrations';
import { installFreeTierGuards } from '@/core/database/free-tier-guards';
import { readEntitlementCache } from '@/core/database/entitlement-cache';
import { createSqliteRepositories } from './sqlite-repositories';
import { learningAccess } from './learning-access';
import { cloud } from './sync';
import type { Entitlements } from '@/core/sync/subscription';

let mockScopes: LocalStorageScopes<Repositories>;
jest.mock('./repositories', () => ({
  storageScopes: {
    current: () => mockScopes.current(),
    snapshot: () => mockScopes.snapshot(),
    assertCurrent: (scope: ReturnType<typeof mockScopes.current>, revision: number) =>
      mockScopes.assertCurrent(scope, revision),
  },
}));
jest.mock('./sync', () => ({
  cloud: { storedUserId: jest.fn(), entitlements: jest.fn(), authorizeStudy: jest.fn() },
}));
jest.mock('expo-network', () => ({
  getNetworkStateAsync: async () => ({ isConnected: true, isInternetReachable: true }),
}));
const owner = '11111111-1111-1111-1111-111111111111';
const other = '22222222-2222-2222-2222-222222222222';
const client = jest.mocked(cloud);

function paid(): Entitlements {
  const now = Date.now();
  return {
    currentPlan: 'Plus',
    isActive: true,
    startsAtUtc: new Date(now - 1000).toISOString(),
    expiresAtUtc: new Date(now + 60_000).toISOString(),
    features: { unlimitedDecks: true, unlimitedCards: true },
    limits: { decks: null, cards: null },
    isPurchasable: false,
    purchaseSupported: false,
    withinFreeTierLimits: false,
    usage: { decks: 2, cards: 51 },
    validatedAtUtc: new Date(now).toISOString(),
  };
}

beforeEach(async () => {
  jest.resetAllMocks();
  mockScopes = new LocalStorageScopes(async () => {
    const database = await RealSqliteDatabase.open();
    await runMigrations(database);
    await installFreeTierGuards(database);
    return { database, value: createSqliteRepositories(database) };
  });
  await mockScopes.initialize();
  await mockScopes.enterAccount(owner);
  client.entitlements.mockResolvedValue(paid());
  client.authorizeStudy.mockResolvedValue(paid());
});

test('account binding before credential persistence cannot read or cache the previous identity permissions', async () => {
  client.storedUserId.mockResolvedValue(other);
  const access = learningAccess();
  await access.refresh();
  expect(client.entitlements).not.toHaveBeenCalled();
  expect(access.snapshot().entitlements).toBeNull();
  expect(await readEntitlementCache(mockScopes.current().database!, owner)).toBeNull();
  client.storedUserId.mockResolvedValue(owner);
  await access.refresh();
  expect(access.snapshot().entitlements?.currentPlan).toBe('Plus');
  expect(
    (await readEntitlementCache(mockScopes.current().database!, owner))?.entitlements.currentPlan,
  ).toBe('Plus');
});

test('changing credentials during a request prevents accepting its owner metadata', async () => {
  client.storedUserId.mockResolvedValueOnce(owner).mockResolvedValue(other);
  await learningAccess().refresh();
  expect(learningAccess().snapshot().entitlements).toBeNull();
  expect(await readEntitlementCache(mockScopes.current().database!, owner)).toBeNull();
});

test('switching scopes rejects late results and guest/account controllers and caches stay separate', async () => {
  let resolve!: (value: Entitlements) => void;
  client.storedUserId.mockResolvedValue(owner);
  client.entitlements.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const account = mockScopes.current();
  const previous = learningAccess();
  const request = previous.refresh();
  while (!client.entitlements.mock.calls.length) await Promise.resolve();
  await mockScopes.enterAccount(other);
  resolve(paid());
  await expect(request).rejects.toMatchObject({ code: 'unavailable' });
  expect(await readEntitlementCache(account.database!, owner)).toBeNull();
  expect(learningAccess()).not.toBe(previous);
  expect(learningAccess().snapshot().entitlements).toBeNull();
  await mockScopes.enterGuest();
  expect(learningAccess().isAccount).toBe(false);
  expect(await readEntitlementCache(mockScopes.current().database!, owner)).toBeNull();
});
