import {
  LearningAccessController,
  localLearningUsage,
  serverEntitlementCache,
} from './learning-access';
import { createApplication } from '@/core/application/create-application';
import { installFreeTierGuards } from '@/core/database/free-tier-guards';
import { readEntitlementCache, writeEntitlementCache } from '@/core/database/entitlement-cache';
import { runMigrations } from '@/core/database/migrations';
import { createSqliteRepositories } from '@/core/composition/sqlite-repositories';
import { RealSqliteDatabase } from '@/../test/real-sqlite';
import {
  fixedClock,
  sequenceIds,
  makeCard,
  makeDeck,
  makeRepositories,
  makeState,
} from '@/../test/fixtures';
import type { Entitlements } from '@/core/sync/subscription';
import { csvAdapter } from '@/features/transfer/data/csv-adapter';
import { createTransferService } from '@/features/transfer/application/transfer-service';
import { strToU8 } from 'fflate';

const owner = '11111111-1111-1111-1111-111111111111';
const other = '22222222-2222-2222-2222-222222222222';
const all = { kind: 'all-decks' as const };

test('foreground events refresh once per minute while study uses saved access', async () => {
  let now = Date.now();
  const fetch = jest.fn(async () => response(now));
  const access = new LearningAccessController({
    userId: owner,
    usage: async () => ({ decks: 0, cards: 0 }),
    online: async () => true,
    fetch,
    now: () => now,
  });
  await Promise.all(Array.from({ length: 30 }, () => access.refreshIfStale()));
  await access.refreshIfStale();
  expect(fetch).toHaveBeenCalledTimes(1);
  await access.assertAllowed('study');
  expect(fetch).toHaveBeenCalledTimes(1);
  now += 60_000;
  await access.refreshIfStale();
  expect(fetch).toHaveBeenCalledTimes(2);
});

test('background failures back off and permission invalidation clears the cooldown', async () => {
  let now = Date.now();
  const fetch = jest.fn(async (): Promise<Entitlements> => {
    throw new Error('unavailable');
  });
  const access = new LearningAccessController({
    userId: owner,
    usage: async () => ({ decks: 0, cards: 0 }),
    online: async () => true,
    fetch,
    now: () => now,
  });
  await access.refreshIfStale();
  now += 29_999;
  await access.refreshIfStale();
  expect(fetch).toHaveBeenCalledTimes(1);
  now++;
  await access.refreshIfStale();
  now += 30_000;
  await access.refreshIfStale();
  expect(fetch).toHaveBeenCalledTimes(2);
  await access.invalidate('permissions changed');
  await access.refreshIfStale();
  expect(fetch).toHaveBeenCalledTimes(3);
});

test('local study does not wait for an in-flight metadata refresh', async () => {
  let finish!: (value: Entitlements) => void;
  const fetch = jest
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Entitlements>((resolve) => {
          finish = resolve;
        }),
    )
    .mockImplementation(async () => response(Date.now()));
  const access = new LearningAccessController({
    userId: owner,
    usage: async () => ({ decks: 0, cards: 0 }),
    online: async () => true,
    fetch,
  });
  const background = access.refreshIfStale();
  while (!fetch.mock.calls.length) await Promise.resolve();
  await access.assertAllowed('study');
  finish(response(Date.now()));
  await background;
  expect(fetch.mock.calls.map(([operation]) => operation)).toEqual([undefined]);
});

function response(time: number, plus = false, decks = 1, cards = 50): Entitlements {
  return {
    currentPlan: plus ? 'Plus' : 'Free',
    isActive: plus,
    startsAtUtc: plus ? new Date(time - 1000).toISOString() : null,
    expiresAtUtc: plus ? new Date(time + 60_000).toISOString() : null,
    limits: plus ? { decks: null, cards: null } : { decks: 1, cards: 50 },
    features: { unlimitedDecks: plus, unlimitedCards: plus },
    isPurchasable: false,
    purchaseSupported: false,
    withinFreeTierLimits: decks <= 1 && cards <= 50,
    usage: { decks, cards },
    validatedAtUtc: new Date(time).toISOString(),
  };
}

async function sqlite(userId = '') {
  const database = await RealSqliteDatabase.open();
  await runMigrations(database);
  await installFreeTierGuards(database);
  await database.execute('UPDATE sync_account SET user_id = ? WHERE id = 1', [userId]);
  return { database, repositories: createSqliteRepositories(database) };
}

