import { digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { Decompress } from 'fzstd';
import type { PackageDatabase, PackageValue } from './package-database';
import type { ImportIssue, ImportRecord, TransferAdapter } from '../domain/transfer';
import { normalizeIdentity } from '../domain/transfer';
import { recognizedHeader, tableToImport } from './tabular';
import { sqliteEngine } from './sqlite-codec';

const fieldNames = ['Front', 'Back', 'Phonetic', 'Category', 'Examples'];
const maxCollectionSize = 100 * 1024 * 1024;

export function htmlToText(value: string): string {
  const entities: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
  };
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(?:div|p|li)>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (entity, name: string) => {
      if (name.startsWith('#')) {
        const number =
          name[1]?.toLowerCase() === 'x'
            ? parseInt(name.slice(2), 16)
            : parseInt(name.slice(1), 10);
        return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : entity;
      }
      return entities[name.toLowerCase()] ?? entity;
    });
}

function textToHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\r/g, '&#13;')
    .replace(/\n/g, '<br>');
}

function rows(database: PackageDatabase, sql: string): Record<string, PackageValue>[] {
  const result = database.exec(sql)[0];
  return result
    ? result.values.map((values) =>
        Object.fromEntries(result.columns.map((column, index) => [column, values[index] ?? null])),
      )
    : [];
}

function decompressCollection(bytes: Uint8Array): Uint8Array {
  const chunks: Uint8Array[] = [];
  let size = 0;
  const decoder = new Decompress((chunk) => {
    size += chunk.length;
    if (size > maxCollectionSize) throw new Error('Anki collection exceeds the 100 MB limit.');
    chunks.push(chunk);
  });
  decoder.push(bytes, true);
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return output;
}

const schema = `
CREATE TABLE col (id integer primary key, crt integer not null, mod integer not null,
scm integer not null, ver integer not null, dty integer not null, usn integer not null,
ls integer not null, conf text not null, models text not null, decks text not null,
dconf text not null, tags text not null);
CREATE TABLE notes (id integer primary key, guid text not null, mid integer not null,
mod integer not null, usn integer not null, tags text not null, flds text not null,
sfld integer not null, csum integer not null, flags integer not null, data text not null);
CREATE TABLE cards (id integer primary key, nid integer not null, did integer not null,
ord integer not null, mod integer not null, usn integer not null, type integer not null,
queue integer not null, due integer not null, ivl integer not null, factor integer not null,
reps integer not null, lapses integer not null, left integer not null, odue integer not null,
odid integer not null, flags integer not null, data text not null);
CREATE TABLE revlog (id integer primary key, cid integer not null, usn integer not null,
ease integer not null, ivl integer not null, lastIvl integer not null, factor integer not null,
time integer not null, type integer not null);
CREATE TABLE graves (usn integer not null, oid integer not null, type integer not null);
CREATE INDEX ix_notes_usn ON notes(usn);
CREATE INDEX ix_cards_usn ON cards(usn);
CREATE INDEX ix_revlog_usn ON revlog(usn);
CREATE INDEX ix_cards_nid ON cards(nid);
CREATE INDEX ix_cards_sched ON cards(did, queue, due);
CREATE INDEX ix_revlog_cid ON revlog(cid);
CREATE INDEX ix_notes_csum ON notes(csum);`;

