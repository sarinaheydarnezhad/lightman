import * as XLSX from 'xlsx';
import type { ImportIssue, ImportRecord, TransferAdapter } from '../domain/transfer';
import { hasCardHeaders, recognizedHeader, tableToImport, transferToTable } from './tabular';

function splitCell(value: string): string[] {
  const chunks: string[] = [];
  let offset = 0;
  while (offset < value.length) {
    let end = Math.min(offset + 30_000, value.length);
    const last = value.charCodeAt(end - 1);
    if (end < value.length && last >= 0xd800 && last <= 0xdbff) end--;
    chunks.push(value.slice(offset, end));
    offset = end;
  }
  return chunks.length ? chunks : [''];
}

function joinExampleColumns(rows: string[][], headerIndex: number): string[][] {
  const header = rows[headerIndex]!;
  const examplesIndex = header.findIndex((value) => recognizedHeader(value) === 'examples');
  const continuations = header
    .map((name, index) => ({
      index,
      part: Number(/^examples(\d+)$/i.exec(name.replace(/[\s_-]/g, ''))?.[1] ?? 0),
    }))
    .filter(({ part }) => part >= 2)
    .sort((first, second) => first.part - second.part);
  if (!continuations.length) return rows;
  if (examplesIndex < 0 || continuations.some(({ part }, index) => part !== index + 2)) {
    throw new Error(
      'Examples continuation headers must start at Examples and follow consecutively.',
    );
  }
  const indexes = new Set(continuations.map(({ index }) => index));
  return rows.map((row, index) => {
    const combined = [...row];
    if (index > headerIndex)
      combined[examplesIndex] =
        (row[examplesIndex] ?? '') +
        continuations.map(({ index: column }) => row[column] ?? '').join('');
    return combined.filter((_value, column) => !indexes.has(column));
  });
}

export const xlsxAdapter: TransferAdapter = {
  async parse(bytes, fallbackDeck) {
    const workbook = XLSX.read(bytes, { type: 'array', cellFormula: false, cellHTML: false });
    const records: ImportRecord[] = [];
    const issues: ImportIssue[] = [];
    let found = false;
    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      if (!sheet) continue;
      const rows = XLSX.utils
        .sheet_to_json<unknown[]>(sheet, {
          header: 1,
          defval: '',
          blankrows: true,
          raw: true,
          range: 0,
        })
        .map((row) => row.map((cell) => String(cell ?? '')));
      const headerIndex = rows.findIndex(hasCardHeaders);
      if (headerIndex < 0) continue;
      found = true;
      const parsed = tableToImport(
        joinExampleColumns(rows, headerIndex),
        fallbackDeck,
        `${name}: Row`,
        headerIndex,
      );
      for (const record of parsed.records) records.push(record);
      for (const issue of parsed.issues) issues.push(issue);
    }
    if (!found) throw new Error('No worksheet contains recognized Front and Back headers.');
    return { records, issues };
  },
  async serialize(cards) {
    const workbook = XLSX.utils.book_new();
    const table = transferToTable(cards);
    const exampleWidth = table
      .slice(1)
      .reduce((maximum, row) => Math.max(maximum, splitCell(row[5] ?? '').length), 1);
    const splitRows = table.slice(1).map((row) => {
      const examples = splitCell(row[5] ?? '');
      return [
        ...row.slice(0, 5),
        ...examples,
        ...Array.from({ length: exampleWidth - examples.length }, () => ''),
        ...row.slice(6),
      ];
    });
    const header = [
      ...table[0]!.slice(0, 5),
      table[0]![5] ?? 'Examples',
      ...Array.from({ length: exampleWidth - 1 }, (_value, index) => `Examples ${index + 2}`),
      ...table[0]!.slice(6),
    ];
    const sheet = XLSX.utils.aoa_to_sheet([header, ...splitRows]);
    sheet['!cols'] = [24, 40, 40, 24, 24, 60].map((width) => ({ wch: width }));
    XLSX.utils.book_append_sheet(workbook, sheet, 'Cards');
    return new Uint8Array(XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }));
  },
};
