import { AppState } from 'react-native';
import { RealSqliteDatabase } from '@/../test/real-sqlite';
import {
  historySql,
  ReplayMetricsDatabase,
  reviewChanges,
  reviewPages,
  seedReplayDatabase,
} from '@/../test/review-replay-fixture';
import { OpSqliteDatabase } from '@/core/database/op-sqlite-database';
import { PostCommitDatabase } from '@/core/database/post-commit-database';
import * as replay from './review-merge';
import { SyncStore } from './sync-store';
import { SyncEngine } from './sync-engine';
import type { CloudClient } from './cloud-client';
import type { PullPage } from './contract';

jest.mock('expo-network', () => ({
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
}));
function barrier() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
}
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test.each(['COMMIT', 'ROLLBACK'])(
  'page %s failure preserves transaction guards and emits no commit hint',
  async (stage) => {
    const raw = await RealSqliteDatabase.open();
    try {
      const connection = new OpSqliteDatabase('synthetic-replay.db');
      Object.defineProperty(connection, 'database', {
        value: { execute: raw.execute.bind(raw) },
        writable: true,
      });
      await seedReplayDatabase(connection);
      const observed = new ReplayMetricsDatabase(connection);
      const committed = new PostCommitDatabase(observed);
      const hint = jest.fn();
      committed.subscribe(hint);
      raw.failStatement = stage;
      if (stage === 'ROLLBACK')
        observed.afterExecute = (sql) => {
          if (sql.includes(historySql)) throw new Error('replay failed');
        };
      await expect(
        new SyncStore(committed).applyPage(reviewPages(reviewChanges(10))[0]!),
      ).rejects.toThrow(stage === 'ROLLBACK' ? 'Unable to roll back local data' : 'Disk full');
      expect(hint).not.toHaveBeenCalled();
      raw.failStatement = null;
      if (stage === 'ROLLBACK') {
        await expect(connection.execute('SELECT 1')).rejects.toThrow(
          'Database has not been initialized',
        );
        // Test-only cleanup of the isolated raw connection whose wrapper was correctly invalidated.
        raw.handle.run('ROLLBACK');
      }
      expect((await raw.execute('SELECT COUNT(*) AS n FROM review_events')).rows[0]!.n).toBe(0);
      expect(
        (await raw.execute('SELECT cursor,applying_remote FROM sync_account')).rows[0],
      ).toEqual({ cursor: 0, applying_remote: 0 });
      expect(
        (await raw.execute('SELECT total_reviews FROM card_review_state')).rows[0]!.total_reviews,
      ).toBe(0);
      expect((await raw.execute('SELECT * FROM review_replay_baselines')).rows).toEqual([]);
    } finally {
      raw.handle.close();
    }
  },
);

test('replay computation failure rolls back the page and retries the original event identities', async () => {
  const db = await RealSqliteDatabase.open();
  try {
    await seedReplayDatabase(db);
    const page = reviewPages(reviewChanges(10))[0]!;
    const merge = jest.spyOn(replay, 'mergeReviewEvents').mockImplementationOnce(() => {
      throw new Error('projection failed');
    });
    await expect(new SyncStore(db).applyPage(page)).rejects.toThrow('projection failed');
    expect((await db.execute('SELECT * FROM review_events')).rows).toEqual([]);
    expect((await new SyncStore(db).account()).cursor).toBe(0);
    await new SyncStore(db).applyPage(page);
    expect(merge).toHaveBeenCalledTimes(2);
    expect(
      (await db.execute('SELECT id FROM review_events ORDER BY rowid')).rows.map((r) => r.id),
    ).toEqual(page.changes.map((c) => c.entityId));
  } finally {
    db.handle.close();
  }
});

test.each(['owner switch', 'logout'])(
  '%s while replay awaits storage cannot redirect or publish obsolete work',
  async (transition) => {
    const a = await RealSqliteDatabase.open(),
      b = await RealSqliteDatabase.open();
    let stop = () => {};
    const release = barrier(),
      entered = barrier();
    try {
      await seedReplayDatabase(a);
      await seedReplayDatabase(b);
      const observed = new ReplayMetricsDatabase(a),
        aDb = new PostCommitDatabase(observed);
      const stores = [new SyncStore(aDb), new SyncStore(b)];
      await stores[0]!.bind('a');
      await stores[1]!.bind('b');
      let current = 0,
        revision = 0,
        account = true,
        changed = () => {};
      const empty: PullPage = { cursor: 0, latestVersion: 0, hasMore: false, changes: [] };
      const cloud = {
        available: true,
        hasSession: jest.fn(async () => true),
        cancelRequests: jest.fn(),
        ensureSchedulingContract: jest.fn(async () => {}),
        pull: jest.fn(async () => empty),
        signOut: jest.fn(async () => ({
          synchronized: false,
          serverRevoked: true,
          credentialsCleared: true,
          retryAvailable: false,
        })),
      };
      const published = jest.fn(async () => {});
      Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
      jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
      const engine = new SyncEngine(
        stores[0]!,
        cloud as unknown as CloudClient,
        async () => true,
        published,
        {
          isAccount: () => account,
          enterAccount: async () => {},
          enterGuest: async () => {
            account = false;
          },
        },
        undefined,
        {
          capture: () => {
            const version = revision,
              store = stores[current]!;
            return {
              store,
              assertCurrent: () => {
                if (version !== revision) throw new Error('Stale owner');
              },
            };
          },
          subscribeChanges: (listener) => aDb.subscribe(listener),
          subscribeOwner: (listener) => {
            changed = listener;
            return () => {};
          },
        },
      );
      stop = engine.start();
      await engine.syncNow();
      cloud.pull.mockResolvedValueOnce(reviewPages(reviewChanges(10))[0]!);
      observed.afterExecute = async (sql) => {
        if (sql.includes(historySql)) {
          entered.resolve();
          await release.promise;
        }
      };
      const running = engine.syncNow();
      const rejected = expect(running).rejects.toThrow();
      await entered.promise;
      if (transition === 'owner switch') {
        current = 1;
        revision++;
        changed();
      } else await engine.signOut();
      release.resolve();
      await rejected;
      // Already issued atomic work is allowed to finish in A, but never reaches B or UI publication.
      expect((await stores[0]!.account()).cursor).toBe(10);
      expect((await stores[1]!.account()).cursor).toBe(0);
      expect((await b.execute('SELECT * FROM review_events')).rows).toEqual([]);
      expect(published).not.toHaveBeenCalled();
      expect((await stores[0]!.counts()).pending).toBe(0);
    } finally {
      release.resolve();
      stop();
      a.handle.close();
      b.handle.close();
    }
  },
);
