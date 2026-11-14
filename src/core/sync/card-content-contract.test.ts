import { RealSqliteDatabase } from '@/../test/real-sqlite';
import { fixedClock, sequenceIds, makeCard, makeDeck } from '@/../test/fixtures';
import { runMigrations } from '@/core/database/migrations';
import { createSqliteRepositories } from '@/core/composition/sqlite-repositories';
import { createApplication } from '@/core/application/create-application';
import { AppError } from '@/core/errors/app-error';
import { validateCardContent } from '@/features/study/domain/card';
import { SyncStore } from './sync-store';
import type { ServerChange } from './contract';

const malformed = { sentence: 'valid', translation: 42, notes: ['array'] };

test.each([
  malformed,
  { sentence: 'valid', translation: 42 },
  { sentence: 'valid', notes: ['array'] },
  { sentence: 'valid', translation: false },
  { sentence: 'valid', notes: {} },
  { sentence: 'valid', translation: null },
  null,
  [],
  {},
  { sentence: true },
  { sentence: ' ' },
  { sentence: 'valid', unknown: 'retained?' },
])('malformed example produces a controlled validation error: %j', (example) => {
  expect(() => validateCardContent({ ...makeCard(), examples: [example] } as never)).toThrow(
    AppError,
  );
});

test.each(['phonetic', 'category', 'frontText', 'meaning', 'examples'] as const)(
  'runtime %s types cannot crash validation',
  (key) => {
    for (const value of [42, false, {}, null]) {
      if (value === null && (key === 'phonetic' || key === 'category')) continue;
      expect(() => validateCardContent({ ...makeCard(), [key]: value } as never)).toThrow(AppError);
    }
  },
);

test.each(['translation', 'notes'] as const)(
  '%s has an independent 4000 UTF-16 unit bound',
  (key) => {
    for (const length of [3999, 4000])
      expect(
        validateCardContent({
          ...makeCard(),
          examples: [{ sentence: 'valid', [key]: 'x'.repeat(length) }],
        }).examples[0]?.[key],
      ).toHaveLength(length);
    expect(() =>
      validateCardContent({
        ...makeCard(),
        examples: [{ sentence: 'valid', [key]: 'x'.repeat(4001) }],
      }),
    ).toThrow(AppError);
  },
);

test('malformed remote card rolls back the entire page and retries at the same cursor', async () => {
  const db = await RealSqliteDatabase.open();
  try {
    await runMigrations(db);
    const repos = createSqliteRepositories(db);
    const app = createApplication(repos, fixedClock, sequenceIds());
    const deck = await app.createDeck(makeDeck());
    const store = new SyncStore(db);
    const change = (id: string, version: number, examples: unknown): ServerChange => ({
      entityType: 'card',
      entityId: id,
      operation: 'upsert',
      serverVersion: version,
      deviceId: 'remote',
      clientChangeId: `remote-${version}`,
      clientChangedAtUtc: fixedClock.now().toISOString(),
      payload: {
        deckId: deck.id,
        frontText: 'hello',
        meaning: 'سلام',
        phonetic: null,
        category: null,
        examples,
      },
    });
    const page = {
      cursor: 2,
      latestVersion: 2,
      hasMore: false,
      changes: [change('valid', 1, []), change('invalid', 2, [malformed])],
    };
    await expect(store.applyPage(page)).rejects.toThrow(/example/i);
    expect((await store.account()).cursor).toBe(0);
    expect((await db.execute('SELECT * FROM cards')).rows).toHaveLength(0);
    expect((await db.execute('SELECT * FROM sync_entity_versions')).rows).toHaveLength(0);
    await expect(store.applyPage(page)).rejects.toThrow();
    await store.applyPage({
      ...page,
      changes: [page.changes[0]!, change('invalid', 2, [{ sentence: 'repaired' }])],
    });
    expect((await repos.cards.listByDeck(deck.id)).map((c) => c.id)).toEqual(['invalid', 'valid']);
    expect((await store.account()).cursor).toBe(2);
  } finally {
    db.handle.close();
  }
});

test('persisted malformed examples do not prevent access to valid cards or remove raw evidence', async () => {
  const db = await RealSqliteDatabase.open();
  try {
    await runMigrations(db);
    const repos = createSqliteRepositories(db);
    const app = createApplication(repos, fixedClock, sequenceIds());
    const deck = await app.createDeck(makeDeck());
    const good = await app.createCard({ ...makeCard(), deckId: deck.id });
    await db.execute(
      'INSERT INTO cards (id,deck_id,front_text,meaning,examples_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
      [
        'bad',
        deck.id,
        'legacy',
        'meaning',
        JSON.stringify([malformed]),
        good.createdAt,
        good.updatedAt,
      ],
    );
    expect((await repos.cards.listByDeck(deck.id)).map((c) => c.id)).toEqual([good.id]);
    await expect(repos.cards.getById('bad')).rejects.toThrow(/integrity/i);
    expect(
      (await db.execute('SELECT examples_json FROM cards WHERE id=?', ['bad'])).rows[0]
        ?.examples_json,
    ).toBe(JSON.stringify([malformed]));
    expect(await repos.cards.countByDeck(deck.id)).toBe(2);
  } finally {
    db.handle.close();
  }
});

test('audit five-example card and maximum example model remain locally writable', () => {
  for (const count of [5, 20]) {
    const examples = Array.from({ length: count }, () => ({
      sentence: 'x'.repeat(4000),
      translation: 'ی'.repeat(4000),
      notes: '😀'.repeat(2000),
    }));
    expect(validateCardContent({ ...makeCard(), examples }).examples).toEqual(examples);
  }
});
