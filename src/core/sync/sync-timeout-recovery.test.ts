import * as SecureStore from 'expo-secure-store';
import { RealSqliteDatabase } from '@/../test/real-sqlite';
import { makeDeck, fixedClock, sequenceIds } from '@/../test/fixtures';
import { createApplication } from '@/core/application/create-application';
import { createSqliteRepositories } from '@/core/composition/sqlite-repositories';
import { runMigrations } from '@/core/database/migrations';
import { CloudClient } from './cloud-client';
import { SyncStore } from './sync-store';
import { SyncEngine } from './sync-engine';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(Math, 'random').mockReturnValue(0);
  process.env.EXPO_PUBLIC_API_URL = 'https://phase-four.invalid';
  jest
    .mocked(SecureStore.getItemAsync)
    .mockResolvedValue(
      JSON.stringify({
        accessToken: 'synthetic',
        refreshToken: 'synthetic-refresh',
        phoneVerified: true,
        accessExpiresAtUtc: '2099-01-01T00:00:00Z',
      }),
    );
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});
const response = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

test.each(['before commit', 'after commit'])(
  'push body timeout %s retains identity and recovers without duplicate effects',
  async (phase) => {
    const db = await RealSqliteDatabase.open();
    await runMigrations(db);
    const store = new SyncStore(db);
    await store.bind('owner');
    const app = createApplication(createSqliteRepositories(db), fixedClock, sequenceIds());
    await app.createDeck(makeDeck());
    const operation = (await store.pending())[0]!;
    const receipts = new Map<string, number>();
    const delivered: unknown[] = [];
    let effects = 0;
    let stall = true;
    globalThis.fetch = jest.fn(async (url: unknown, init?: RequestInit) => {
      if (String(url).includes('/capabilities')) return response({ version: 2 });
      if (String(url).endsWith('/push')) {
        const change = JSON.parse(String(init?.body)).changes[0];
        delivered.push(change);
        const existing = receipts.get(change.clientChangeId);
        if (!existing && (!stall || phase === 'after commit'))
          receipts.set(change.clientChangeId, ++effects);
        if (stall) {
          stall = false;
          return { ...response({}), json: () => new Promise(() => {}) } as Response;
        }
        return response({
          changes: [
            {
              status: existing ? 'duplicate' : 'applied',
              serverVersion: receipts.get(change.clientChangeId),
            },
          ],
        });
      }
      return response({ cursor: 0, latestVersion: 0, hasMore: false, changes: [] });
    });
    const cloud = new CloudClient();
    const engine = new SyncEngine(store, cloud, async () => true);
    try {
      const first = engine.syncNow();
      await jest.advanceTimersByTimeAsync(12_000);
      await first;
      expect((await store.pending())[0]).toMatchObject({
        operationId: operation.operationId,
        payload: operation.payload,
      });
      expect((await store.counts()).pending).toBe(1);
      await jest.advanceTimersByTimeAsync(500); // Existing jittered backoff, engine inactive until manual retry.
      await engine.syncNow();
      expect(delivered).toHaveLength(2);
      expect(delivered[1]).toEqual(delivered[0]);
      expect(effects).toBe(1);
      expect((await store.counts()).pending).toBe(0);
      const saved = (
        await db.execute('SELECT operation_id, ack_version, status FROM sync_operations')
      ).rows[0];
      expect(saved).toMatchObject({
        operation_id: operation.operationId,
        ack_version: 1,
        status: 'synced',
      });
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      db.handle.close();
    }
  },
);

test('successful push followed by pull-body timeout keeps ACK and leaves cursor unchanged for retry', async () => {
  const db = await RealSqliteDatabase.open();
  await runMigrations(db);
  const store = new SyncStore(db);
  await store.bind('owner');
  const app = createApplication(createSqliteRepositories(db), fixedClock, sequenceIds());
  await app.createDeck(makeDeck());
  let stall = true;
  let late!: (value: unknown) => void;
  const cursors: string[] = [];
  globalThis.fetch = jest.fn(async (url: unknown) => {
    if (String(url).includes('/capabilities')) return response({ version: 2 });
    if (String(url).endsWith('/push'))
      return response({ changes: [{ status: 'applied', serverVersion: 1 }] });
    cursors.push(new URL(String(url)).searchParams.get('cursor')!);
    if (stall) {
      stall = false;
      return {
        ...response({}),
        json: () =>
          new Promise((resolve) => {
            late = resolve;
          }),
      } as Response;
    }
    return response({ cursor: 0, latestVersion: 0, hasMore: false, changes: [] });
  });
  const engine = new SyncEngine(store, new CloudClient(), async () => true);
  try {
    const first = expect(engine.syncNow()).rejects.toMatchObject({ code: 'request_timeout' });
    await jest.advanceTimersByTimeAsync(12_000);
    await first;
    expect(await store.counts()).toMatchObject({ pending: 0 });
    expect((await store.account()).cursor).toBe(0);
    late({ cursor: 99, latestVersion: 99, hasMore: false, changes: [] });
    await jest.advanceTimersByTimeAsync(500);
    await engine.syncNow();
    expect(cursors).toEqual(['0', '0']);
    expect((await store.account()).cursor).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    db.handle.close();
  }
});
