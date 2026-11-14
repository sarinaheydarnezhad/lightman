import { AppState, type AppStateStatus } from 'react-native';
import * as Network from 'expo-network';
import { RealSqliteDatabase } from '@/../test/real-sqlite';
import { fixedClock, sequenceIds, makeCard, makeDeck } from '@/../test/fixtures';
import { runMigrations } from '@/core/database/migrations';
import { PostCommitDatabase } from '@/core/database/post-commit-database';
import { createSqliteRepositories } from '@/core/composition/sqlite-repositories';
import { createApplication } from '@/core/application/create-application';
import { CloudError, type CloudClient } from './cloud-client';
import { SyncEngine } from './sync-engine';
import { SyncStore } from './sync-store';
import type { PendingOperation, PullPage } from './contract';
import { createTransferService } from '@/features/transfer/application/transfer-service';
import { csvAdapter } from '@/features/transfer/data/csv-adapter';
import { strToU8 } from 'fflate';

jest.mock('expo-network', () => ({ addNetworkStateListener: jest.fn() }));

function barrier<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const page: PullPage = { cursor: 0, latestVersion: 0, hasMore: false, changes: [] };
const disposals: (() => void)[] = [];
let foreground: (state: AppStateStatus) => void;

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(Math, 'random').mockReturnValue(0);
  Object.defineProperty(AppState, 'currentState', {
    configurable: true,
    value: 'active',
    writable: true,
  });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_name, listener) => {
    foreground = listener;
    return { remove: jest.fn() };
  });
  jest.mocked(Network.addNetworkStateListener).mockReturnValue({ remove: jest.fn() });
});
afterEach(() => {
  disposals
    .splice(0)
    .reverse()
    .forEach((dispose) => dispose());
  jest.restoreAllMocks();
  jest.useRealTimers();
});

async function fixture(
  options: { online?: boolean; guest?: boolean; silent?: boolean; available?: boolean } = {},
) {
  // SQL.js uses Math.random for its virtual filename; preserve independent owner files.
  jest.spyOn(Math, 'random').mockRestore();
  const raw = await RealSqliteDatabase.open();
  jest.spyOn(Math, 'random').mockReturnValue(0);
  disposals.push(() => raw.handle.close());
  await runMigrations(raw);
  const db = new PostCommitDatabase(raw);
  const store = new SyncStore(db);
  await store.bind('owner-a');
  const app = createApplication(
    createSqliteRepositories(db),
    fixedClock,
    sequenceIds(),
    undefined,
    undefined,
    { assertAllowed: async () => {} },
  );
  let connected = options.online !== false;
  let account = !options.guest;
  let revision = 0;
  let version = 0;
  let changed = () => {};
  const cloud = {
    available: options.available !== false,
    hasSession: jest.fn(async () => true),
    cancelRequests: jest.fn(),
    ensureSchedulingContract: jest.fn(async () => {}),
    push: jest.fn(async (_operation: PendingOperation, _device: string, _owner: string) => ({
      changes: [{ serverVersion: ++version }],
    })),
    pull: jest.fn(async (_cursor: number): Promise<PullPage> => page),
    signOut: jest.fn(async () => ({
      synchronized: false,
      serverRevoked: false,
      credentialsCleared: true,
      retryAvailable: true,
    })),
  };
  const engine = new SyncEngine(
    store,
    cloud as unknown as CloudClient,
    async () => connected,
    undefined,
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
        const captured = revision;
        return {
          store,
          assertCurrent: () => {
            if (revision !== captured) throw new Error('Stale owner');
          },
        };
      },
      subscribeChanges: (listener) => (options.silent ? () => {} : db.subscribe(listener)),
      subscribeOwner: (listener) => {
        changed = listener;
        return () => {
          changed = () => {};
        };
      },
    },
  );
  const stop = engine.start();
  disposals.push(stop);
  await engine.syncNow();
  return {
    raw,
    db,
    store,
    app,
    cloud,
    engine,
    stop,
    connect: () => {
      connected = true;
      reconnect();
    },
    changeOwner: () => {
      revision++;
      account = false;
      changed();
    },
  };
}