test('guest has offline creation, edit and study at exactly one deck/fifty cards; excess creation preserves all data', async () => {
  const { database, repositories } = await sqlite();
  const fetch = jest.fn();
  const access = new LearningAccessController({
    userId: null,
    usage: localLearningUsage(repositories),
    fetch,
  });
  const app = createApplication(
    repositories,
    fixedClock,
    sequenceIds(),
    undefined,
    undefined,
    access,
  );
  const deck = await app.createDeck(makeDeck());
  for (let index = 0; index < 50; index++) await app.createCard({ ...makeCard(), deckId: deck.id });
  const session = await app.startStudySession(all);
  expect(session.initialQueue).toHaveLength(50);
  await expect(app.createDeck(makeDeck())).rejects.toMatchObject({ code: 'free-tier-limit' });
  await expect(app.createCard({ ...makeCard(), deckId: deck.id })).rejects.toMatchObject({
    code: 'free-tier-limit',
  });
  await expect(app.updateDeck(deck.id, { name: 'Edited' })).resolves.toMatchObject({
    name: 'Edited',
  });
  expect(await repositories.cards.countByDeck(deck.id)).toBe(50);
  expect(fetch).not.toHaveBeenCalled();
  const store = await database.execute('SELECT user_id FROM sync_account');
  expect(store.rows[0]?.user_id).toBe('');
});

test.each(['deck', 'card', 'study'] as const)(
  'free authenticated %s uses local quantities independently of cloud usage',
  async (operation) => {
    const fetch = jest.fn(async () => response(Date.now(), false, 2, 51));
    const access = new LearningAccessController({
      userId: owner,
      usage: async () => ({ decks: 0, cards: 0 }),
      online: async () => true,
      fetch,
    });
    await access.refresh();
    await expect(access.assertAllowed(operation)).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(1);
  },
);

test('real SQLite Plus creation and review above free limits fall back at expiry without changing content, history or allowing continued study', async () => {
  const { database, repositories } = await sqlite(owner);
  let active = true;
  const access = new LearningAccessController({
    userId: owner,
    usage: localLearningUsage(repositories),
    online: async () => true,
    fetch: async () => response(Date.now(), active, 2, 51),
    writeCache: (cache) => writeEntitlementCache(database, owner, cache),
  });
  const app = createApplication(
    repositories,
    fixedClock,
    sequenceIds(),
    undefined,
    undefined,
    access,
  );
  await access.refresh();
  const deck = await app.createDeck(makeDeck());
  await app.createDeck(makeDeck());
  for (let index = 0; index < 51; index++) await app.createCard({ ...makeCard(), deckId: deck.id });
  const session = await app.startStudySession(all);
  const item = (await app.getCurrentStudyItem(session.id))!;
  await app.submitStudyAnswer({
    sessionId: session.id,
    cardId: item.cardId,
    presentationId: item.presentationId,
    result: 'success',
  });
  const previousState = await app.getReviewState(item.cardId);
  active = false;
  await access.refresh();
  for (const action of [
    () => app.getStudySnapshot(session.id),
    () => app.getCurrentStudyItem(session.id),
    () => app.startStudySession(all),
    () => app.reviewMissedCards(session.id),
    () =>
      app.reviewCard({
        cardId: item.cardId,
        deckId: deck.id,
        result: 'success',
        studySessionId: null,
      }),
    () =>
      app.submitStudyAnswer({
        sessionId: session.id,
        cardId: item.cardId,
        presentationId: item.presentationId,
        result: 'success',
      }),
    () => app.createCard({ ...makeCard(), deckId: deck.id }),
    () => app.createDeck(makeDeck()),
  ])
    await expect(action()).rejects.toMatchObject({ code: 'free-tier-limit' });
  expect(await app.listDecks()).toHaveLength(2);
  expect(await app.listCardsForDeck(deck.id)).toHaveLength(51);
  expect(await app.listReviewEvents()).toHaveLength(1);
  expect(await app.getReviewState(item.cardId)).toEqual(previousState);
  await expect(app.updateCard(item.cardId, { meaning: 'Edited' })).resolves.toMatchObject({
    meaning: 'Edited',
  });
  const transfer = createTransferService(app, repositories, {
    csv: csvAdapter,
    xlsx: csvAdapter,
    apkg: csvAdapter,
  });
  expect((await transfer.export('csv')).length).toBeGreaterThan(0);
  await expect(repositories.decks.create(makeDeck({ id: 'direct' }))).rejects.toMatchObject({
    code: 'free-tier-limit',
  });
  await expect(repositories.reviews.saveState({ ...previousState!, box: 3 })).rejects.toMatchObject(
    { code: 'free-tier-limit' },
  );
  await expect(app.cancelStudySession(session.id)).resolves.toMatchObject({ status: 'cancelled' });
});

