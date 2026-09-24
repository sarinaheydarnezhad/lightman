import type { Deck, DeckTextAlignment, TypographySize } from '@/features/decks/domain/deck';
import type { LanguageTag } from '@/core/domain/values';
import type { TypographyVariant } from '@/shared/theme/tokens';

export const languageChoices = [
  { label: 'English', tag: 'en' },
  { label: 'Persian', tag: 'fa' },
  { label: 'Arabic', tag: 'ar' },
] as const;

export function languageLabel(tag: LanguageTag): string {
  const base = tag.toLowerCase().split('-')[0];
  return languageChoices.find((choice) => choice.tag === base)?.label ?? `Other (${tag})`;
}

export function cardCountLabel(count: number): string {
  return count === 0 ? 'No cards yet' : `${count} ${count === 1 ? 'card' : 'cards'}`;
}

export const deckAlignment: Record<DeckTextAlignment, 'left' | 'right' | 'center'> = {
  ltr: 'left',
  rtl: 'right',
  center: 'center',
};

export const deckTypography: Record<TypographySize, TypographyVariant> = {
  small: 'bodySmall',
  medium: 'bodyMedium',
  large: 'bodyLarge',
};

/** The list only exposes sorts supported by currently available domain data. */
export type DeckSort = 'recently-updated' | 'alphabetical';

export function sortDecks<T extends Deck>(decks: T[], sort: DeckSort): T[] {
  return [...decks].sort((a, b) =>
    sort === 'alphabetical'
      ? a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
      : b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id),
  );
}