function reconnect() {
  jest
    .mocked(Network.addNetworkStateListener)
    .mock.calls.at(-1)![0]({
      type: 'WIFI' as Network.NetworkStateType,
      isConnected: true,
      isInternetReachable: true,
    });
}
async function wake() {
  await jest.advanceTimersByTimeAsync(250);
}

test('committed mutations after repeated completed runs receive acknowledgements', async () => {
  const f = await fixture();
  for (let index = 0; index < 3; index++) {
    await f.app.createDeck(makeDeck({ name: `Deck ${index}` }));
    await wake();
    expect((await f.store.counts()).pending).toBe(0);
  }
  expect(f.cloud.push).toHaveBeenCalledTimes(3);
});

test.each(['push', 'pull', 'completion'] as const)(
  'mutation during %s is not erased by run completion',
  async (stage) => {
    const f = await fixture();
    const gate = barrier<void>();
    const entered = barrier<void>();
    if (stage === 'push')
      f.cloud.push.mockImplementationOnce(async () => {
        entered.resolve();
        await gate.promise;
        return { changes: [{ serverVersion: 1 }] };
      });
    else
      f.cloud.pull.mockImplementationOnce(async () => {
        entered.resolve();
        await gate.promise;
        return page;
      });
    await f.app.createDeck(makeDeck());
    const running = f.engine.syncNow();
    await entered.promise;
    await f.app.createDeck(makeDeck({ name: 'During run' }));
    gate.resolve();
    await running;
    await wake();
    expect(f.cloud.push).toHaveBeenCalledTimes(2);
    expect((await f.store.counts()).pending).toBe(0);
  },
);

test('rapid bulk-style repository writes coalesce, then drain more than one outbox page', async () => {
  const f = await fixture();
  for (let i = 0; i < 32; i++) await f.app.createDeck(makeDeck({ name: `Imported ${i}` }));
  await wake();
  expect(f.cloud.push).toHaveBeenCalledTimes(25);
  await jest.advanceTimersByTimeAsync(750);
  expect(f.cloud.push).toHaveBeenCalledTimes(32);
  expect((await f.store.counts()).pending).toBe(0);
});

test('CSV bulk import commits card and initial-state operations and coalesces its wake-up', async () => {
  const f = await fixture();
  const service = createTransferService(f.app, createSqliteRepositories(f.db), {
    csv: csvAdapter,
    xlsx: csvAdapter,
    apkg: csvAdapter,
  });
  const preview = await service.preview(
    'csv',
    strToU8('Front,Back\none,first\ntwo,second\nthree,third'),
    'Imported.csv',
  );
  expect((await service.confirm(preview)).imported).toBe(3);
  expect(f.cloud.push).not.toHaveBeenCalled();
  await wake();
  expect((await f.store.counts()).pending).toBe(0);
  expect(
    f.cloud.push.mock.calls.filter(([operation]) => operation.entityType === 'card'),
  ).toHaveLength(3);
});

test.each(['direct review', 'study answer'] as const)(
  '%s commits immutable history and wakes synchronization',
  async (kind) => {
    const f = await fixture();
    const deck = await f.app.createDeck(makeDeck());
    const card = await f.app.createCard({ ...makeCard(), deckId: deck.id });
    await wake();
    f.cloud.push.mockClear();
    if (kind === 'direct review')
      await f.app.reviewCard({
        cardId: card.id,
        deckId: deck.id,
        result: 'success',
        studySessionId: null,
      });
    else {
      const session = await f.app.startStudySession({ kind: 'all-decks' });
      const item = await f.app.getCurrentStudyItem(session.id);
      await f.app.submitStudyAnswer({
        sessionId: session.id,
        cardId: card.id,
        presentationId: item!.presentationId,
        result: 'success',
      });
    }
    await wake();
    expect(f.cloud.push.mock.calls.some(([op]) => op.entityType === 'reviewEvent')).toBe(true);
    expect((await f.store.counts()).pending).toBe(0);
    expect(
      (await f.raw.execute('SELECT id, review_calendar_json FROM review_events')).rows,
    ).toHaveLength(1);
  },
);