test('offline Plus is explicitly provisional and expires at the server-relative boundary; unknown status never grants Plus', async () => {
  let time = Date.now();
  const start = time;
  let online = true;
  const access = new LearningAccessController({
    userId: owner,
    usage: async () => ({ decks: 2, cards: 51 }),
    now: () => time,
    online: async () => online,
    fetch: async () => response(start, true, 2, 51),
  });
  await access.refresh();
  await access.assertAllowed('study');
  online = false;
  await access.refresh();
  time = start + 59_999;
  await access.assertAllowed('study');
  expect(access.snapshot().provisional).toBe(true);
  expect(access.snapshot().message).toContain('not server-confirmed');
  time++;
  await expect(access.assertAllowed('study')).rejects.toMatchObject({ code: 'free-tier-limit' });
  const unknown = new LearningAccessController({
    userId: other,
    usage: async () => ({ decks: 2, cards: 51 }),
    online: async () => false,
  });
  await expect(unknown.assertAllowed('study')).rejects.toMatchObject({ code: 'free-tier-limit' });
  const free = new LearningAccessController({
    userId: other,
    usage: async () => ({ decks: 1, cards: 50 }),
    online: async () => false,
  });
  await expect(free.assertAllowed('study')).resolves.toBeUndefined();
  await expect(free.assertAllowed('card')).rejects.toMatchObject({ code: 'free-tier-limit' });
});

test('stale responses and network errors preserve access until expiry; clock rollback does not grant access', async () => {
  let time = Date.now();
  const initial = time;
  const fetch = jest.fn(async () => ({
    ...response(initial, true, 2, 51),
    expiresAtUtc: new Date(initial + 86_400_000).toISOString(),
  }));
  const access = new LearningAccessController({
    userId: owner,
    usage: async () => ({ decks: 2, cards: 51 }),
    now: () => time,
    online: async () => true,
    fetch,
  });
  await access.refresh();
  await access.assertAllowed('study');
  time = initial + 1000;
  fetch.mockResolvedValue({
    ...response(initial - 1, true, 2, 51),
    expiresAtUtc: new Date(initial + 86_400_000).toISOString(),
  });
  await access.refresh();
  await access.assertAllowed('study');
  expect(access.snapshot().provisional).toBe(true);
  time = initial + 86_400_000;
  await expect(access.assertAllowed('study')).rejects.toMatchObject({ code: 'free-tier-limit' });
  fetch.mockRejectedValue(new Error('network failure'));
  time = initial - 1;
  await expect(access.assertAllowed('study')).rejects.toMatchObject({ code: 'free-tier-limit' });
});

test.each([401, 403])(
  'server %s invalidates cached paid access instead of falling back to it',
  async (status) => {
    const writeCache = jest.fn(async () => {});
    const time = Date.now();
    const access = new LearningAccessController({
      userId: owner,
      usage: async () => ({ decks: 2, cards: 51 }),
      online: async () => true,
      readCache: async () => serverEntitlementCache(response(time, true, 2, 51), time),
      writeCache,
      fetch: async () => {
        throw Object.assign(new Error('Server denied access'), { status });
      },
    });
    await expect(access.refresh('study')).rejects.toMatchObject({
      code: status === 403 ? 'free-tier-limit' : 'unavailable',
    });
    expect(writeCache).toHaveBeenCalledWith(null);
    expect(access.snapshot().entitlements).toBeNull();
  },
);

test('late responses after switching accounts cannot cache or expose permissions', async () => {
  let resolve!: (value: Entitlements) => void;
  let selected = true;
  const writeCache = jest.fn(async () => {});
  const fetch = jest.fn(
    () =>
      new Promise<Entitlements>((done) => {
        resolve = done;
      }),
  );
  const access = new LearningAccessController({
    userId: owner,
    usage: async () => ({ decks: 2, cards: 51 }),
    online: async () => true,
    fetch,
    writeCache,
    assertCurrent: () => {
      if (!selected) throw new Error('Account changed');
    },
  });
  const operation = access.refresh('study');
  while (!fetch.mock.calls.length) await Promise.resolve();
  selected = false;
  resolve(response(Date.now(), true, 2, 51));
  await expect(operation).rejects.toThrow('Account changed');
  expect(writeCache).not.toHaveBeenCalled();
  expect(access.snapshot().entitlements).toBeNull();
});

