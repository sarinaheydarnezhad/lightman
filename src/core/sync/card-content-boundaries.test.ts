import * as SecureStore from 'expo-secure-store';
import vectors from '@/../test/fixtures/card-content-vectors.json';
import { RealSqliteDatabase } from '@/../test/real-sqlite';
import { fixedClock, sequenceIds, makeCard, makeDeck } from '@/../test/fixtures';
import { runMigrations } from '@/core/database/migrations';
import { createSqliteRepositories } from '@/core/composition/sqlite-repositories';
import { createApplication } from '@/core/application/create-application';
import {
  validateCardContent,
  MAX_CARD_PAYLOAD_BYTES,
  MAX_SYNC_PUSH_BYTES,
  utf8Bytes,
} from '@/features/study/domain/card';
import { CloudClient } from './cloud-client';
import { SyncStore } from './sync-store';
import { unsupportedReasons, readGuest } from './guest-transfer-snapshot';
import { csvAdapter } from '@/features/transfer/data/csv-adapter';
import { xlsxAdapter } from '@/features/transfer/data/xlsx-adapter';
import { apkgAdapter } from '@/features/transfer/data/apkg-adapter';
import { createTransferService } from '@/features/transfer/application/transfer-service';
import type { PendingOperation } from './contract';
import { calendarDate } from '@/core/domain/values';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('@/features/transfer/data/sqlite-codec', () =>
  jest.requireActual('@/features/transfer/data/sqlite-codec.web'),
);
jest.mock('expo-crypto', () => ({
  randomUUID: () => jest.requireActual<typeof import('node:crypto')>('node:crypto').randomUUID(),
  CryptoDigestAlgorithm: { SHA1: 'SHA-1' },
  digestStringAsync: async (_algorithm: string, value: string) =>
    jest.requireActual('node:crypto').createHash('sha1').update(value).digest('hex'),
}));
beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'https://card-contract.invalid';
});
afterEach(() => {
  delete process.env.EXPO_PUBLIC_API_URL;
});

test.each(vectors)('shared C# / TypeScript vector: $name', (vector) => {
  const validate = () => validateCardContent({ ...makeCard(), examples: vector.examples } as never);
  if (vector.valid) expect(validate).not.toThrow();
  else expect(validate).toThrow();
});

test.each(['frontText', 'meaning', 'phonetic', 'category', 'sentence', 'translation', 'notes'])(
  '%s maximum lengths count UTF-16 units before trimming',
  (field) => {
    const maximum = field === 'phonetic' ? 500 : field === 'category' ? 120 : 4000;
    for (const length of [maximum - 1, maximum, maximum + 1]) {
      const text = '😀'.repeat(Math.floor(length / 2)) + (length % 2 ? 'x' : '');
      const value = ['sentence', 'translation', 'notes'].includes(field)
        ? { ...makeCard(), examples: [{ sentence: 'valid', [field]: text }] }
        : { ...makeCard(), [field]: text };
      if (length <= maximum) expect(() => validateCardContent(value)).not.toThrow();
      else expect(() => validateCardContent(value)).toThrow();
    }
  },
);

test('full simultaneous logical maxima fit both JSON encoders and the transport bound', () => {
  for (const character of ['ی', '😀', '"', '\\', '\n', '\u0001']) {
    const text = 'x' + character.repeat(3998 / character.length) + 'x';
    const content = validateCardContent({
      frontText: text,
      meaning: text,
      phonetic: 'p'.repeat(500),
      category: 'c'.repeat(120),
      examples: Array.from({ length: 20 }, () => ({
        sentence: text,
        translation: text,
        notes: text,
      })),
    });
    const json = JSON.stringify({ deckId: '00000000-0000-0000-0000-000000000001', ...content });
    // Default .NET escapes non-ASCII units, HTML-sensitive characters and both halves of emoji.
    const escaped = json.replace(
      /[^\x20-\x7e]/g,
      (unit) => '\\u' + unit.charCodeAt(0).toString(16).padStart(4, '0'),
    );
    expect(utf8Bytes(json)).toBe(Buffer.byteLength(json, 'utf8'));
    expect(utf8Bytes(escaped)).toBeLessThanOrEqual(MAX_CARD_PAYLOAD_BYTES);
    expect(utf8Bytes(escaped) + 2048).toBeLessThan(MAX_SYNC_PUSH_BYTES);
  }
  expect(() => validateCardContent({ ...makeCard(), examples: new Array(1) })).toThrow();
  expect(() =>
    validateCardContent({
      ...makeCard(),
      examples: Array.from({ length: 21 }, () => ({ sentence: 'valid' })),
    }),
  ).toThrow();
  expect(() => validateCardContent({ ...makeCard(), frontText: '\ud800' })).toThrow();
  expect(() => validateCardContent({ ...makeCard(), frontText: '\udfff' })).toThrow();
});

