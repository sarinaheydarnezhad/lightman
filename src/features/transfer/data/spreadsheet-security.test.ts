import { strFromU8, strToU8 } from 'fflate';
import * as XLSX from 'xlsx';
import type { TransferCard } from '../domain/transfer';
import { csvAdapter } from './csv-adapter';
import { xlsxAdapter } from './xlsx-adapter';

const card: TransferCard = {
  deckName: 'Audit',
  frontText: 'word',
  meaning: 'meaning',
  phonetic: null,
  category: null,
  examples: [],
};

test('original =1+1 CSV reproduction is rejected without mutating learning content', async () => {
  const source = { ...card, frontText: '=1+1' };
  await expect(csvAdapter.serialize([source], [])).rejects.toMatchObject({
    code: 'spreadsheet_unsafe_csv',
  });
  expect(source.frontText).toBe('=1+1');
});

test.each([
  '=1+1',
  '+word',
  '-word',
  '-42',
  '@text',
  ' =1',
  '\tword',
  '\rword',
  '\nword',
  '\u00a0+1',
  '\u200b=1',
  '\ufeff@word',
  '\uFF1D1',
  '\uFF0B1',
  '\uFF0D1',
  '\uFF201',
])('rejects ambiguous CSV cell %j', async (frontText) => {
  await expect(csvAdapter.serialize([{ ...card, frontText }], [])).rejects.toMatchObject({
    code: 'spreadsheet_unsafe_csv',
  });
});

test.each(['deckName', 'frontText', 'meaning', 'phonetic', 'category'] as const)(
  'checks user-controlled %s cells',
  async (field) => {
    await expect(csvAdapter.serialize([{ ...card, [field]: '=1+1' }], [])).rejects.toMatchObject({
      code: 'spreadsheet_unsafe_csv',
    });
  },
);

test('checks extra values and user-controlled column headers', async () => {
  const fields: Record<string, string>[] = [{ Notes: '=1+1' }, { '=1+1': 'note' }];
  for (const extra of fields)
    await expect(csvAdapter.serialize([{ ...card, extra }], [])).rejects.toMatchObject({
      code: 'spreadsheet_unsafe_csv',
    });
});

test('CSV quoting, multilingual text, examples, apostrophes and embedded line breaks round trip', async () => {
  const source: TransferCard = {
    ...card,
    frontText: '\'apostrophe, "سلام"\n世界',
    meaning: '2 - 1 = 1',
    examples: [{ sentence: '=1+1', translation: '+word', notes: '-42\n@note' }],
    extra: { Notes: 'text,\n"notes"' },
  };
  const bytes = await csvAdapter.serialize([source], []);
  expect(strFromU8(bytes)).toContain('""سلام""');
  expect((await csvAdapter.parse(bytes, 'fallback')).records[0]?.card).toEqual(source);
});

test('legacy CSV import never executes formulas or strips apostrophes', async () => {
  const result = await csvAdapter.parse(
    strToU8("Deck,Front,Back,Phonetic,Category,Examples\r\nAudit,=1+1,'meaning,,,[]\r\n"),
    'fallback',
  );
  expect(result.issues).toEqual([]);
  expect(result.records[0]?.card).toMatchObject({ frontText: '=1+1', meaning: "'meaning" });
});

test('XLSX preserves formula-like text in every cell including notes and metadata without formula nodes', async () => {
  const source: TransferCard = {
    deckName: '=deck',
    frontText: '=1+1',
    meaning: '-42',
    phonetic: '+sound',
    category: '@tag',
    examples: [{ sentence: '=1+1', translation: '+text', notes: '@note\nسلام' }],
    extra: { '=header': '\t=value' },
  };
  const bytes = await xlsxAdapter.serialize([source], []);
  const workbook = XLSX.read(bytes, { type: 'array', cellFormula: true });
  for (const sheet of Object.values(workbook.Sheets))
    for (const [key, cell] of Object.entries(sheet)) {
      if (key.startsWith('!')) continue;
      expect(cell.t).toBe('s');
      expect(cell.f).toBeUndefined();
    }
  expect((await xlsxAdapter.parse(bytes, 'fallback')).records[0]?.card).toEqual(source);
});