test('simultaneous manual, reconnect and commit triggers keep one network run active', async () => {
  const f = await fixture();
  const gate = barrier<void>();
  const entered = barrier<void>();
  f.cloud.pull.mockImplementationOnce(async () => {
    entered.resolve();
    await gate.promise;
    return page;
  });
  const first = f.engine.syncNow();
  await entered.promise;
  for (let i = 0; i < 20; i++) {
    expect(f.engine.syncNow()).toBe(first);
    reconnect();
  }
  await f.app.createDeck(makeDeck());
  expect(f.cloud.push).not.toHaveBeenCalled();
  gate.resolve();
  await first;
  await wake();
  expect(f.cloud.push).toHaveBeenCalledTimes(1);
});

test('offline mutation remains durable until foreground reconnect', async () => {
  const f = await fixture({ online: false });
  await f.app.createDeck(makeDeck());
  await wake();
  expect(f.cloud.push).not.toHaveBeenCalled();
  expect((await f.store.counts()).pending).toBe(1);
  f.connect();
  await wake();
  expect((await f.store.counts()).pending).toBe(0);
});

test('background writes wait for foreground; active lifecycle triggers pull even without local work', async () => {
  const f = await fixture();
  AppState.currentState = 'background';
  await f.app.createDeck(makeDeck());
  await wake();
  expect(f.cloud.push).not.toHaveBeenCalled();
  AppState.currentState = 'active';
  foreground('active');
  await wake();
  expect(f.cloud.push).toHaveBeenCalledTimes(1);
  const pulls = f.cloud.pull.mock.calls.length;
  foreground('active');
  await wake();
  expect(f.cloud.pull).toHaveBeenCalledTimes(pulls + 1);
});

test('restart with durable pending work uploads without another mutation', async () => {
  const f = await fixture({ online: false });
  await f.app.createDeck(makeDeck());
  f.stop();
  const restarted = new SyncEngine(f.store, f.cloud as unknown as CloudClient, async () => true);
  disposals.push(restarted.start());
  await restarted.syncNow();
  expect((await f.store.counts()).pending).toBe(0);
});

test.each([0, 429, 503])(
  'transient push %s retries the original identity and honors Retry-After',
  async (status) => {
    const f = await fixture();
    f.cloud.push.mockRejectedValueOnce(
      new CloudError(status, undefined, undefined, undefined, 2_000),
    );
    await f.app.createDeck(makeDeck());
    await wake();
    const before = (await f.store.pending())[0]!;
    await jest.advanceTimersByTimeAsync(1_999);
    expect(f.cloud.push).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    const sent = f.cloud.push.mock.calls;
    expect(sent[1]![0].operationId).toBe(before.operationId);
    expect(sent[1]![0].payload).toEqual(before.payload);
    expect((await f.store.counts()).pending).toBe(0);
  },
);

test.each([400, 403, 422])(
  'permanent push %s is retained as failed without a retry storm',
  async (status) => {
    const f = await fixture();
    f.cloud.push.mockRejectedValue(new CloudError(status));
    await f.app.createDeck(makeDeck());
    await wake();
    await jest.advanceTimersByTimeAsync(180_000);
    expect(f.cloud.push).toHaveBeenCalledTimes(1);
    expect(await f.store.counts()).toMatchObject({ failed: 1, pending: 0 });
  },
);

test('five transient attempts exhaust the existing operation budget and retain failed evidence', async () => {
  const f = await fixture();
  f.cloud.push.mockRejectedValue(new CloudError(503));
  await f.app.createDeck(makeDeck());
  await wake();
  await jest.advanceTimersByTimeAsync(180_000);
  expect(f.cloud.push).toHaveBeenCalledTimes(5);
  expect(await f.store.counts()).toMatchObject({ failed: 1, pending: 0 });
});

test('preflight network failures retry and a successful later capability check recovers', async () => {
  const f = await fixture();
  f.cloud.ensureSchedulingContract.mockRejectedValueOnce(new CloudError(0));
  await f.app.createDeck(makeDeck());
  await wake();
  await jest.advanceTimersByTimeAsync(500);
  expect(f.cloud.push).toHaveBeenCalledTimes(1);
});

