import { randomUUID } from 'expo-crypto';
import { RealSqliteDatabase } from '../../../test/real-sqlite';
import { runMigrations } from '@/core/database/migrations';
import { installFreeTierGuards } from '@/core/database/free-tier-guards';
import { instant } from '@/core/domain/values';
import { GuestTransfer } from './guest-transfer';
import { SyncEngine } from './sync-engine';
import { SyncStore } from './sync-store';
import { CloudError, type CloudClient } from './cloud-client';
import { mergeReviewEvents } from './review-merge';
import type { PendingOperation, ServerChange } from './contract';
import type { Entitlements } from './subscription';

jest.mock('expo-network', () => ({ getNetworkStateAsync: jest.fn() }));
jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual<typeof import('node:crypto')>('node:crypto').randomUUID(),
}));
jest.setTimeout(30_000);

const owner = '4b74caaf-f77d-4ebe-9ed4-a87b2694e41a';
const time = '2026-10-01T12:00:00.000Z';

async function database(owned = false) {
  const database = await RealSqliteDatabase.open();
  await runMigrations(database);
  await installFreeTierGuards(database);
  if (owned) await database.execute('UPDATE sync_account SET user_id = ? WHERE id = 1', [owner]);
  return database;
}

async function guestData(guest: RealSqliteDatabase, count = 1, history = true, name = 'Words') {
  const deckId = randomUUID();
  await guest.execute(
    'INSERT INTO decks (id, name, description, language, text_alignment, typography_size, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [deckId, name, 'Guest description', 'en', 'ltr', 'medium', time, time],
  );
  const cards: string[] = [];
  for (let index = 0; index < count; index++) {
    const cardId = randomUUID();
    cards.push(cardId);
    await guest.execute(
      'INSERT INTO cards (id, deck_id, front_text, meaning, phonetic, category, examples_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        cardId,
        deckId,
        'same text',
        'same meaning',
        '/same/',
        'Vocabulary',
        '[{"sentence":"A sentence.","translation":"A translation."}]',
        time,
        time,
      ],
    );
    const events = history
      ? [
          { reviewedAt: instant(time), result: 'success' as const },
          { reviewedAt: instant('2026-10-03T12:00:00.000Z'), result: 'failure' as const },
          { reviewedAt: instant('2026-10-04T12:00:00.000Z'), result: 'success' as const },
        ]
      : [];
    const state = mergeReviewEvents(cardId, instant(time), events);
    let box = 1;
    for (const event of events) {
      const nextBox = event.result === 'success' ? Math.min(5, box + 1) : 1;
      await guest.execute(
        'INSERT INTO review_events (id, card_id, deck_id, previous_box, new_box, result, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [randomUUID(), cardId, deckId, box, nextBox, event.result, event.reviewedAt],
      );
      box = nextBox;
    }
    await guest.execute(
      'INSERT INTO card_review_state (card_id, box, due_date, last_reviewed_at, consecutive_successes, total_reviews, total_successes, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        cardId,
        state.box!,
        state.dueDate,
        state.lastReviewedAt,
        state.consecutiveSuccesses,
        state.totalReviews,
        state.totalSuccesses,
        state.updatedAt,
      ],
    );
  }
  return { deckId, cards };
}

