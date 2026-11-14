import { RealSqliteDatabase } from '@/../test/real-sqlite';
import {
  checkpointFor,
  historySql,
  projectionSql,
  remoteChange,
  ReplayMetricsDatabase,
  replayTime,
  reviewChanges,
  reviewPages,
  seedReplayDatabase,
} from '@/../test/review-replay-fixture';
import type { Database, DatabaseTransaction } from '@/core/database/database';
import { PostCommitDatabase } from '@/core/database/post-commit-database';
import { runMigrations } from '@/core/database/migrations';
import { SyncStore } from './sync-store';
import type { PullPage, ServerChange } from './contract';

// Scheduling/validation primitives are unchanged. This oracle preserves the pre-optimization
// page order and eagerly projects after EACH event, independently of the optimized grouping.
interface ReferencePorts {
  installCheckpoint(
    tx: DatabaseTransaction,
    id: string,
    state: Record<string, unknown>,
    version: number,
  ): Promise<void>;
  applyChange(tx: DatabaseTransaction, change: ServerChange): Promise<unknown>;
  replayReviews(tx: DatabaseTransaction, id: string): Promise<void>;
}
async function referencePage(database: Database, page: PullPage) {
  const old = new SyncStore(database) as unknown as ReferencePorts;
  await database.transaction(async (tx) => {
    await tx.execute('UPDATE sync_account SET applying_remote=1 WHERE id=1');
    for (const cp of page.reviewCheckpoints ?? [])
      await old.installCheckpoint(tx, cp.cardId, cp.state, cp.throughVersion);
    for (const change of page.changes) {
      await old.applyChange(tx, change);
      if (change.entityType === 'reviewEvent')
        await old.replayReviews(tx, String(change.payload.cardId));
    }
    for (const cp of page.reviewCheckpoints ?? []) await old.replayReviews(tx, cp.cardId);
    await tx.execute('UPDATE sync_account SET cursor=?, applying_remote=0 WHERE id=1', [
      page.cursor,
    ]);
  });
}

async function snapshot(db: Database) {
  const result: Record<string, unknown> = {};
  for (const table of [
    'decks',
    'cards',
    'card_review_state',
    'review_events',
    'review_replay_baselines',
    'sync_review_versions',
    'sync_entity_versions',
    'sync_operations',
    'sync_conflicts',
  ])
    result[table] = (await db.execute(`SELECT * FROM ${table} ORDER BY 1`)).rows;
  result.account = (
    await db.execute('SELECT user_id,cursor,applying_remote FROM sync_account')
  ).rows;
  return result;
}

beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ['performance'] });
  jest.setSystemTime(new Date(replayTime));
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe.each(['leitner', 'sm2'])('%s deterministic reference equivalence', (scheduler) => {
  test('checkpoint watermark excludes covered events, then replays a late suffix and pending local event exactly once', async () => {
    const dbs = [await RealSqliteDatabase.open(), await RealSqliteDatabase.open()];
    try {
      const changes = reviewChanges(8);
      changes[6]!.payload.reviewedAtUtc = '2020-01-01T00:00:00.000Z';
      delete changes[6]!.payload.reviewCalendar;
      const checkpoint = checkpointFor(changes.slice(0, 6), 'card-0', scheduler, 6);
      for (const db of dbs) {
        await seedReplayDatabase(db, scheduler);
        await db.execute(`INSERT INTO review_events (id,card_id,deck_id,previous_box,new_box,result,reviewed_at)
          VALUES ('pending','card-0','deck',1,2,'success','2026-09-01T00:00:00.000Z')`);
        await db.execute(
          "UPDATE sync_operations SET operation_id='pending-identity' WHERE entity_id='pending'",
        );
      }
      const pending = (await dbs[0]!.execute('SELECT * FROM sync_operations')).rows;
      const pages = [
        {
          cursor: 4,
          latestVersion: 8,
          hasMore: true,
          changes: changes.slice(0, 4),
          reviewCheckpoints: [checkpoint],
        },
        {
          cursor: 6,
          latestVersion: 8,
          hasMore: true,
          changes: changes.slice(4, 6),
          reviewCheckpoints: [checkpoint],
        },
        { cursor: 8, latestVersion: 8, hasMore: false, changes: changes.slice(6) },
      ];
      for (const page of pages) {
        await referencePage(dbs[0]!, page);
        await new SyncStore(dbs[1]!).applyPage(page);
        expect(await snapshot(dbs[1]!)).toEqual(await snapshot(dbs[0]!));
      }
      expect(
        (await dbs[1]!.execute('SELECT total_reviews FROM card_review_state')).rows[0]!
          .total_reviews,
      ).toBe(9);
      expect((await dbs[1]!.execute('SELECT * FROM sync_operations')).rows).toEqual(pending);
      expect(
        (await dbs[1]!.execute('SELECT through_version FROM review_replay_baselines')).rows[0]!
          .through_version,
      ).toBe(6);
    } finally {
      dbs.forEach((db) => db.handle.close());
    }
  });

  test('fresh page creates deck/card before reviews while retaining its authoritative checkpoint', async () => {
    const dbs = [await RealSqliteDatabase.open(), await RealSqliteDatabase.open()];
    try {
      const events = reviewChanges(4, 1, 3);
      const checkpoint = checkpointFor(events, 'card-0', scheduler, 6);
      const page = {
        cursor: 6,
        latestVersion: 6,
        hasMore: false,
        reviewCheckpoints: [checkpoint],
        changes: [
          remoteChange('deck', 'deck', 1, {
            name: 'Fresh',
            description: '',
            language: 'en',
            textAlignment: 'ltr',
            typographySize: 'medium',
            reviewSystem: scheduler,
          }),
          remoteChange('card', 'card-0', 2, {
            deckId: 'deck',
            frontText: 'term',
            meaning: 'meaning',
            examples: [],
          }),
          ...events,
        ],
      };
      for (const db of dbs) await runMigrations(db);
      await referencePage(dbs[0]!, page);
      await new SyncStore(dbs[1]!).applyPage(page);
      expect(await snapshot(dbs[1]!)).toEqual(await snapshot(dbs[0]!));
      expect((await new SyncStore(dbs[1]!).counts()).pending).toBe(0);
    } finally {
      dbs.forEach((db) => db.handle.close());
    }
  });
  test.each([
    'complete',
    'baseline',
    'checkpoint',
    'duplicates',
    'local-pending',
    'calendar',
    'missing-projection',
  ])('%s history retains all persisted evidence', async (scenario) => {
    const dbs = [await RealSqliteDatabase.open(), await RealSqliteDatabase.open()];
    try {
      const changes = reviewChanges(60, 3);
      if (scenario === 'duplicates') {
        changes[5] = { ...changes[0]!, serverVersion: 6, clientChangeId: 'duplicate-6' };
        changes[35] = { ...changes[0]!, serverVersion: 36, clientChangeId: 'duplicate-36' };
      }
      if (scenario === 'calendar') {
        const moments = [
          ['2026-11-12T21:30:00.000Z', '2026-11-13', 210],
          ['2026-11-13T00:00:00.000Z', '2026-11-13', 0],
          ['2026-03-08T06:59:00.000Z', '2026-03-08', -300],
          ['2026-03-08T07:01:00.000Z', '2026-03-08', -240],
          ['2026-01-01T00:01:00.000Z', '2025-12-31', -480],
        ] as const;
        changes.forEach((c, i) => {
          const m = moments[i % moments.length]!;
          c.payload.reviewedAtUtc = m[0];
          c.payload.reviewCalendar = { reviewDate: m[1], utcOffsetMinutes: m[2] };
          if (i % 7 === 0) delete c.payload.reviewCalendar;
        });
      }
      const pages = reviewPages(changes, 30);
      const input = pages.map((p) =>
        scenario === 'checkpoint'
          ? {
              ...p,
              reviewCheckpoints: Array.from({ length: 3 }, (_, i) =>
                checkpointFor(changes, `card-${i}`, scheduler, 60),
              ),
            }
          : p,
      );
      for (const db of dbs) {
        await seedReplayDatabase(db, scheduler, 3);
        if (scenario === 'baseline')
          await db.execute(
            'UPDATE card_review_state SET total_reviews=9,total_successes=8,consecutive_successes=3',
          );
        if (scenario === 'missing-projection') await db.execute('DELETE FROM card_review_state');
        if (scenario === 'local-pending') {
          const local = reviewChanges(1)[0]!;
          await db.execute(
            `INSERT INTO review_events (id,card_id,deck_id,previous_box,new_box,result,reviewed_at,review_calendar_json)
            VALUES ('local','card-0','deck',1,2,'success',?,?)`,
            [String(local.payload.reviewedAtUtc), JSON.stringify(local.payload.reviewCalendar)],
          );
          await db.execute(
            'UPDATE card_review_state SET total_reviews=1,total_successes=1,consecutive_successes=1 WHERE card_id=?',
            ['card-0'],
          );
        }
      }
      // Restore the exact same pending identities, including trigger-generated local evidence.
      const pending = (await dbs[0]!.execute('SELECT * FROM sync_operations')).rows;
      await dbs[1]!.execute('DELETE FROM sync_operations');
      for (const row of pending)
        await dbs[1]!.execute(
          `INSERT INTO sync_operations (${Object.keys(row).join(',')}) VALUES (${Object.keys(row)
            .map(() => '?')
            .join(',')})`,
          Object.values(row),
        );
      for (const page of input) {
        await referencePage(dbs[0]!, page);
        await new SyncStore(dbs[1]!).applyPage(page);
        expect(await snapshot(dbs[1]!)).toEqual(await snapshot(dbs[0]!));
      }
      expect((await dbs[1]!.execute('SELECT COUNT(*) AS n FROM review_events')).rows[0]!.n).toBe(
        scenario === 'duplicates' ? 58 : scenario === 'local-pending' ? 61 : 60,
      );
    } finally {
      dbs.forEach((db) => db.handle.close());
    }
  });

  test('page boundaries, restart, late events and repeated delivery preserve learning state', async () => {
    const dbs = [await RealSqliteDatabase.open(), await RealSqliteDatabase.open()];
    try {
      const changes = reviewChanges(100, 2);
      for (let i = 0; i < dbs.length; i++) {
        const db = dbs[i]!;
        await seedReplayDatabase(db, scheduler, 2);
        for (const page of reviewPages(changes, i === 0 ? 100 : 10))
          await new SyncStore(db).applyPage(page);
      }
      expect(await snapshot(dbs[1]!)).toEqual(await snapshot(dbs[0]!));
      const restored = await RealSqliteDatabase.open(dbs[1]!.handle.export());
      try {
        await runMigrations(restored);
        const duplicate = { ...changes[0]!, serverVersion: 101, clientChangeId: 'duplicate' };
        const late = reviewChanges(1)[0]!;
        const next = { ...late, entityId: 'late', serverVersion: 102, clientChangeId: 'late-op' };
        next.payload.reviewedAtUtc = '2020-01-01T00:00:00.000Z';
        delete next.payload.reviewCalendar;
        const page = {
          cursor: 102,
          latestVersion: 102,
          hasMore: false,
          changes: [duplicate, next],
        };
        await referencePage(dbs[0]!, page);
        await new SyncStore(restored).applyPage(page);
        expect(await snapshot(restored)).toEqual(await snapshot(dbs[0]!));
        await new SyncStore(restored).applyPage({ ...page, changes: [], cursor: 102 });
        expect(await snapshot(restored)).toEqual(await snapshot(dbs[0]!));
        await expect(new SyncStore(restored).applyPage(page)).rejects.toThrow(
          'Invalid server cursor',
        );
      } finally {
        restored.handle.close();
      }
    } finally {
      dbs.forEach((db) => db.handle.close());
    }
  });
});

