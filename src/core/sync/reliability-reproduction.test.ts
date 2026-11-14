import { SyncEngine } from './sync-engine';
import { CloudClient } from './cloud-client';
import { SyncStore } from './sync-store';
import { RealSqliteDatabase } from '@/../test/real-sqlite';
import { runMigrations } from '@/core/database/migrations';
import { PostCommitDatabase } from '@/core/database/post-commit-database';
import { createApplication } from '@/core/application/create-application';
import { createSqliteRepositories } from '@/core/composition/sqlite-repositories';
import { fixedClock, sequenceIds, makeDeck } from '@/../test/fixtures';
import * as Network from 'expo-network';

jest.mock('expo-network', () => ({ addNetworkStateListener: jest.fn() }));

beforeEach(() => {
  jest.useFakeTimers();
  process.env.EXPO_PUBLIC_API_URL = 'https://phase-four.invalid';
  jest.mocked(Network.addNetworkStateListener).mockReturnValue({ remove: jest.fn() });
});
afterEach(() => jest.useRealTimers());

test('F08: a deck committed after initial foreground pull receives an automatic attempt', async () => {
  const raw = await RealSqliteDatabase.open();
  await runMigrations(raw);
  const db = new PostCommitDatabase(raw);
  const store = new SyncStore(db);
  await store.bind('owner');
  // The composition boundary supplies owner-scoped post-commit signals.
  const cloud = {
    available: true,
    hasSession: async () => true,
    push: jest.fn(async () => ({ changes: [{ serverVersion: 1 }] })),
    pull: jest.fn(async () => ({ cursor: 0, latestVersion: 0, hasMore: false, changes: [] })),
  };
  const engine = new SyncEngine(
    store,
    cloud as unknown as CloudClient,
    async () => true,
    undefined,
    undefined,
    undefined,
    {
      subscribeChanges: db.subscribe,
    },
  );
  const stop = engine.start();
  try {
    await engine.syncNow();
    expect(cloud.pull).toHaveBeenCalledTimes(1);
    const app = createApplication(createSqliteRepositories(db), fixedClock, sequenceIds());
    await app.createDeck(makeDeck());
    expect((await store.counts()).pending).toBe(1);
    await jest.advanceTimersByTimeAsync(250);
    expect(cloud.push).toHaveBeenCalledTimes(1);
    expect((await store.counts()).pending).toBe(0);
  } finally {
    stop();
    raw.handle.close();
  }
});

test('F09: plan headers followed by a stalled JSON body expire at the existing deadline', async () => {
  let signal: AbortSignal | undefined;
  globalThis.fetch = jest.fn(async (_url: unknown, init?: RequestInit) => {
    signal = init?.signal ?? undefined;
    return { ok: true, status: 200, json: () => new Promise(() => {}) } as Response;
  });
  let result: unknown;
  void new CloudClient().planCatalog().catch((error) => {
    result = error;
  });
  await jest.advanceTimersByTimeAsync(13_000);
  expect(result).toMatchObject({ status: 0, code: 'request_timeout' });
  expect(signal?.aborted).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});