async function setup() {
  const guest = await database();
  const account = await database(true);
  const server = await database(true);
  const serverStore = new SyncStore(server);
  const store = new SyncStore(account);
  const feed: ServerChange[] = [];
  const receipts = new Map<string, string>();
  let interrupted = false;
  let corruptState = false;
  let owned = true;
  let online = true;
  let lostReplyAt: number | null = null;
  const cloud = {
    entitlements: jest.fn<Promise<Entitlements>, []>(async () => ({
      currentPlan: 'Free' as const,
      isActive: false,
      startsAtUtc: null,
      expiresAtUtc: null,
      limits: { decks: 1, cards: 50 },
      features: { unlimitedDecks: false, unlimitedCards: false },
      isPurchasable: false as const,
      purchaseSupported: false as const,
      withinFreeTierLimits: true,
      usage: {
        decks: Number(
          (await server.execute('SELECT COUNT(*) AS count FROM decks WHERE archived_at IS NULL'))
            .rows[0]?.count,
        ),
        cards: Number(
          (await server.execute('SELECT COUNT(*) AS count FROM cards WHERE archived_at IS NULL'))
            .rows[0]?.count,
        ),
      },
      validatedAtUtc: new Date().toISOString(),
    })),
    available: true,
    hasSession: jest.fn(async () => owned),
    accountProfile: jest.fn(async () => ({
      id: owner,
      displayName: 'Student',
      phoneNumber: null,
      email: null,
    })),
    push: jest.fn(async (operation: PendingOperation, deviceId: string, userId: string) => {
      if (interrupted) throw new Error('Network interrupted');
      if (!owned || userId !== owner) throw new CloudError(401);
      const key = `${userId}/${deviceId}/${operation.operationId}`;
      const fingerprint = JSON.stringify({
        type: operation.entityType,
        id: operation.entityId,
        payload: operation.payload,
        time: operation.createdAt,
        expectedVersion: operation.expectedVersion,
      });
      const receipt = receipts.get(key);
      if (receipt && receipt !== fingerprint) throw new CloudError(409);
      let change = feed.find((entry) => entry.clientChangeId === operation.operationId);
      if (!receipt) {
        change = {
          entityType: operation.entityType,
          entityId: operation.entityId,
          operation: operation.operation,
          deviceId,
          clientChangeId: operation.operationId,
          clientChangedAtUtc: operation.createdAt,
          serverVersion: feed.length + 1,
          payload: operation.payload as Record<string, unknown>,
        };
        await serverStore.applyPage({
          cursor: change.serverVersion,
          latestVersion: change.serverVersion,
          hasMore: false,
          changes: [change],
        });
        feed.push(change);
        receipts.set(key, fingerprint);
        if (feed.length === lostReplyAt) {
          lostReplyAt = null;
          interrupted = true;
          throw new Error('Server accepted; reply lost');
        }
      }
      return {
        cursor: feed.length,
        changes: [
          { status: receipt ? 'duplicate' : 'applied', serverVersion: change!.serverVersion },
        ],
      };
    }),
    pull: jest.fn(async (cursor: number) => {
      if (interrupted) throw new Error('Network interrupted');
      const changes = feed.filter((change) => change.serverVersion > cursor).slice(0, 2);
      const next = changes.at(-1)?.serverVersion ?? cursor;
      return { cursor: next, latestVersion: feed.length, hasMore: next < feed.length, changes };
    }),
    ownedDecks: jest.fn(async () =>
      (
        await server.execute('SELECT id, name, archived_at FROM decks WHERE archived_at IS NULL')
      ).rows.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        archivedAtUtc: row.archived_at,
      })),
    ),
    ownedCards: jest.fn(async (deckId: string) =>
      (
        await server.execute(
          'SELECT id, deck_id, archived_at FROM cards WHERE deck_id = ? AND archived_at IS NULL',
          [deckId],
        )
      ).rows.map((row) => ({
        id: String(row.id),
        deckId: String(row.deck_id),
        archivedAtUtc: row.archived_at,
      })),
    ),
    ownedReviewState: jest.fn(async (cardId: string) => {
      const row = (
        await server.execute('SELECT * FROM card_review_state WHERE card_id = ?', [cardId])
      ).rows[0]!;
      return {
        cardId,
        box: corruptState ? 5 : row.box,
        dueDate: row.due_date,
        totalReviews: row.total_reviews,
        totalSuccesses: row.total_successes,
        consecutiveSuccesses: row.consecutive_successes,
        lastReviewedAtUtc: row.last_reviewed_at,
      };
    }),
  };
  const engine = new SyncEngine(
    store,
    cloud as unknown as CloudClient,
    async () => online,
    undefined,
    {
      isAccount: () => owned,
      enterAccount: async () => {},
      enterGuest: async () => {
        owned = false;
      },
    },
  );
  const context = async () => ({
    guest,
    account,
    assertCurrent: () => {
      if (!owned) throw new Error('Account changed');
    },
  });
  const createTransfer = (guestDatabase = guest, accountDatabase = account) =>
    new GuestTransfer(engine, async () => ({
      ...(await context()),
      guest: guestDatabase,
      account: accountDatabase,
    }));
  return {
    guest,
    account,
    server,
    store,
    cloud,
    engine,
    feed,
    createTransfer,
    transfer: createTransfer(),
    disconnect: () => {
      interrupted = true;
    },
    reconnect: () => {
      interrupted = false;
    },
    loseReply: (at: number) => {
      lostReplyAt = at;
    },
    corruptState: () => {
      corruptState = true;
    },
    becomeGuest: () => {
      owned = false;
    },
    offline: () => {
      online = false;
    },
  };
}

