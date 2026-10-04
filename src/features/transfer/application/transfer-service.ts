import type { Application } from '@/core/application/create-application';
import { languageTag } from '@/core/domain/values';
import type { Repositories } from '@/core/ports/repositories';
import { validateDeckTitle, type Deck } from '@/features/decks/domain/deck';
import { validateCardContent } from '@/features/study/domain/card';
import {
  cardToTransfer,
  duplicateKey,
  normalizeIdentity,
  type ImportIssue,
  type ImportRecord,
  type ParsedImport,
  type TransferAdapter,
  type TransferFormat,
} from '../domain/transfer';

export interface ImportPreview {
  readonly format: TransferFormat;
  readonly decks: readonly string[];
  readonly totalCards: number;
  readonly newCards: number;
  readonly duplicates: number;
  readonly invalidRows: number;
  readonly issues: readonly ImportIssue[];
}

export interface ImportSummary {
  imported: number;
  duplicatesSkipped: number;
  invalidSkipped: number;
  issues: ImportIssue[];
}

export function createTransferService(
  app: Pick<Application, 'createDeck' | 'createCard' | 'listDecks' | 'listCardsForDeck'>,
  repositories: Pick<Repositories, 'decks' | 'cards'>,
  adapters: Record<TransferFormat, TransferAdapter>,
) {
  const plans = new WeakMap<ImportPreview, ParsedImport>();
  let saving = false;

  async function classify(parsed: ParsedImport) {
    const decks = await repositories.decks.list({ includeArchived: true });
    const matched = new Map<string, Deck>();
    const keys = new Set<string>();
    for (const deck of decks) {
      const name = normalizeIdentity(deck.name);
      if (!matched.has(name) || matched.get(name)?.archivedAt) matched.set(name, deck);
      for (const card of await repositories.cards.listByDeck(deck.id, { includeArchived: true })) {
        keys.add(duplicateKey(cardToTransfer(card, deck.name)));
      }
    }
    const issues = [...parsed.issues];
    const records: ImportRecord[] = [];
    let duplicates = 0;
    for (const record of parsed.records) {
      try {
        const card = {
          ...record.card,
          ...validateCardContent(record.card),
          deckName: validateDeckTitle(record.card.deckName),
        };
        const key = duplicateKey(card);
        if (keys.has(key)) {
          duplicates++;
          continue;
        }
        const deck = matched.get(normalizeIdentity(card.deckName));
        if (deck?.archivedAt)
          throw new Error('Matching deck is archived. Restore it before importing.');
        keys.add(key);
        records.push({ location: record.location, card });
      } catch (error) {
        issues.push({
          location: record.location,
          message: error instanceof Error ? error.message : 'Invalid card.',
        });
      }
    }
    return { records, issues, duplicates, matched };
  }

  return {
    async preview(
      format: TransferFormat,
      bytes: Uint8Array,
      fileName: string,
    ): Promise<ImportPreview> {
      if (bytes.length > 50 * 1024 * 1024) throw new Error('Files must be smaller than 50 MB.');
      const fallbackDeck = fileName.replace(/\.(csv|xlsx|apkg)$/i, '').trim() || 'Imported cards';
      const parsed = await adapters[format].parse(bytes, fallbackDeck);
      const classified = await classify(parsed);
      const names = new Map<string, string>();
      parsed.records.forEach(({ card }) => {
        names.set(normalizeIdentity(card.deckName), card.deckName.trim());
      });
      const preview = Object.freeze({
        format,
        decks: Object.freeze([...names.values()]),
        totalCards: parsed.records.length + parsed.issues.length,
        newCards: classified.records.length,
        duplicates: classified.duplicates,
        invalidRows: classified.issues.length,
        issues: Object.freeze(classified.issues),
      });
      plans.set(preview, parsed);
      return preview;
    },
    cancel(preview: ImportPreview) {
      plans.delete(preview);
    },
    async confirm(preview: ImportPreview): Promise<ImportSummary> {
      if (saving) throw new Error('An import is already being saved.');
      const parsed = plans.get(preview);
      if (!parsed) throw new Error('Select and preview a file before confirming.');
      saving = true;
      try {
        const classified = await classify(parsed);
        const summary: ImportSummary = {
          imported: 0,
          duplicatesSkipped: classified.duplicates,
          invalidSkipped: classified.issues.length,
          issues: [...classified.issues],
        };
        for (const { card, location } of classified.records) {
          try {
            const name = normalizeIdentity(card.deckName);
            let deck = classified.matched.get(name);
            if (!deck) {
              deck = await app.createDeck({
                name: card.deckName,
                description: '',
                language: languageTag('en'),
                textAlignment: 'ltr',
                typographySize: 'medium',
              });
              classified.matched.set(name, deck);
            }
            await app.createCard({
              deckId: deck.id,
              frontText: card.frontText,
              meaning: card.meaning,
              phonetic: card.phonetic,
              category: card.category,
              examples: card.examples,
            });
            summary.imported++;
          } catch (error) {
            summary.invalidSkipped++;
            summary.issues.push({
              location,
              message: error instanceof Error ? error.message : 'Unable to save card.',
            });
          }
        }
        plans.delete(preview);
        return summary;
      } finally {
        saving = false;
      }
    },
    async export(format: TransferFormat, deckId?: string): Promise<Uint8Array> {
      const decks = (await app.listDecks()).filter((deck) => !deckId || deck.id === deckId);
      if (deckId && !decks.length) throw new Error('Selected deck is unavailable.');
      const cards = [];
      for (const deck of decks) {
        for (const card of await app.listCardsForDeck(deck.id)) {
          cards.push(cardToTransfer(card, deck.name));
        }
      }
      return adapters[format].serialize(
        cards,
        decks.map((deck) => deck.name),
      );
    },
  };
}

export type TransferService = ReturnType<typeof createTransferService>;
