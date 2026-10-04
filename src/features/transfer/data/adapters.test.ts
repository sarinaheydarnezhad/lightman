import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import * as XLSX from 'xlsx';
import { readFileSync, writeFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { TextDecoder } from 'node:util';
import type initSqlJs from 'sql.js';
import type { TransferAdapter, TransferCard } from '../domain/transfer';
import { csvAdapter } from './csv-adapter';
import { xlsxAdapter } from './xlsx-adapter';
import { apkgAdapter } from './apkg-adapter';
import { sqliteEngine } from './sqlite-codec';
import { createApplication } from '@/core/application/create-application';
import { fixedClock, makeRepositories, sequenceIds } from '@/../test/fixtures';
import { createTransferService } from '../application/transfer-service';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA1: 'SHA-1' },
  digestStringAsync: async (_algorithm: string, value: string) =>
    jest.requireActual('node:crypto').createHash('sha1').update(value).digest('hex'),
}));

jest.mock('./sqlite-codec', () => jest.requireActual('./sqlite-codec.web'));

export const transferCard: TransferCard = {
  deckName: 'واژگان / العربية',
  frontText: 'سلام, "hello"\nمرحبا <literal> & text',
  meaning: 'معنی\nmeaning, "quoted"',
  phonetic: '/sæˈlɑːm/',
  category: 'اسم',
  examples: [
    {
      sentence: 'سلام، دنیا\nHello, world.',
      translation: 'مرحبا',
      notes: '"A note", multiline\nمتن',
    },
  ],
};

const adapters: [string, TransferAdapter][] = [
  ['CSV', csvAdapter],
  ['XLSX', xlsxAdapter],
  ['APKG', apkgAdapter],
];

test.each(['legacy', 'modern'])('reads a genuine %s Anki-exported collection', async (kind) => {
  const bytes = new Uint8Array(
    Buffer.from(readFileSync(`test/fixtures/anki-${kind}.apkg.base64`, 'utf8').trim(), 'base64'),
  );
  const parsed = await apkgAdapter.parse(bytes, 'Fallback');
  expect(parsed.issues).toEqual([]);
  expect(parsed.records).toHaveLength(1);
  expect(parsed.records[0]?.card).toMatchObject(transferCard);
});

test('the APKG SQLite codec runs without Node, WASM, DOM, or network APIs', async () => {
  const module = { exports: {} as unknown };
  const source = readFileSync(require.resolve('sql.js/dist/sql-asm-memory-growth.js'), 'utf8');
  new Script(source).runInNewContext({
    TextDecoder,
    WebAssembly: undefined,
    module,
    exports: module.exports,
    console,
    setTimeout,
    clearTimeout,
    crypto: jest.requireActual('node:crypto').webcrypto,
  });
  const initialize = module.exports as typeof initSqlJs;
  const engine = await initialize();
  const database = new engine.Database();
  try {
    database.run('CREATE TABLE content (value TEXT)');
    database.run('INSERT INTO content VALUES (?)', ['سلام\nمرحبا']);
    expect(database.exec('SELECT value FROM content')[0]?.values).toEqual([['سلام\nمرحبا']]);
    expect(database.export().length).toBeGreaterThan(0);
  } finally {
    database.close();
  }
}, 20_000);

describe.each(adapters)('%s adapter', (_name, adapter) => {
  test('imports into repositories only after confirmation, with normal SRS and repeat-import deduplication', async () => {
    const repositories = makeRepositories();
    const app = createApplication(repositories, fixedClock, sequenceIds());
    const service = createTransferService(app, repositories, {
      csv: adapter,
      xlsx: adapter,
      apkg: adapter,
    });
    const bytes = await adapter.serialize(
      [
        transferCard,
        transferCard,
        { ...transferCard, deckName: 'Other', frontText: 'another' },
        { ...transferCard, frontText: 'invalid', meaning: '' },
      ],
      [transferCard.deckName, 'Other'],
    );
    const preview = await service.preview('csv', bytes, 'Cards.csv');
    expect(preview).toMatchObject({ totalCards: 4, newCards: 2, duplicates: 1, invalidRows: 1 });
    expect(await app.listDecks()).toEqual([]);
    expect(await service.confirm(preview)).toMatchObject({
      imported: 2,
      duplicatesSkipped: 1,
      invalidSkipped: 1,
    });
    const decks = await app.listDecks();
    expect(decks).toHaveLength(2);
    for (const deck of decks) {
      const cards = await app.listCardsForDeck(deck.id);
      expect(cards).toHaveLength(1);
      expect(await app.getReviewState(cards[0]!.id)).toMatchObject({
        box: 1,
        totalReviews: 0,
        lastReviewedAt: null,
      });
    }
    expect(await app.listReviewEvents()).toEqual([]);
    const exported = await service.export('csv');
    expect(await service.preview('csv', exported, 'Repeat.csv')).toMatchObject({
      totalCards: 2,
      duplicates: 2,
      newCards: 0,
    });
  });
  test('round trips every content field, Unicode, quotes, commas, and multiline text', async () => {
    const bytes = await adapter.serialize([transferCard], [transferCard.deckName]);
    const parsed = await adapter.parse(bytes, 'Fallback');
    expect(parsed.issues).toEqual([]);
    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0]?.card).toMatchObject(transferCard);
  });
  test('round trips empty optional fields and multiple decks', async () => {
    const second = {
      ...transferCard,
      deckName: 'English',
      frontText: 'Term',
      meaning: 'Definition',
      category: null,
      phonetic: null,
      examples: [],
    };
    const bytes = await adapter.serialize(
      [transferCard, second],
      [transferCard.deckName, 'English'],
    );
    const parsed = await adapter.parse(bytes, 'Fallback');
    expect(parsed.records.map(({ card }) => card)).toMatchObject([transferCard, second]);
    expect(parsed.issues).toEqual([]);
  });
  test('preserves multiline text and literal markup from CRLF inputs', async () => {
    const card = { ...transferCard, frontText: 'line 1\r\nline 2 <b>literal</b>' };
    const parsed = await adapter.parse(await adapter.serialize([card], [card.deckName]), 'Deck');
    expect(parsed.records[0]?.card.frontText).toBe(
      _name === 'XLSX' ? card.frontText.replace(/\r\n/g, '\n') : card.frontText,
    );
  });
  test('exports a valid empty file', async () => {
    const bytes = await adapter.serialize([], []);
    expect((await adapter.parse(bytes, 'Fallback')).records).toEqual([]);
  });
});