async function count(database: RealSqliteDatabase, table: string) {
  return (await database.execute(`SELECT COUNT(*) AS count FROM ${table}`)).rows[0]?.count;
}

test('guest-only copy preserves relationships, history, duplicate-text cards and exact review progress, then verifies full pull', async () => {
  const fixture = await setup();
  const original = await guestData(fixture.guest, 2);
  const bytes = fixture.guest.handle.export();
  const preview = await fixture.transfer.preview();
  expect(preview.scenario).toBe('guest-only');
  expect(preview.blockers).toEqual([]);
  await fixture.transfer.transfer(preview);
  expect(await count(fixture.account, 'decks')).toBe(1);
  expect(await count(fixture.server, 'cards')).toBe(2);
  expect(await count(fixture.server, 'review_events')).toBe(6);
  expect((await fixture.store.account()).cursor).toBe(fixture.feed.length);
  expect(
    (await fixture.account.execute('SELECT status FROM guest_transfers')).rows[0]?.status,
  ).toBe('complete');
  expect(fixture.guest.handle.export()).toEqual(bytes);
  expect(fixture.feed.find((change) => change.entityType === 'deck')?.entityId).not.toBe(
    original.deckId,
  );
  expect(fixture.feed.filter((change) => change.entityType === 'reviewState')).toHaveLength(0);
  expect(
    (
      await fixture.account.execute(
        'SELECT box, due_date, total_reviews, total_successes, consecutive_successes FROM card_review_state',
      )
    ).rows,
  ).toEqual([
    {
      box: 2,
      due_date: '2026-10-06',
      total_reviews: 3,
      total_successes: 2,
      consecutive_successes: 1,
    },
    {
      box: 2,
      due_date: '2026-10-06',
      total_reviews: 3,
      total_successes: 2,
      consecutive_successes: 1,
    },
  ]);
});

test('account-only login pulls existing data without deleting archived guest data or uploading guest outbox', async () => {
  const fixture = await setup();
  const original = await guestData(fixture.guest);
  await fixture.guest.execute('UPDATE decks SET archived_at = ? WHERE id = ?', [
    time,
    original.deckId,
  ]);
  await guestData(fixture.server, 1, false, 'Account');
  const serverOperations = await new SyncStore(fixture.server).pending();
  for (const operation of serverOperations)
    fixture.feed.push({
      entityType: operation.entityType,
      entityId: operation.entityId,
      operation: operation.operation,
      deviceId: 'server',
      clientChangeId: operation.operationId,
      clientChangedAtUtc: time,
      serverVersion: fixture.feed.length + 1,
      payload: operation.payload as Record<string, unknown>,
    });
  const bytes = fixture.guest.handle.export();
  expect((await fixture.transfer.preview()).scenario).toBe('account-only');
  expect(await count(fixture.account, 'cards')).toBe(1);
  expect(fixture.guest.handle.export()).toEqual(bytes);
  expect(fixture.cloud.push).not.toHaveBeenCalled();
});

test('both datasets with same-name decks and different contents warn without merging; current quotas prevent additions', async () => {
  const fixture = await setup();
  await guestData(fixture.guest, 1, true, ' Words ');
  await guestData(fixture.account, 2, false, 'words');
  const preview = await fixture.transfer.preview();
  expect(preview.scenario).toBe('both');
  expect(preview.sameNames).toEqual([' Words ']);
  expect(preview.guest[0]?.cards).toBe(1);
  expect(preview.account[0]?.cards).toBe(2);
  expect(preview.blockers.join(' ')).toContain('free limits');
  await expect(fixture.transfer.transfer(preview)).rejects.toThrow('free limits');
  expect(await count(fixture.account, 'decks')).toBe(1);
  expect(await count(fixture.guest, 'cards')).toBe(1);
  expect(await count(fixture.account, 'guest_transfers')).toBe(0);
});

