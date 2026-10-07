import type { ImportRecord, ParsedImport, TransferCard } from '../domain/transfer';

export const headers = ['Deck', 'Front', 'Back', 'Phonetic', 'Category', 'Examples'] as const;
type Field = 'deckName' | 'frontText' | 'meaning' | 'phonetic' | 'category' | 'examples';

export function recognizedHeader(value: string): Field | undefined {
  const aliases: Record<string, Field> = {
    deck: 'deckName',
    deckname: 'deckName',
    front: 'frontText',
    fronttext: 'frontText',
    question: 'frontText',
    back: 'meaning',
    meaning: 'meaning',
    answer: 'meaning',
    phonetic: 'phonetic',
    pronunciation: 'phonetic',
    category: 'category',
    examples: 'examples',
  };
  return aliases[
    value
      .replace(/^\uFEFF/, '')
      .toLowerCase()
      .replace(/[\s_-]/g, '')
  ];
}

export function hasCardHeaders(row: readonly string[]): boolean {
  const fields = row.map(recognizedHeader);
  return fields.includes('frontText') && fields.includes('meaning');
}

function extraKey(value: string, index: number): string {
  const trimmed = value.replace(/^\uFEFF/, '').trim();
  return trimmed || `Column ${index + 1}`;
}

export function tableToImport(
  rows: readonly (readonly string[])[],
  fallbackDeck: string,
  source = 'Row',
  headerIndex = 0,
): ParsedImport {
  const header = rows[headerIndex] ?? [];
  if (!hasCardHeaders(header)) throw new Error('No recognized Front and Back headers found.');
  const fields = header.map(recognizedHeader);
  const recognized = fields.filter(Boolean);
  if (new Set(recognized).size !== recognized.length)
    throw new Error('Ambiguous duplicate headers.');
  const records: ImportRecord[] = [];
  const issues: { location: string; message: string }[] = [];
  rows.slice(headerIndex + 1).forEach((row, offset) => {
    if (row.every((value) => !value.trim())) return;
    const location = `${source} ${headerIndex + offset + 2}`;
    try {
      const values: Partial<Record<Field, string>> = {};
      const extra: Record<string, string> = {};
      fields.forEach((field, index) => {
        const value = row[index] ?? '';
        if (field) values[field] = value;
        else extra[extraKey(header[index] ?? '', index)] = value;
      });
      for (let index = header.length; index < row.length; index++)
        extra[`Column ${index + 1}`] = row[index] ?? '';
      const examples: unknown = values.examples?.trim() ? JSON.parse(values.examples) : [];
      if (
        !Array.isArray(examples) ||
        examples.some(
          (example) =>
            !example ||
            typeof example.sentence !== 'string' ||
            (example.translation !== undefined && typeof example.translation !== 'string') ||
            (example.notes !== undefined && typeof example.notes !== 'string'),
        )
      )
        throw new Error('Examples must be an array of sentence/translation/notes objects.');
      records.push({
        location,
        card: {
          deckName: values.deckName?.trim() || fallbackDeck,
          frontText: values.frontText ?? '',
          meaning: values.meaning ?? '',
          phonetic: values.phonetic || null,
          category: values.category || null,
          examples,
          extra: Object.keys(extra).length ? extra : undefined,
        },
      });
    } catch (error) {
      issues.push({ location, message: error instanceof Error ? error.message : 'Invalid row.' });
    }
  });
  return { records, issues };
}

export function transferToTable(cards: readonly TransferCard[]): string[][] {
  const extraHeaders = [...new Set(cards.flatMap((card) => Object.keys(card.extra ?? {})))];
  return [
    [...headers, ...extraHeaders],
    ...cards.map((card) => [
      card.deckName,
      card.frontText,
      card.meaning,
      card.phonetic ?? '',
      card.category ?? '',
      JSON.stringify(card.examples),
      ...extraHeaders.map((key) => card.extra?.[key] ?? ''),
    ]),
  ];
}
