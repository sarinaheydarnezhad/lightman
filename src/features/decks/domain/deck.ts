import { requiredText } from '@/core/validation/text';
import { AppError } from '@/core/errors/app-error';
import {
  instant,
  languageTag,
  requiredId,
  type Instant,
  type LanguageTag,
} from '@/core/domain/values';

export type DeckTextAlignment = 'ltr' | 'rtl' | 'center';
export type TypographySize = 'small' | 'medium' | 'large';

export interface Deck {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly language: LanguageTag;
  readonly textAlignment: DeckTextAlignment;
  readonly typographySize: TypographySize;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
  readonly archivedAt: Instant | null;
}

export function validateDeckTitle(title: string): string {
  return requiredText(title, 'Deck name', 120);
}

export function validateDeck(deck: Deck): Deck {
  requiredId(deck.id, 'Deck ID');
  const name = validateDeckTitle(deck.name);
  const description = deck.description.trim();
  if (description.length > 1000) throw new AppError('validation', 'Description is too long.');
  const language = languageTag(deck.language);
  if (!(['ltr', 'rtl', 'center'] as const).includes(deck.textAlignment)) {
    throw new AppError('validation', 'Invalid deck text alignment.');
  }
  if (!(['small', 'medium', 'large'] as const).includes(deck.typographySize)) {
    throw new AppError('validation', 'Invalid deck typography size.');
  }
  instant(deck.createdAt);
  instant(deck.updatedAt);
  if (deck.updatedAt < deck.createdAt)
    throw new AppError('validation', 'Deck dates are out of order.');
  if (deck.archivedAt !== null) {
    instant(deck.archivedAt);
    if (deck.archivedAt < deck.createdAt)
      throw new AppError('validation', 'Archive date is out of order.');
  }
  return { ...deck, name, description, language };
}