test('verified Plus permits explicit additive guest transfer above free limits without merging same-name decks', async () => {
  const fixture = await setup();
  await guestData(fixture.guest, 1, true, 'Words');
  await guestData(fixture.account, 2, false, 'Words');
  const now = Date.now();
  fixture.cloud.entitlements.mockResolvedValue({
    currentPlan: 'Plus',
    isActive: true,
    startsAtUtc: new Date(now - 1000).toISOString(),
    expiresAtUtc: new Date(now + 3_600_000).toISOString(),
    limits: { decks: null, cards: null },
    features: { unlimitedDecks: true, unlimitedCards: true },
    isPurchasable: false,
    purchaseSupported: false,
    withinFreeTierLimits: true,
    usage: { decks: 1, cards: 2 },
    validatedAtUtc: new Date(now).toISOString(),
  });
  const guest = fixture.guest.handle.export();
  const preview = await fixture.transfer.preview();
  expect(preview.scenario).toBe('both');
  expect(preview.sameNames).toEqual(['Words']);
  expect(preview.blockers).toEqual([]);
  await fixture.transfer.transfer(preview);
  expect(await count(fixture.account, 'decks')).toBe(2);
  expect(await count(fixture.server, 'cards')).toBe(3);
  expect(await count(fixture.server, 'review_events')).toBe(3);
  expect(fixture.guest.handle.export()).toEqual(guest);
});

test('neither dataset and preview/cancellation do not create account data or a journal', async () => {
  const fixture = await setup();
  expect((await fixture.transfer.preview()).scenario).toBe('empty');
  await guestData(fixture.guest);
  const bytes = fixture.guest.handle.export();
  await fixture.transfer.preview();
  expect(await count(fixture.account, 'guest_transfers')).toBe(0);
  expect(await count(fixture.account, 'decks')).toBe(0);
  expect(fixture.guest.handle.export()).toEqual(bytes);
  expect(fixture.cloud.push).not.toHaveBeenCalled();
});

test('lost server acknowledgement resumes stable identities after database restart without duplicating entities or history', async () => {
  const fixture = await setup();
  await guestData(fixture.guest);
  const preview = await fixture.transfer.preview();
  fixture.loseReply(3);
  await expect(fixture.transfer.transfer(preview)).rejects.toThrow('reply lost');
  const operationIds = (
    await fixture.account.execute('SELECT operation_id FROM sync_operations ORDER BY sequence')
  ).rows;
  expect(
    (await fixture.account.execute('SELECT status FROM guest_transfers')).rows[0]?.status,
  ).toBe('pending');
  const reopened = await RealSqliteDatabase.open(fixture.account.handle.export());
  const store = new SyncStore(reopened);
  const engine = new SyncEngine(store, fixture.cloud as unknown as CloudClient, async () => true);
  const resumed = new GuestTransfer(engine, async () => ({
    guest: fixture.guest,
    account: reopened,
    assertCurrent: () => {},
  }));
  expect((await resumed.preview()).journal).toBe('pending');
  fixture.reconnect();
  await resumed.transfer(await resumed.preview());
  expect(
    (await reopened.execute('SELECT operation_id FROM sync_operations ORDER BY sequence')).rows,
  ).toEqual(operationIds);
  expect(await count(fixture.server, 'decks')).toBe(1);
  expect(await count(fixture.server, 'cards')).toBe(1);
  expect(await count(fixture.server, 'review_events')).toBe(3);
  expect((await reopened.execute('SELECT status FROM guest_transfers')).rows[0]?.status).toBe(
    'complete',
  );
});

test('disk failure rolls back the account copy, outbox and journal and leaves guest untouched', async () => {
  const fixture = await setup();
  await guestData(fixture.guest);
  const preview = await fixture.transfer.preview();
  fixture.account.failStatement = 'INSERT INTO guest_transfers';
  await expect(fixture.transfer.transfer(preview)).rejects.toThrow('Disk full');
  expect(await count(fixture.account, 'decks')).toBe(0);
  expect(await count(fixture.account, 'sync_operations')).toBe(0);
  expect(await count(fixture.account, 'review_events')).toBe(0);
  expect(await count(fixture.guest, 'cards')).toBe(1);
  expect(fixture.cloud.push).not.toHaveBeenCalled();
});