test('mutable records between reviews preserve former projection boundaries and archive semantics', async () => {
  const dbs = [await RealSqliteDatabase.open(), await RealSqliteDatabase.open()];
  try {
    const reviews = reviewChanges(3);
    const cp = checkpointFor(reviews, 'card-0', 'leitner', 3).state;
    const changes = [
      reviews[0]!,
      remoteChange('reviewState', 'card-0', 2, cp),
      { ...reviews[1]!, serverVersion: 3 },
      remoteChange('card', 'card-0', 4, {
        deckId: 'deck',
        frontText: 'edited',
        meaning: 'meaning',
        examples: [],
      }),
      { ...reviews[2]!, serverVersion: 5 },
      { ...remoteChange('card', 'card-0', 6, {}), operation: 'archive' as const },
    ];
    const page = { cursor: 6, latestVersion: 6, hasMore: false, changes };
    for (const db of dbs) await seedReplayDatabase(db);
    await referencePage(dbs[0]!, page);
    await new SyncStore(dbs[1]!).applyPage(page);
    expect(await snapshot(dbs[1]!)).toEqual(await snapshot(dbs[0]!));
  } finally {
    dbs.forEach((db) => db.handle.close());
  }
});

test.each([
  'INSERT OR IGNORE INTO review_events',
  historySql,
  projectionSql,
  'INSERT INTO review_replay_baselines',
  'UPDATE sync_account SET cursor',
])('failure at %s rolls back events, projection, baseline and cursor', async (statement) => {
  const db = await RealSqliteDatabase.open();
  try {
    await seedReplayDatabase(db);
    const before = await snapshot(db);
    const committed = new PostCommitDatabase(db);
    const notification = jest.fn();
    committed.subscribe(notification);
    db.failStatement = statement;
    const page = reviewPages(reviewChanges(10))[0]!;
    await expect(new SyncStore(committed).applyPage(page)).rejects.toThrow('Disk full');
    db.failStatement = null;
    expect(await snapshot(db)).toEqual(before);
    expect(notification).not.toHaveBeenCalled();
    await new SyncStore(committed).applyPage(page);
    expect(notification).toHaveBeenCalledTimes(1);
    expect((await new SyncStore(db).counts()).pending).toBe(0);
  } finally {
    db.handle.close();
  }
});

