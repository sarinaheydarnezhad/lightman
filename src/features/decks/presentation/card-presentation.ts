import type { Card } from '@/features/study/domain/card';

export type CardSort = 'recently-updated' | 'recently-created' | 'alphabetical';

export function sortCards(cards: Card[], sort: CardSort): Card[] {
  return [...cards].sort((a, b) => {
    const comparison =
      sort === 'alphabetical'
        ? a.frontText.localeCompare(b.frontText)
        : sort === 'recently-created'
          ? b.createdAt.localeCompare(a.createdAt)
          : b.updatedAt.localeCompare(a.updatedAt);
    return comparison || a.id.localeCompare(b.id);
  });
}