test('local acknowledgement failure retries the accepted operation using the original receipt', async () => {
  const fixture = await setup();
  await guestData(fixture.guest, 1, false);
  const preview = await fixture.transfer.preview();
  fixture.account.failStatement = "SET status = 'synced'";
  await expect(fixture.transfer.transfer(preview)).rejects.toThrow('Disk full');
  expect(await count(fixture.server, 'decks')).toBe(1);
  fixture.account.failStatement = null;
  await fixture.transfer.transfer(await fixture.transfer.preview());
  expect(await count(fixture.server, 'decks')).toBe(1);
  expect(await count(fixture.server, 'cards')).toBe(1);
});

test('initial unreviewed due dates are preserved and fifty cards transfer through multiple sync batches', async () => {
  const fixture = await setup();
  await guestData(fixture.guest, 50, false);
  await fixture.guest.execute("UPDATE card_review_state SET due_date = '2026-11-01'");
  await fixture.transfer.transfer(await fixture.transfer.preview());
  expect(await count(fixture.server, 'cards')).toBe(50);
  expect(
    (await fixture.server.execute('SELECT DISTINCT due_date FROM card_review_state')).rows,
  ).toEqual([{ due_date: '2026-11-01' }]);
  expect(fixture.feed).toHaveLength(101);
});

test('fifty-first legacy guest card blocks copying without deleting existing data', async () => {
  const fixture = await setup();
  await fixture.guest.execute('DROP TRIGGER free_tier_cards_insert');
  await guestData(fixture.guest, 51, false);
  const preview = await fixture.transfer.preview();
  await expect(fixture.transfer.transfer(preview)).rejects.toThrow('free limits');
  expect(await count(fixture.guest, 'cards')).toBe(51);
  expect(await count(fixture.account, 'cards')).toBe(0);
});

test.each(['missing-history', 'different-UTC-day', 'other-scheduler'])(
  'unsupported progress %s remains guest-only with an actionable blocker',
  async (kind) => {
    const fixture = await setup();
    await guestData(fixture.guest, 1, kind !== 'missing-history');
    if (kind === 'missing-history')
      await fixture.guest.execute('UPDATE card_review_state SET total_reviews = 2');
    if (kind === 'different-UTC-day')
      await fixture.guest.execute("UPDATE card_review_state SET due_date = '2026-10-07'");
    if (kind === 'other-scheduler')
      await fixture.guest.execute("UPDATE decks SET review_system = 'sm2'");
    const preview = await fixture.transfer.preview();
    expect(preview.blockers.length).toBeGreaterThan(0);
    await expect(fixture.transfer.transfer(preview)).rejects.toThrow();
    expect(await count(fixture.account, 'decks')).toBe(0);
  },
);

test('stale preview requires a fresh confirmation rather than copying unseen changes', async () => {
  const fixture = await setup();
  await guestData(fixture.guest);
  const preview = await fixture.transfer.preview();
  await fixture.guest.execute("UPDATE decks SET name = 'Changed after preview'");
  await expect(fixture.transfer.transfer(preview)).rejects.toThrow('Refresh and confirm');
  expect(await count(fixture.account, 'decks')).toBe(0);
});

test('missing server sync backfill is detected instead of treating account data as empty', async () => {
  const fixture = await setup();
  await guestData(fixture.guest);
  await guestData(fixture.server);
  const preview = await fixture.transfer.preview();
  expect(preview.blockers.join(' ')).toContain('backfill');
  await expect(fixture.transfer.transfer(preview)).rejects.toThrow('backfill');
  expect(await count(fixture.server, 'decks')).toBe(1);
  const missingProgress = await setup();
  await guestData(missingProgress.server);
  const operations = await new SyncStore(missingProgress.server).pending();
  for (const operation of operations.filter(
    (item) => item.entityType === 'deck' || item.entityType === 'card',
  ))
    missingProgress.feed.push({
      entityType: operation.entityType,
      entityId: operation.entityId,
      operation: operation.operation,
      deviceId: 'server',
      clientChangeId: operation.operationId,
      clientChangedAtUtc: time,
      serverVersion: missingProgress.feed.length + 1,
      payload: operation.payload as Record<string, unknown>,
    });
  const incomplete = await missingProgress.transfer.preview();
  expect(incomplete.scenario).toBe('account-only');
  expect(incomplete.accountVerified).toBe(false);
  expect(incomplete.blockers.join(' ')).toContain('Account review progress differs');
  expect(await count(missingProgress.account, 'review_events')).toBe(0);
  expect(await count(missingProgress.server, 'review_events')).toBe(3);
  expect(missingProgress.cloud.push).not.toHaveBeenCalled();
});