test('a late paid response cannot reverse a concurrent server rejection for the same account', async () => {
  let resolve!: (value: Entitlements) => void;
  const writeCache = jest.fn(async () => {});
  const fetch = jest.fn(
    () =>
      new Promise<Entitlements>((done) => {
        resolve = done;
      }),
  );
  const access = new LearningAccessController({
    userId: owner,
    usage: async () => ({ decks: 2, cards: 51 }),
    online: async () => true,
    fetch,
    writeCache,
  });
  const request = access.refresh('study');
  while (!fetch.mock.calls.length) await Promise.resolve();
  await access.invalidate('Server rejected this subscription.');
  resolve(response(Date.now(), true, 2, 51));
  await expect(request).rejects.toMatchObject({ code: 'unavailable' });
  expect(writeCache).toHaveBeenCalledTimes(1);
  expect(writeCache).toHaveBeenCalledWith(null);
  expect(access.snapshot().entitlements).toBeNull();
});

test('an identical replayed server timestamp cannot renew paid access forever', async () => {
  let time = Date.now();
  const start = time;
  const paid = {
    ...response(start, true, 2, 51),
    expiresAtUtc: new Date(start + 86_400_000).toISOString(),
  };
  const access = new LearningAccessController({
    userId: owner,
    usage: async () => ({ decks: 2, cards: 51 }),
    now: () => time,
    online: async () => true,
    fetch: async () => paid,
  });
  await access.refresh();
  await access.assertAllowed('study');
  time += 86_400_000;
  await access.refresh();
  await expect(access.assertAllowed('study')).rejects.toMatchObject({ code: 'free-tier-limit' });
});

test('invalidation while restoring an offline cache cannot resurrect the old paid lease', async () => {
  let resolve!: (value: ReturnType<typeof serverEntitlementCache>) => void;
  const readCache = jest.fn(
    () =>
      new Promise<ReturnType<typeof serverEntitlementCache>>((done) => {
        resolve = done;
      }),
  );
  const now = Date.now();
  const access = new LearningAccessController({
    userId: owner,
    usage: async () => ({ decks: 2, cards: 51 }),
    online: async () => false,
    readCache,
  });
  const refresh = access.refresh();
  await access.invalidate('Access revoked.');
  resolve(serverEntitlementCache(response(now, true, 2, 51), now));
  await expect(refresh).rejects.toMatchObject({ code: 'unavailable' });
  expect(access.snapshot().entitlements).toBeNull();
  await expect(access.assertAllowed('study')).rejects.toMatchObject({ code: 'free-tier-limit' });
});

test('request latency cannot extend a Plus subscription past its server-relative expiration', async () => {
  let time = Date.now();
  const start = time;
  const access = new LearningAccessController({
    userId: owner,
    usage: async () => ({ decks: 2, cards: 51 }),
    now: () => time,
    online: async () => true,
    fetch: async () => {
      time = start + 1001;
      return {
        ...response(start, true, 2, 51),
        expiresAtUtc: new Date(start + 1000).toISOString(),
      };
    },
  });
  await access.refresh();
  await expect(access.assertAllowed('study')).rejects.toMatchObject({ code: 'free-tier-limit' });
  expect(access.snapshot().entitlements).toBeNull();
  expect(access.snapshot().provisional).toBe(true);
});

test('account-scoped cache survives restart without authorizing guests or another account and expired SQLite leases block growth', async () => {
  const { database } = await sqlite(owner);
  const now = Date.now();
  await writeEntitlementCache(database, owner, serverEntitlementCache(response(now, true), now));
  const restored = await RealSqliteDatabase.open(database.handle.export());
  await installFreeTierGuards(restored);
  expect((await readEntitlementCache(restored, owner))?.entitlements.currentPlan).toBe('Plus');
  expect(await readEntitlementCache(restored, other)).toBeNull();
  const repositories = createSqliteRepositories(restored);
  await repositories.decks.create(makeDeck());
  await repositories.decks.create(makeDeck({ id: 'second' }));
  await restored.execute('UPDATE sync_account SET user_id = ? WHERE id = 1', [other]);
  await expect(repositories.decks.create(makeDeck({ id: 'third' }))).rejects.toMatchObject({
    code: 'free-tier-limit',
  });
  await restored.execute("UPDATE sync_account SET user_id = '' WHERE id = 1");
  await expect(repositories.decks.create(makeDeck({ id: 'guest' }))).rejects.toMatchObject({
    code: 'free-tier-limit',
  });
  await restored.execute('UPDATE sync_account SET user_id = ? WHERE id = 1', [owner]);
  await restored.execute('UPDATE local_entitlements SET valid_until_ms = 0');
  await expect(repositories.decks.create(makeDeck({ id: 'expired' }))).rejects.toMatchObject({
    code: 'free-tier-limit',
  });
  expect(await repositories.decks.list()).toHaveLength(2);
});