test.each([401, 426])(
  'blocked capability/session %s preserves pending work until explicit recovery',
  async (status) => {
    const f = await fixture();
    f.cloud.ensureSchedulingContract.mockRejectedValue(new CloudError(status));
    await f.app.createDeck(makeDeck());
    await wake();
    await jest.advanceTimersByTimeAsync(180_000);
    expect(f.cloud.ensureSchedulingContract).toHaveBeenCalledTimes(2); // startup + blocked attempt
    expect((await f.store.counts()).pending).toBe(1);
    f.cloud.ensureSchedulingContract.mockResolvedValue();
    await f.engine.syncNow();
    expect((await f.store.counts()).pending).toBe(0);
  },
);

test('lost wake-up notification recovers from durable outbox without empty network polling', async () => {
  const f = await fixture({ silent: true });
  await f.app.createDeck(makeDeck());
  await jest.advanceTimersByTimeAsync(59_999);
  expect(f.cloud.push).not.toHaveBeenCalled();
  await jest.advanceTimersByTimeAsync(251);
  expect(f.cloud.push).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(120_000);
  expect(f.cloud.pull).toHaveBeenCalledTimes(2);
});

test('owner change rejects late push before acknowledgement and cancels stale retry work', async () => {
  const f = await fixture();
  const gate = barrier<{ changes: { serverVersion: number }[] }>();
  const entered = barrier<void>();
  f.cloud.push.mockImplementationOnce(async () => {
    entered.resolve();
    return gate.promise;
  });
  await f.app.createDeck(makeDeck());
  const running = f.engine.syncNow();
  await entered.promise;
  f.changeOwner();
  gate.resolve({ changes: [{ serverVersion: 8 }] });
  await expect(running).rejects.toThrow('Stale owner');
  await jest.advanceTimersByTimeAsync(180_000);
  expect((await f.store.counts()).pending).toBe(1);
  expect(f.cloud.push).toHaveBeenCalledTimes(1);
  expect(f.cloud.cancelRequests).toHaveBeenCalled();
});

test('logout during an active push does not acknowledge unfinished work', async () => {
  const f = await fixture();
  const gate = barrier<{ changes: { serverVersion: number }[] }>();
  const entered = barrier<void>();
  f.cloud.push.mockImplementationOnce(async () => {
    entered.resolve();
    return gate.promise;
  });
  await f.app.createDeck(makeDeck());
  const run = f.engine.syncNow();
  await entered.promise;
  await f.engine.signOut();
  gate.resolve({ changes: [{ serverVersion: 1 }] });
  await expect(run).rejects.toMatchObject({ status: 401 });
  expect((await f.store.counts()).pending).toBe(1);
});

test('owner change cancels a backoff timer before it can upload old work', async () => {
  const f = await fixture();
  f.cloud.push.mockRejectedValue(new CloudError(503));
  await f.app.createDeck(makeDeck());
  await wake();
  f.changeOwner();
  await jest.advanceTimersByTimeAsync(180_000);
  expect(f.cloud.push).toHaveBeenCalledTimes(1);
});

test.each([{ guest: true }, { available: false }])(
  'ineligible scope/platform never uploads (%j)',
  async (options) => {
    const f = await fixture(options);
    await f.app.createDeck(makeDeck());
    await jest.advanceTimersByTimeAsync(180_000);
    expect(f.cloud.push).not.toHaveBeenCalled();
    expect(f.cloud.pull).not.toHaveBeenCalled();
  },
);

test('empty and fully acknowledged outboxes create no repeated requests or subscriptions', async () => {
  const f = await fixture();
  expect(f.engine.start()).toBe(f.stop);
  await jest.advanceTimersByTimeAsync(180_000);
  expect(f.cloud.pull).toHaveBeenCalledTimes(1);
  await f.app.createDeck(makeDeck());
  await wake();
  await jest.advanceTimersByTimeAsync(180_000);
  expect(f.cloud.push).toHaveBeenCalledTimes(1);
  expect(f.cloud.pull).toHaveBeenCalledTimes(2);
  f.stop();
  expect(jest.getTimerCount()).toBe(0);
});