test('selected legacy oversized retry retains identity, version and dependent history; invalid cards stay failed', async () => {
  const db = await RealSqliteDatabase.open();
  try {
    await runMigrations(db);
    const repos = createSqliteRepositories(db);
    const app = createApplication(repos, fixedClock, sequenceIds());
    const deck = await app.createDeck(makeDeck());
    const card = await app.createCard({
      ...makeCard(),
      deckId: deck.id,
      examples: Array.from({ length: 5 }, () => ({ sentence: 'a'.repeat(4000) })),
    });
    await app.reviewCard({
      cardId: card.id,
      deckId: deck.id,
      result: 'success',
      studySessionId: null,
    });
    const store = new SyncStore(db);
    const before = (await store.pending()).find((op) => op.entityType === 'card')!;
    await store.failed(before, false);
    await db.execute(
      `INSERT INTO sync_operations (operation_id,entity_type,entity_id,operation,payload_json,created_at,status) VALUES ('invalid','card','bad','upsert',?,?,'failed')`,
      [
        JSON.stringify({
          ...(before.payload as object),
          examples: [{ sentence: 'valid', translation: 42 }],
        }),
        card.createdAt,
      ],
    );
    await store.retryFailedCardUpload(before.operationId);
    const after = (await store.pending()).find((op) => op.operationId === before.operationId)!;
    expect(after).toEqual({ ...before, retryCount: 1 });
    await expect(store.retryFailedCardUpload('invalid')).rejects.toThrow();
    expect((await store.counts()).failed).toBe(1);
    expect(await repos.reviews.listEvents({ cardId: card.id })).toHaveLength(1);
    expect((await repos.reviews.getState(card.id))!.totalReviews).toBe(1);
    expect(
      (
        await db.execute('SELECT status FROM sync_operations WHERE operation_id=?', [
          before.operationId,
        ])
      ).rows[0]?.status,
    ).toBe('pending');
  } finally {
    db.handle.close();
  }
});

test('guest transfer validates nested fields and permits the audit large card without changing guest storage', async () => {
  const db = await RealSqliteDatabase.open();
  try {
    await runMigrations(db);
    const repos = createSqliteRepositories(db);
    const app = createApplication(repos, fixedClock, sequenceIds());
    const deck = await app.createDeck(makeDeck());
    const card = await app.createCard({
      ...makeCard(),
      deckId: deck.id,
      examples: Array.from({ length: 5 }, () => ({ sentence: 'a'.repeat(4000) })),
    });
    expect(unsupportedReasons(await readGuest(db))).toEqual([]);
    const malformed = '[{"sentence":"valid","translation":42,"notes":["array"]}]';
    await db.execute('UPDATE cards SET examples_json=? WHERE id=?', [malformed, card.id]);
    expect(unsupportedReasons(await readGuest(db))).toEqual([expect.stringMatching(/integrity/)]);
    expect(
      (await db.execute('SELECT examples_json FROM cards WHERE id=?', [card.id])).rows[0]
        ?.examples_json,
    ).toBe(malformed);
  } finally {
    db.handle.close();
  }
});

test.each([
  ['csv', csvAdapter],
  ['xlsx', xlsxAdapter],
  ['apkg', apkgAdapter],
] as const)(
  '%s large valid import/export retains all fields and malformed data is excluded before creation',
  async (format, adapter) => {
    const card = {
      deckName: 'Mixed فارسی',
      ...makeCard(),
      examples: Array.from({ length: 20 }, () => ({
        sentence: 'a'.repeat(4000),
        translation: 'ی'.repeat(4000),
        notes: '😀'.repeat(2000),
      })),
    };
    const bytes = await adapter.serialize([card], [card.deckName]);
    const parsed = await adapter.parse(bytes, card.deckName);
    expect(parsed.issues).toEqual([]);
    expect(parsed.records[0]!.card.examples).toEqual(card.examples);
    expect(validateCardContent(parsed.records[0]!.card)).toMatchObject({ examples: card.examples });
    expect(format).toBeTruthy();
  },
  30000,
);