test('a week-old subscription and legacy cache support offline decks, study and saved answers across restarts', async () => {
  const { database, repositories } = await sqlite(owner);
  const weekAgo = Date.now() - 7 * 86_400_000;
  const paid = {
    ...response(weekAgo, true, 2, 51),
    expiresAtUtc: new Date(weekAgo + 30 * 86_400_000).toISOString(),
  };
  await writeEntitlementCache(database, owner, serverEntitlementCache(paid, weekAgo));
  await repositories.decks.create(makeDeck());
  await repositories.decks.create(makeDeck({ id: 'second' }));
  for (let index = 0; index < 51; index++) {
    await repositories.cards.create(makeCard({ id: `card-${index}` }));
    await repositories.reviews.saveState(makeState({ cardId: `card-${index}` }));
  }
  // Simulate an installation upgrading from the former five-minute cache.
  await database.execute('UPDATE local_entitlements SET valid_until_ms = fetched_at_ms + 300000');
  const restored = await RealSqliteDatabase.open(database.handle.export());
  await installFreeTierGuards(restored);
  const local = createSqliteRepositories(restored);
  const fetch = jest.fn(async (): Promise<Entitlements> => {
    throw new Error('Backend is off');
  });
  const access = new LearningAccessController({
    userId: owner,
    usage: localLearningUsage(local),
    readCache: () => readEntitlementCache(restored, owner),
    online: async () => true,
    fetch,
  });
  const app = createApplication(local, fixedClock, sequenceIds(), undefined, undefined, access);
  expect((await app.getHomeSummary()).decks).toHaveLength(2);
  const session = await app.startStudySession(all);
  expect(session.initialQueue).toHaveLength(51);
  const item = (await app.getCurrentStudyItem(session.id))!;
  await app.submitStudyAnswer({
    sessionId: session.id,
    cardId: item.cardId,
    presentationId: item.presentationId,
    result: 'success',
  });
  await app.createDeck(makeDeck({ name: 'Offline deck' }));
  expect(fetch).not.toHaveBeenCalled();
  await access.refresh();
  await expect(access.assertAllowed('study')).resolves.toBeUndefined();
  expect(fetch).toHaveBeenCalledTimes(1);
  const next = await RealSqliteDatabase.open(restored.handle.export());
  await installFreeTierGuards(next);
  const nextRepositories = createSqliteRepositories(next);
  const nextAccess = new LearningAccessController({
    userId: owner,
    usage: localLearningUsage(nextRepositories),
    readCache: () => readEntitlementCache(next, owner),
  });
  const nextApp = createApplication(
    nextRepositories,
    fixedClock,
    sequenceIds(),
    undefined,
    undefined,
    nextAccess,
  );
  expect((await nextApp.getHomeSummary()).decks).toHaveLength(3);
  expect((await nextApp.getStudySnapshot(session.id)).progress.completed).toBe(1);
  expect(await nextApp.getReviewState(item.cardId)).toMatchObject({ totalReviews: 1 });
});

test('legacy Free status remains available offline after upgrading the five-minute cache', async () => {
  const { database } = await sqlite(owner);
  const weekAgo = Date.now() - 7 * 86_400_000;
  await writeEntitlementCache(database, owner, serverEntitlementCache(response(weekAgo), weekAgo));
  await database.execute('UPDATE local_entitlements SET valid_until_ms = fetched_at_ms + 300000');
  await installFreeTierGuards(database);
  const access = new LearningAccessController({
    userId: owner,
    usage: async () => ({ decks: 1, cards: 50 }),
    readCache: () => readEntitlementCache(database, owner),
  });
  await access.assertAllowed('study');
  expect(access.snapshot().entitlements?.currentPlan).toBe('Free');
  await expect(access.assertAllowed('deck')).rejects.toMatchObject({ code: 'free-tier-limit' });
});

