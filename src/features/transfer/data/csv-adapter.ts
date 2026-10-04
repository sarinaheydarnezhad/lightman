import { strFromU8, strToU8 } from 'fflate';
import type { TransferAdapter } from '../domain/transfer';
import { tableToImport, transferToTable } from './tabular';

export function parseCsv(text: string): { rows: string[][]; invalid: Set<number> } {
  const rows: string[][] = [];
  const invalid = new Set<number>();
  let row: string[] = [];
  let value = '';
  let quoted = false;
  let closed = false;
  let malformed = false;
  function finishField() {
    row.push(value);
    value = '';
    closed = false;
  }
  function finishRow() {
    finishField();
    rows.push(row);
    if (malformed) invalid.add(rows.length - 1);
    row = [];
    malformed = false;
  }
  text = text.replace(/^\uFEFF/, '');
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          value += '"';
          index++;
        } else {
          quoted = false;
          closed = true;
        }
      } else value += character;
    } else if (character === ',') finishField();
    else if (character === '\r' || character === '\n') {
      if (character === '\r' && text[index + 1] === '\n') index++;
      finishRow();
    } else if (character === '"' && !value && !closed) quoted = true;
    else {
      if (closed || character === '"') malformed = true;
      value += character;
    }
  }
  if (quoted) malformed = true;
  if (value || row.length || quoted || closed) finishRow();
  return { rows, invalid };
}

export const csvAdapter: TransferAdapter = {
  async parse(bytes, fallbackDeck) {
    const { rows, invalid } = parseCsv(strFromU8(bytes));
    if (invalid.has(0)) throw new Error('Malformed CSV header.');
    const parsed = tableToImport(
      rows.map((row, index) => (invalid.has(index) ? [] : row)),
      fallbackDeck,
    );
    return {
      records: parsed.records,
      issues: [
        ...parsed.issues,
        ...[...invalid].map((index) => ({
          location: `Row ${index + 1}`,
          message: 'Malformed CSV quoting.',
        })),
      ],
    };
  },
  async serialize(cards) {
    const text = transferToTable(cards)
      .map((row) =>
        row
          .map((value) => (/[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value))
          .join(','),
      )
      .join('\r\n');
    return strToU8('\uFEFF' + text + '\r\n');
  },
};