test('an intermediate insert failure rolls back earlier events, then the same page recovers', async () => {
  const db = await RealSqliteDatabase.open();
  try {
    await seedReplayDatabase(db);
    const before = await snapshot(db);
    const observed = new ReplayMetricsDatabase(db);
    let inserts = 0;
    observed.afterExecute = (sql) => {
      if (sql.includes('INSERT OR IGNORE INTO review_events') && ++inserts === 5)
        throw new Error('injected');
    };
    const page = reviewPages(reviewChanges(10))[0]!;
    await expect(new SyncStore(observed).applyPage(page)).rejects.toThrow('injected');
    expect(await snapshot(db)).toEqual(before);
    observed.afterExecute = undefined;
    await new SyncStore(observed).applyPage(page);
    expect(
      (await db.execute('SELECT total_reviews FROM card_review_state')).rows[0]!.total_reviews,
    ).toBe(10);
  } finally {
    db.handle.close();
  }
});

test.each(['collision', 'calendar', 'result', 'scheduler-change'])(
  'invalid %s rolls back the entire batch',
  async (kind) => {
    const db = await RealSqliteDatabase.open();
    try {
      await seedReplayDatabase(db);
      const before = await snapshot(db);
      const changes = reviewChanges(3);
      if (kind === 'collision')
        changes[2] = {
          ...changes[0]!,
          serverVersion: 3,
          payload: { ...changes[0]!.payload, result: 'failure' },
        };
      if (kind === 'calendar')
        changes[2]!.payload.reviewCalendar = { reviewDate: '1900-01-01', utcOffsetMinutes: 210 };
      if (kind === 'result') changes[2]!.payload.result = 'unknown';
      if (kind === 'scheduler-change')
        changes[2] = remoteChange('deck', 'deck', 3, {
          name: 'changed',
          description: '',
          language: 'en',
          textAlignment: 'ltr',
          typographySize: 'medium',
          reviewSystem: 'sm2',
        });
      await expect(new SyncStore(db).applyPage(reviewPages(changes)[0]!)).rejects.toThrow();
      expect(await snapshot(db)).toEqual(before);
    } finally {
      db.handle.close();
    }
  },
);