test('SQLite and local access use the same expiry for server timestamps with fractional seconds', async () => {
  const { database, repositories } = await sqlite(owner);
  const now = Date.now();
  const base = new Date(now).toISOString().slice(0, 19);
  const paid = {
    ...response(now, true),
    startsAtUtc: new Date(now - 86_400_000).toISOString(),
    validatedAtUtc: `${base}.9995000Z`,
    expiresAtUtc: `${new Date(now + 86_400_000).toISOString().slice(0, 19)}.0001000Z`,
  };
  const cache = serverEntitlementCache(paid, now);
  await writeEntitlementCache(database, owner, cache);
  await repositories.decks.create(makeDeck());
  await repositories.decks.create(makeDeck({ id: 'second' }));
  await database.execute('UPDATE local_entitlements SET valid_until_ms = fetched_at_ms + 300000');
  await installFreeTierGuards(database);
  expect((await readEntitlementCache(database, owner))?.validUntil).toBe(cache.validUntil);
  await repositories.decks.create(makeDeck({ id: 'third' }));
});

test('SQLite cache writers cannot renew a replayed lease or overwrite a newer free response, including competing writers', async () => {
  const { database } = await sqlite(owner);
  const now = Date.now();
  const paid = response(now, true, 2, 51);
  const original = await writeEntitlementCache(database, owner, serverEntitlementCache(paid, now));
  const replay = await writeEntitlementCache(
    database,
    owner,
    serverEntitlementCache(paid, now + 1000),
  );
  expect(replay?.validUntil).toBe(original?.validUntil);
  const newerFree = response(now + 2000, false, 2, 51);
  await Promise.all([
    writeEntitlementCache(database, owner, serverEntitlementCache(newerFree, now + 2000)),
    writeEntitlementCache(
      database,
      owner,
      serverEntitlementCache(response(now + 1000, true, 2, 51), now + 1000),
    ),
  ]);
  expect((await readEntitlementCache(database, owner))?.entitlements.currentPlan).toBe('Free');
  await expect(
    writeEntitlementCache(
      database,
      owner,
      serverEntitlementCache(response(now + 2000, true, 2, 51), now + 2000),
    ),
  ).rejects.toMatchObject({ code: 'unavailable' });
  await database.execute("UPDATE local_entitlements SET response_json = 'corrupt cache'");
  await expect(
    writeEntitlementCache(
      database,
      owner,
      serverEntitlementCache(response(now + 3000), now + 3000),
    ),
  ).resolves.toMatchObject({ entitlements: { currentPlan: 'Free' } });
});

test('bulk import preflight rejects an over-limit dataset without partial content and legacy guest excess blocks study, not editing/export', async () => {
  const repositories = makeRepositories();
  await repositories.decks.create(makeDeck());
  for (let index = 0; index < 49; index++) {
    await repositories.cards.create(makeCard({ id: `card-${index}` }));
    await repositories.reviews.saveState(makeState({ cardId: `card-${index}` }));
  }
  const app = createApplication(repositories, fixedClock, sequenceIds());
  const transfer = createTransferService(app, repositories, {
    csv: csvAdapter,
    xlsx: csvAdapter,
    apkg: csvAdapter,
  });
  const preview = await transfer.preview(
    'csv',
    strToU8('Deck,Front,Back\nVocabulary,new,a\nVocabulary,newer,b'),
    'test.csv',
  );
  await expect(transfer.confirm(preview)).rejects.toMatchObject({ code: 'free-tier-limit' });
  expect(await repositories.cards.countByDeck('deck-1')).toBe(49);
  await repositories.decks.create(makeDeck({ id: 'legacy-excess' }));
  expect((await app.getHomeSummary()).decks).toHaveLength(2);
  expect(await app.previewStudyQueue({ scope: all, targetDate: makeState().dueDate })).toHaveLength(
    49,
  );
  await expect(app.startStudySession(all)).rejects.toMatchObject({ code: 'free-tier-limit' });
  await expect(
    app.getStudyQueue({ scope: all, targetDate: makeState().dueDate }),
  ).rejects.toMatchObject({ code: 'free-tier-limit' });
  await expect(
    app.reviewCard({ cardId: 'card-0', deckId: 'deck-1', result: 'success', studySessionId: null }),
  ).rejects.toMatchObject({ code: 'free-tier-limit' });
  await expect(app.updateDeck('deck-1', { name: 'Updated' })).resolves.toMatchObject({
    name: 'Updated',
  });
  expect((await transfer.export('csv')).length).toBeGreaterThan(0);
  await app.archiveDeck('legacy-excess');
  expect((await app.startStudySession(all)).initialQueue).toHaveLength(49);
});