test('export refuses an incomplete deck; normal creation rejects invalid examples without writing an outbox entry', async () => {
  const db = await RealSqliteDatabase.open();
  try {
    await runMigrations(db);
    const repos = createSqliteRepositories(db);
    const app = createApplication(repos, fixedClock, sequenceIds());
    const deck = await app.createDeck(makeDeck());
    const store = new SyncStore(db);
    const before = await store.counts();
    await expect(
      app.createCard({
        ...makeCard(),
        deckId: deck.id,
        examples: [{ sentence: 'valid', notes: [] }],
      } as never),
    ).rejects.toThrow();
    expect(await store.counts()).toEqual(before);
    const card = await app.createCard({ ...makeCard(), deckId: deck.id });
    await db.execute('UPDATE cards SET examples_json=? WHERE id=?', [
      '[{"sentence":"valid","notes":{}}]',
      card.id,
    ]);
    expect((await app.getCardListSnapshot(deck.id)).integrityIssues).toHaveLength(1);
    const service = createTransferService(app, repos, {
      csv: csvAdapter,
      xlsx: xlsxAdapter,
      apkg: apkgAdapter,
    });
    await expect(service.export('csv', deck.id)).rejects.toThrow(/integrity/);
    await expect(app.updateDeck(deck.id, { reviewSystem: 'sm2' })).rejects.toThrow(/empty/);
  } finally {
    db.handle.close();
  }
});

test('malformed retained card history remains available to analytics while valid cards remain searchable and studyable', async () => {
  const db = await RealSqliteDatabase.open();
  try {
    await runMigrations(db);
    const repos = createSqliteRepositories(db);
    const app = createApplication(repos, fixedClock, sequenceIds());
    const deck = await app.createDeck(makeDeck());
    const bad = await app.createCard({ ...makeCard(), deckId: deck.id });
    await app.reviewCard({
      cardId: bad.id,
      deckId: deck.id,
      result: 'success',
      studySessionId: null,
    });
    const good = await app.createCard({ ...makeCard(), deckId: deck.id });
    const originalState = await repos.reviews.getState(bad.id);
    const originalHistory = await repos.reviews.listEvents({ cardId: bad.id });
    await db.execute('UPDATE cards SET examples_json=? WHERE id=?', [
      '[{"sentence":"valid","translation":42}]',
      bad.id,
    ]);
    expect((await app.searchCards(deck.id, 'hello')).map((card) => card.id)).toEqual([good.id]);
    expect(
      (
        await app.getStudyQueue({
          scope: { kind: 'all-decks' },
          targetDate: calendarDate('2026-09-24'),
        })
      ).map((item) => item.cardId),
    ).toEqual([good.id]);
    expect(await app.getCardsReviewedToday()).toBe(1);
    expect(await repos.reviews.getState(bad.id)).toEqual(originalState);
    expect(await repos.reviews.listEvents({ cardId: bad.id })).toEqual(originalHistory);
    await expect(
      app.updateCard(bad.id, { meaning: 'do not replace unknown content' }),
    ).rejects.toThrow(/integrity/);
  } finally {
    db.handle.close();
  }
});

test('CloudClient checks large-card capability and actual body bytes without changing operation identity', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue(
    JSON.stringify({
      phoneVerified: true,
      accessToken: 'access',
      refreshToken: 'refresh',
      accessExpiresAtUtc: '2099-01-01T00:00:00.000Z',
    }),
  );
  const operation: PendingOperation = {
    sequence: 1,
    operationId: 'stable',
    entityType: 'card',
    entityId: 'card',
    operation: 'upsert',
    expectedVersion: 7,
    createdAt: '2026-11-13T00:00:00.000Z',
    retryCount: 1,
    status: 'pending',
    payload: {
      deckId: 'deck',
      ...validateCardContent({
        ...makeCard(),
        examples: Array.from({ length: 20 }, () => ({
          sentence: 'ی'.repeat(4000),
          translation: '😀'.repeat(2000),
          notes: '"\\\n'.repeat(1000),
        })),
      }),
    },
  };
  globalThis.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, status: 200, json: async () => ({ version: 2 }) });
  await expect(new CloudClient().push(operation, 'device', 'owner')).rejects.toMatchObject({
    status: 426,
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  globalThis.fetch = jest.fn().mockImplementation(async (url) => ({
    ok: true,
    status: 200,
    json: async () =>
      String(url).endsWith('/capabilities')
        ? {
            version: 2,
            cardContentContractVersion: 1,
            maxCardPayloadBytes: MAX_CARD_PAYLOAD_BYTES,
          }
        : { cursor: 8, changes: [{ status: 'applied', serverVersion: 8 }] },
  }));
  const cloud = new CloudClient();
  await cloud.push(operation, 'device', 'owner');
  await cloud.push(operation, 'device', 'owner');
  const bodies = jest
    .mocked(fetch)
    .mock.calls.filter(([url]) => String(url).endsWith('/push'))
    .map(([, init]) => String(init?.body));
  expect(bodies[0]).toBe(bodies[1]);
  expect(utf8Bytes(bodies[0]!)).toBeLessThan(MAX_SYNC_PUSH_BYTES);
  expect(JSON.parse(bodies[0]!).changes[0]).toMatchObject({
    clientChangeId: 'stable',
    expectedVersion: 7,
    payload: operation.payload,
  });
});
