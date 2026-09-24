import { MAX_CARD_TEXT_LENGTH } from '@/core/constants';
import { instant, requiredId, type Instant } from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';
import { requiredText } from '@/core/validation/text';

export interface CardExample {
  readonly sentence: string;
  readonly translation?: string;
  readonly notes?: string;
}

export interface Card {
  readonly id: string;
  readonly deckId: string;
  readonly frontText: string;
  readonly phonetic: string | null;
  readonly category: string | null;
  readonly meaning: string;
  readonly examples: readonly CardExample[];
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
  readonly archivedAt: Instant | null;
}

export function validateCardText(value: string, side: 'front' | 'back'): string {
  return requiredText(value, `Card ${side}`, MAX_CARD_TEXT_LENGTH);
}

export function validateCard(card: Card): Card {
  requiredId(card.id, 'Card ID');
  requiredId(card.deckId, 'Deck ID');
  const frontText = validateCardText(card.frontText, 'front');
  const meaning = validateCardText(card.meaning, 'back');
  if (card.phonetic && card.phonetic.length > 500)
    throw new AppError('validation', 'Phonetic text is too long.');
  if (card.category && card.category.length > 120)
    throw new AppError('validation', 'Category is too long.');
  if (!Array.isArray(card.examples) || card.examples.length > 20)
    throw new AppError('validation', 'Invalid card examples.');
  const examples = card.examples.map((example) => ({
    sentence: requiredText(example.sentence, 'Example sentence', MAX_CARD_TEXT_LENGTH),
    ...(example.translation ? { translation: example.translation.trim() } : {}),
    ...(example.notes ? { notes: example.notes.trim() } : {}),
  }));
  instant(card.createdAt);
  instant(card.updatedAt);
  if (card.updatedAt < card.createdAt)
    throw new AppError('validation', 'Card dates are out of order.');
  if (card.archivedAt !== null) {
    instant(card.archivedAt);
    if (card.archivedAt < card.createdAt)
      throw new AppError('validation', 'Archive date is out of order.');
  }
  return {
    ...card,
    frontText,
    meaning,
    phonetic: card.phonetic?.trim() || null,
    category: card.category?.trim() || null,
    examples,
  };
}