test('an obsolete stop handle cannot cancel a restarted engine lifetime', async () => {
  const f = await fixture(); f.stop();
  const stop = f.engine.start(); disposals.push(stop);
  await f.engine.syncNow(); f.stop();
  await f.app.createDeck(makeDeck()); await wake();
  expect(f.cloud.push).toHaveBeenCalledTimes(1);
});

test('post-commit subscription exceptions do not change durable save success', async () => {
  const f = await fixture({ silent: true });
  f.db.subscribe(() => {
    throw new Error('wake failed');
  });
  await expect(f.app.createDeck(makeDeck())).resolves.toBeDefined();
  expect((await f.store.counts()).pending).toBe(1);
  await jest.advanceTimersByTimeAsync(60_250);
  expect((await f.store.counts()).pending).toBe(0);
});

test('rolled-back transaction emits no notification or outbox work', async () => {
  const f = await fixture();
  const listener = jest.fn();
  f.db.subscribe(listener);
  await expect(
    f.db.transaction(async (tx) => {
      await tx.execute(
        "INSERT INTO decks (id, name, description, language, text_alignment, typography_size, created_at, updated_at) VALUES ('x', 'x', '', 'en', 'ltr', 'medium', '2026-11-13T00:00:00Z', '2026-11-13T00:00:00Z')",
      );
      throw new Error('rollback');
    }),
  ).rejects.toThrow('rollback');
  expect(listener).not.toHaveBeenCalled();
  expect((await f.store.counts()).pending).toBe(0);
});

test('post-commit listener runs once after COMMIT, outside the database transaction', async () => {
  const f = await fixture();
  const entered = barrier<void>();
  const finish = barrier<void>();
  const listener = jest.fn();
  f.db.subscribe(listener);
  const transaction = f.db.transaction(async (tx) => {
    await tx.execute('UPDATE sync_account SET cursor = cursor WHERE id = 1');
    entered.resolve();
    await finish.promise;
    expect(listener).not.toHaveBeenCalled();
  });
  await entered.promise;
  expect(listener).not.toHaveBeenCalled();
  finish.resolve();
  await transaction;
  expect(listener).toHaveBeenCalledTimes(1);
});

test('switching A to B captures separate stores; a late A receipt cannot acknowledge either owner incorrectly', async () => {
  const a = await fixture();
  a.stop();
  const b = await fixture();
  b.stop();
  await b.db.execute("UPDATE sync_account SET user_id = 'owner-b' WHERE id = 1");
  await a.app.createDeck(makeDeck({ name: 'A' }));
  await b.app.createDeck(makeDeck({ name: 'B' }));
  let current = a.store;
  let revision = 0;
  let change = () => {};
  const gate = barrier<{ changes: { serverVersion: number }[] }>();
  const entered = barrier<void>();
  a.cloud.push.mockImplementationOnce(async () => {
    entered.resolve();
    return gate.promise;
  });
  const engine = new SyncEngine(
    a.store,
    a.cloud as unknown as CloudClient,
    async () => true,
    undefined,
    undefined,
    undefined,
    {
      capture: () => {
        const store = current;
        const captured = revision;
        return {
          store,
          assertCurrent: () => {
            if (captured !== revision) throw new Error('Stale owner');
          },
        };
      },
      subscribeOwner: (listener) => {
        change = listener;
        return () => {};
      },
    },
  );
  disposals.push(engine.start());
  const run = engine.syncNow();
  await entered.promise;
  current = b.store;
  revision++;
  change();
  gate.resolve({ changes: [{ serverVersion: 88 }] });
  await expect(run).rejects.toThrow('Stale owner');
  await wake();
  expect((await a.store.counts()).pending).toBe(1);
  expect((await b.store.counts()).pending).toBe(0);
  expect(a.cloud.push.mock.calls.map((call) => call[2])).toEqual(['owner-a', 'owner-b']);
  expect(
    (await a.db.execute('SELECT ack_version FROM sync_operations')).rows[0]!.ack_version,
  ).toBeNull();
  expect(
    (await b.db.execute('SELECT ack_version FROM sync_operations')).rows[0]!.ack_version,
  ).not.toBe(88);
});