test('CSV recognizes aliases, BOM, missing optional values, and file-name deck fallback', async () => {
  const parsed = await csvAdapter.parse(
    strToU8('\uFEFFfront_text,meaning,phonetic\r\nسلام,مرحبا,\r\n'),
    'My deck',
  );
  expect(parsed.records[0]?.card).toEqual({
    deckName: 'My deck',
    frontText: 'سلام',
    meaning: 'مرحبا',
    phonetic: null,
    category: null,
    examples: [],
  });
});

test('CSV reports malformed quoting and examples without losing valid rows', async () => {
  const parsed = await csvAdapter.parse(
    strToU8(
      'Front,Back,Examples\nvalid,back,[]\nbad"quote,back,[]\ninvalid,back,not-json\n"unclosed,back,[]',
    ),
    'Deck',
  );
  expect(parsed.records).toHaveLength(1);
  expect(parsed.issues).toHaveLength(3);
  expect(parsed.issues.map((issue) => issue.location).sort()).toEqual(['Row 3', 'Row 4', 'Row 5']);
});

test('CSV rejects unrecognized and ambiguous headers', async () => {
  await expect(csvAdapter.parse(strToU8('One,Two\na,b'), 'Deck')).rejects.toThrow('headers');
  await expect(csvAdapter.parse(strToU8('Front,Back,Meaning\na,b,c'), 'Deck')).rejects.toThrow(
    'Ambiguous',
  );
});

test('XLSX finds headers below introductory rows and ignores unrelated worksheets', async () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['Budget', 'Cost'],
      ['x', 100],
    ]),
    'Unrelated',
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['My flashcards'],
      ['Deck Name', 'Question', 'Answer', 'Category'],
      ['فارسی', 'سؤال\nدوم', 'جواب', 'اسم'],
    ]),
    'Vocabulary',
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([
      ['Front', 'Back'],
      ['a', 'b'],
    ]),
    'More cards',
  );
  const parsed = await xlsxAdapter.parse(
    new Uint8Array(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })),
    'Fallback',
  );
  expect(parsed.records).toHaveLength(2);
  expect(parsed.records[0]).toMatchObject({
    location: 'Vocabulary: Row 3',
    card: { deckName: 'فارسی', frontText: 'سؤال\nدوم', category: 'اسم' },
  });
});

test('XLSX writes string cells, not formulas, and recognizes a real ZIP workbook', async () => {
  const bytes = await xlsxAdapter.serialize([{ ...transferCard, frontText: '=1+1' }], []);
  expect(unzipSync(bytes)['[Content_Types].xml']).toBeDefined();
  const workbook = XLSX.read(bytes, { type: 'array' });
  expect(workbook.Sheets.Cards?.B2).toMatchObject({ t: 's', v: '=1+1' });
  expect(workbook.Sheets.Cards?.B2.f).toBeUndefined();
});

test('XLSX rejects workbooks with no card worksheet', async () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Unrelated']]), 'Data');
  await expect(
    xlsxAdapter.parse(
      new Uint8Array(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })),
      'Deck',
    ),
  ).rejects.toThrow('worksheet');
});