export const apkgAdapter: TransferAdapter = {
  async parse(bytes, fallbackDeck) {
    const files = unzipSync(bytes, {
      filter: (file) => {
        const selected = ['collection.anki2', 'collection.anki21', 'collection.anki21b'].includes(
          file.name,
        );
        if (selected && file.originalSize > maxCollectionSize)
          throw new Error('Anki collection is too large.');
        return selected;
      },
    });
    const compressed = files['collection.anki21b'];
    const collection = compressed
      ? decompressCollection(compressed)
      : (files['collection.anki21'] ?? files['collection.anki2']);
    if (!collection || strFromU8(collection.subarray(0, 16)) !== 'SQLite format 3\0') {
      throw new Error('Not a valid Anki package: missing SQLite collection.');
    }
    const engine = await sqliteEngine();
    const database = new engine.Database(collection);
    try {
      const col = rows(database, 'SELECT ver, decks, models FROM col LIMIT 1')[0];
      if (!col) throw new Error('Missing Anki collection metadata.');
      const deckNames = new Map<string, string>();
      const modelFields = new Map<string, string[]>();
      if (Number(col.ver) <= 11) {
        const decks = JSON.parse(String(col.decks)) as Record<string, { name: string }>;
        const models = JSON.parse(String(col.models)) as Record<
          string,
          { flds: { name: string; ord: number }[] }
        >;
        Object.entries(decks).forEach(([id, deck]) => deckNames.set(id, deck.name));
        Object.entries(models).forEach(([id, model]) =>
          modelFields.set(
            id,
            [...model.flds]
              .sort((first, second) => first.ord - second.ord)
              .map((field) => field.name),
          ),
        );
      } else {
        rows(database, 'SELECT id, name FROM decks').forEach((deck) =>
          deckNames.set(String(deck.id), String(deck.name).replace(/\x1f/g, '::')),
        );
        rows(database, 'SELECT ntid, ord, name FROM fields ORDER BY ntid, ord').forEach((field) => {
          const id = String(field.ntid);
          const fields = modelFields.get(id) ?? [];
          fields[Number(field.ord)] = String(field.name);
          modelFields.set(id, fields);
        });
      }
      const notes = rows(
        database,
        `SELECT DISTINCT n.id, n.mid, n.flds, n.tags,
        CASE WHEN c.odid != 0 THEN c.odid ELSE c.did END AS did
        FROM notes n JOIN cards c ON c.nid = n.id ORDER BY n.id, did`,
      );
      const records: ImportRecord[] = [];
      const issues: ImportIssue[] = [];
      for (const note of notes) {
        const location = `Note ${note.id}, deck ${note.did}`;
        try {
          const fields = String(note.flds).split('\x1f').map(htmlToText);
          if (fields.length < 2) throw new Error('Anki note requires at least two fields.');
          const names = modelFields.get(String(note.mid)) ?? [];
          const known = names.map(recognizedHeader);
          const front = fields[0];
          const back = fields[1];
          const optional = (field: string) => {
            const index = known.indexOf(field as ReturnType<typeof recognizedHeader>);
            return index >= 2 ? (fields[index] ?? '') : '';
          };
          const exampleText = optional('examples');
          const examples =
            exampleText.trim() && !exampleText.trim().startsWith('[')
              ? JSON.stringify([{ sentence: exampleText }])
              : exampleText;
          const parsed = tableToImport(
            [
              ['Deck', ...fieldNames],
              [
                deckNames.get(String(note.did)) ?? fallbackDeck,
                front ?? '',
                back ?? '',
                optional('phonetic'),
                optional('category'),
                examples,
              ],
            ],
            fallbackDeck,
          );
          if (parsed.issues.length) throw new Error(parsed.issues[0]!.message);
          const card = parsed.records[0]?.card;
          if (!card) throw new Error('Empty Anki note.');
          records.push({
            location,
            card: { ...card, tags: String(note.tags).trim().split(/\s+/).filter(Boolean) },
          });
        } catch (error) {
          issues.push({
            location,
            message: error instanceof Error ? error.message : 'Invalid Anki note.',
          });
        }
      }
      rows(database, 'SELECT id FROM notes WHERE id NOT IN (SELECT nid FROM cards)').forEach(
        (note) =>
          issues.push({ location: `Note ${note.id}`, message: 'Note has no card or deck.' }),
      );
      return { records, issues };
    } finally {
      database.close();
    }
  },
  async serialize(cards, deckNames) {
    const engine = await sqliteEngine();
    const database = new engine.Database();
    try {
      database.run(schema);
      const stamp = Date.now();
      const seconds = Math.floor(stamp / 1000);
      const modelId = stamp;
      const names = new Map<string, string>();
      [...deckNames, ...cards.map((card) => card.deckName)].forEach((name) =>
        names.set(normalizeIdentity(name), name),
      );
      const deckIds = new Map<string, number>();
      const decks: Record<string, unknown> = {};
      let nextDeckId = stamp + 1;
      for (const [key, name] of names) {
        const id = key === normalizeIdentity('Default') ? 1 : nextDeckId++;
        deckIds.set(key, id);
        decks[id] = {
          id,
          name,
          desc: '',
          mod: seconds,
          usn: -1,
          dyn: 0,
          collapsed: false,
          browserCollapsed: false,
          conf: 1,
          extendNew: 0,
          extendRev: 0,
          newToday: [0, 0],
          revToday: [0, 0],
          lrnToday: [0, 0],
          timeToday: [0, 0],
        };
      }
      decks[1] ??= {
        id: 1,
        name: 'Default',
        desc: '',
        mod: seconds,
        usn: -1,
        dyn: 0,
        collapsed: false,
        browserCollapsed: false,
        conf: 1,
        extendNew: 0,
        extendRev: 0,
        newToday: [0, 0],
        revToday: [0, 0],
        lrnToday: [0, 0],
        timeToday: [0, 0],
      };
      const model = {
        id: modelId,
        name: 'Lerona',
        type: 0,
        mod: seconds,
        usn: -1,
        sortf: 0,
        did: 1,
        latexPre: '',
        latexPost: '',
        latexsvg: false,
        tags: [],
        vers: [],
        css: '.card { font-family: sans-serif; font-size: 20px; text-align: center; }',
        flds: fieldNames.map((name, ord) => ({
          name,
          ord,
          sticky: false,
          rtl: false,
          font: 'Arial',
          size: 20,
          media: [],
        })),
        tmpls: [
          {
            name: 'Card 1',
            ord: 0,
            qfmt: '{{Front}}',
            afmt: '{{FrontSide}}<hr id="answer">{{Back}}',
            bqfmt: '',
            bafmt: '',
            did: null,
          },
        ],
        req: [[0, 'all', [0]]],
      };
      const config = {
        id: 1,
        name: 'Default',
        mod: seconds,
        usn: 0,
        maxTaken: 60,
        autoplay: true,
        timer: 0,
        replayq: true,
        new: {
          delays: [1, 10],
          ints: [1, 4],
          initialFactor: 2500,
          separate: true,
          order: 1,
          perDay: 20,
          bury: false,
        },
        rev: {
          perDay: 200,
          ease4: 1.3,
          fuzz: 0.05,
          ivlFct: 1,
          maxIvl: 36500,
          bury: false,
          hardFactor: 1.2,
        },
        lapse: { delays: [10], mult: 0, minInt: 1, leechFails: 8, leechAction: 0 },
      };
      database.run('INSERT INTO col VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', [
        1,
        seconds,
        stamp,
        stamp,
        11,
        0,
        -1,
        0,
        JSON.stringify({
          nextPos: cards.length + 1,
          curModel: modelId,
          curDeck: 1,
          activeDecks: [1],
          newSpread: 0,
          collapseTime: 1200,
          timeLim: 0,
          estTimes: true,
          dueCounts: true,
          sortType: 'noteFld',
          sortBackwards: false,
          addToCur: true,
        }),
        JSON.stringify({ [modelId]: model }),
        JSON.stringify(decks),
        JSON.stringify({ 1: config }),
        '{}',
      ]);
      for (let index = 0; index < cards.length; index++) {
        const card = cards[index]!;
        const id = stamp + index;
        const values = [
          card.frontText,
          card.meaning,
          card.phonetic ?? '',
          card.category ?? '',
          JSON.stringify(card.examples),
        ];
        const checksum = parseInt(
          (await digestStringAsync(CryptoDigestAlgorithm.SHA1, card.frontText)).slice(0, 8),
          16,
        );
        database.run('INSERT INTO notes VALUES (?,?,?,?,?,?,?,?,?,?,?)', [
          id,
          `lm${stamp.toString(36)}${index.toString(36)}`,
          modelId,
          seconds,
          -1,
          card.tags?.length ? ` ${card.tags.join(' ')} ` : '',
          values.map(textToHtml).join('\x1f'),
          card.frontText,
          checksum,
          0,
          '',
        ]);
        database.run('INSERT INTO cards VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [
          id,
          id,
          deckIds.get(normalizeIdentity(card.deckName))!,
          0,
          seconds,
          -1,
          0,
          0,
          index + 1,
          0,
          2500,
          0,
          0,
          0,
          0,
          0,
          0,
          '',
        ]);
      }
      return zipSync({ 'collection.anki2': database.export(), media: strToU8('{}') });
    } finally {
      database.close();
    }
  },
};