test('server progress mismatch never marks the transfer complete', async () => {
  const fixture = await setup();
  await guestData(fixture.guest);
  const preview = await fixture.transfer.preview();
  fixture.corruptState();
  await expect(fixture.transfer.transfer(preview)).rejects.toThrow('Server review progress');
  expect(
    (await fixture.account.execute('SELECT status FROM guest_transfers')).rows[0]?.status,
  ).toBe('pending');
  expect(await count(fixture.guest, 'review_events')).toBe(3);
});

test('guest scope, foreign-owned source, mismatched account database and offline verification are rejected', async () => {
  const fixture = await setup();
  await guestData(fixture.guest);
  fixture.offline();
  await expect(fixture.transfer.preview()).rejects.toThrow('connection');
  const foreign = await database(true);
  await expect(fixture.createTransfer(foreign).preview()).rejects.toThrow('unowned guest');
  await foreign.execute('UPDATE sync_account SET user_id = ?', [randomUUID()]);
  await expect(fixture.createTransfer(fixture.guest, foreign).preview()).rejects.toThrow(
    'ownership',
  );
  fixture.becomeGuest();
  await expect(fixture.transfer.preview()).rejects.toThrow('authenticated account');
  expect(await count(fixture.account, 'decks')).toBe(0);
});

test('duplicate submission is rejected while progress is pending', async () => {
  const fixture = await setup();
  await guestData(fixture.guest);
  const preview = await fixture.transfer.preview();
  const pending = fixture.transfer.transfer(preview);
  await expect(fixture.transfer.transfer(preview)).rejects.toThrow('already in progress');
  await expect(fixture.engine.signOut(true)).rejects.toThrow('authenticated account');
  await pending;
});

test('a different authenticated identity cannot upload a copy from this local account', async () => {
  const fixture = await setup();
  await guestData(fixture.guest);
  fixture.cloud.accountProfile.mockResolvedValue({
    id: randomUUID(),
    displayName: 'Different owner',
    phoneNumber: null,
    email: null,
  });
  await expect(fixture.transfer.preview()).rejects.toThrow('does not own this local account');
  expect(fixture.cloud.push).not.toHaveBeenCalled();
  expect(await count(fixture.account, 'decks')).toBe(0);
});

test('completed journal prevents re-copying or automatically adding later guest edits', async () => {
  const fixture = await setup();
  await guestData(fixture.guest, 1, false);
  await fixture.transfer.transfer(await fixture.transfer.preview());
  await fixture.guest.execute("UPDATE cards SET front_text = 'Later guest edit'");
  const preview = await fixture.transfer.preview();
  expect(preview.journal).toBe('complete');
  const feedLength = fixture.feed.length;
  await fixture.transfer.transfer(preview);
  expect(fixture.feed).toHaveLength(feedLength);
  expect((await fixture.server.execute('SELECT front_text FROM cards')).rows[0]?.front_text).toBe(
    'same text',
  );
  expect((await fixture.guest.execute('SELECT front_text FROM cards')).rows[0]?.front_text).toBe(
    'Later guest edit',
  );
});

test('persistent sync conflict is preserved and never silently resolved for a transfer', async () => {
  const fixture = await setup();
  await guestData(fixture.guest);
  const preview = await fixture.transfer.preview();
  fixture.cloud.push.mockRejectedValueOnce(
    new CloudError(409, {
      entityType: 'deck',
      entityId: 'collision',
      expectedVersion: 0,
      actualVersion: 1,
      serverValue: null,
      clientValue: null,
    }),
  );
  await expect(fixture.transfer.transfer(preview)).rejects.toMatchObject({ status: 409 });
  expect((await fixture.store.counts()).conflict).toBe(1);
  await expect(fixture.transfer.transfer(await fixture.transfer.preview())).rejects.toThrow(
    'sync conflict',
  );
  expect((await fixture.store.counts()).conflict).toBe(1);
  expect(await count(fixture.guest, 'decks')).toBe(1);
});