test('XLSX preserves large supported examples across continuation cells on one card row', async () => {
  const card = {
    ...transferCard,
    examples: Array.from({ length: 20 }, () => ({
      sentence: '😀'.repeat(2000),
      translation: 'س'.repeat(4000),
      notes: 'n'.repeat(4000),
    })),
  };
  const bytes = await xlsxAdapter.serialize([card], [card.deckName]);
  const workbook = XLSX.read(bytes, { type: 'array' });
  expect(workbook.Sheets.Cards?.G1.v).toBe('Examples 2');
  expect(workbook.Sheets.Cards?.['!ref']).toMatch(/2$/);
  const parsed = await xlsxAdapter.parse(bytes, 'Fallback');
  expect(parsed.issues).toEqual([]);
  expect(parsed.records[0]?.card.examples).toEqual(card.examples);
});

test('APKG contains an actual SQLite Anki schema, valid note type, cards, and media map', async () => {
  const bytes = await apkgAdapter.serialize([transferCard], [transferCard.deckName]);
  const files = unzipSync(bytes);
  expect(Object.keys(files).sort()).toEqual(['collection.anki2', 'media']);
  expect(strFromU8(files.media!)).toBe('{}');
  expect(strFromU8(files['collection.anki2']!.subarray(0, 16))).toBe('SQLite format 3\0');
  const engine = await sqliteEngine();
  const database = new engine.Database(files['collection.anki2']);
  try {
    expect(database.exec('PRAGMA integrity_check')[0]?.values).toEqual([['ok']]);
    expect(database.exec('SELECT ver FROM col')[0]?.values).toEqual([[11]]);
    expect(database.exec('SELECT type, queue, reps FROM cards')[0]?.values).toEqual([[0, 0, 0]]);
    expect(database.exec('SELECT count(*) FROM revlog')[0]?.values).toEqual([[0]]);
    const models = JSON.parse(String(database.exec('SELECT models FROM col')[0]?.values[0]?.[0]));
    expect(Object.values(models)[0]).toMatchObject({
      name: 'Lightman',
      type: 0,
      tmpls: [{ qfmt: '{{Front}}' }],
    });
  } finally {
    database.close();
  }
  if (process.env.ANKI_TEST_PACKAGE) writeFileSync(process.env.ANKI_TEST_PACKAGE, bytes);
});

test('APKG reads real legacy custom notes, fields, tags, filtered decks, and multiple templates', async () => {
  const exported = await apkgAdapter.serialize([transferCard], [transferCard.deckName]);
  const files = unzipSync(exported);
  const engine = await sqliteEngine();
  const database = new engine.Database(files['collection.anki2']);
  try {
    const modelId = Number(database.exec('SELECT mid FROM notes')[0]?.values[0]?.[0]);
    const deckId = Number(database.exec('SELECT did FROM cards')[0]?.values[0]?.[0]);
    database.run('UPDATE col SET models = ?', [
      JSON.stringify({
        [modelId]: {
          name: 'Custom type',
          flds: ['Custom A', 'Custom B', 'Phonetic', 'Category', 'Unknown'].map((name, ord) => ({
            name,
            ord,
          })),
        },
      }),
    ]);
    database.run('UPDATE notes SET flds = ?, tags = ?', [
      '<b>سلام</b><br>next\x1fمعنی &amp; meaning\x1fIPA\x1fاسم\x1fignored',
      ' tag1 فارسی ',
    ]);
    database.run('UPDATE cards SET odid = ?, did = 999, type = 2, queue = 2, reps = 50', [deckId]);
    database.run(
      'INSERT INTO cards SELECT id+1,nid,did,1,mod,usn,type,queue,due,ivl,factor,reps,lapses,left,odue,odid,flags,data FROM cards',
    );
    const parsed = await apkgAdapter.parse(
      zipSync({ 'collection.anki21': database.export(), media: strToU8('{}') }),
      'Fallback',
    );
    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0]?.card).toMatchObject({
      deckName: transferCard.deckName,
      frontText: 'سلام\nnext',
      meaning: 'معنی & meaning',
      phonetic: 'IPA',
      category: 'اسم',
      examples: [],
      tags: ['tag1', 'فارسی'],
    });
  } finally {
    database.close();
  }
});

test('APKG rejects invalid packages and reports malformed notes', async () => {
  await expect(apkgAdapter.parse(zipSync({ media: strToU8('{}') }), 'Deck')).rejects.toThrow(
    'valid Anki',
  );
  const files = unzipSync(await apkgAdapter.serialize([transferCard], [transferCard.deckName]));
  const engine = await sqliteEngine();
  const database = new engine.Database(files['collection.anki2']);
  try {
    database.run('UPDATE notes SET flds = ?', ['Single field']);
    const parsed = await apkgAdapter.parse(
      zipSync({ 'collection.anki2': database.export() }),
      'Deck',
    );
    expect(parsed.records).toEqual([]);
    expect(parsed.issues[0]?.message).toMatch('two fields');
  } finally {
    database.close();
  }
});
