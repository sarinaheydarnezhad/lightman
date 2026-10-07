import type { Card, CardExample } from '@/features/study/domain/card';

export type TransferFormat = 'csv' | 'xlsx' | 'apkg';

export interface TransferCard {
  readonly deckName: string;
  readonly frontText: string;
  readonly meaning: string;
  readonly phonetic: string | null;
  readonly category: string | null;
  readonly examples: readonly CardExample[];
  readonly tags?: readonly string[];
  readonly extra?: Readonly<Record<string, string>>;
}

export interface ImportIssue {
  readonly location: string;
  readonly message: string;
}
export interface ImportRecord {
  readonly location: string;
  readonly card: TransferCard;
}
export interface ParsedImport {
  readonly records: readonly ImportRecord[];
  readonly issues: readonly ImportIssue[];
}
export interface TransferAdapter {
  parse(bytes: Uint8Array, fallbackDeck: string): Promise<ParsedImport>;
  serialize(cards: readonly TransferCard[], deckNames: readonly string[]): Promise<Uint8Array>;
}
export function normalizeIdentity(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
}
export function duplicateKey(
  card: Pick<TransferCard, 'deckName' | 'frontText' | 'meaning'>,
): string {
  return JSON.stringify([
    normalizeIdentity(card.deckName),
    normalizeIdentity(card.frontText),
    normalizeIdentity(card.meaning),
  ]);
}
export function cardToTransfer(card: Card, deckName: string): TransferCard {
  return {
    deckName,
    frontText: card.frontText,
    meaning: card.meaning,
    phonetic: card.phonetic,
    category: card.category,
    examples: card.examples,
  };
}
