import { InMemoryDeckRepository } from '@/features/decks/data/development-in-memory-deck-repository';
import { InMemorySettingsRepository } from '@/features/settings/data/development-in-memory-settings-repository';
import { InMemoryCardRepository } from '@/features/study/data/development-in-memory-card-repository';
import { InMemoryReviewRepository } from '@/features/study/data/development-in-memory-review-repository';
import type { Repositories } from '@/core/ports/repositories';

/** The sole binding site for replaceable development infrastructure. */
export const repositories: Repositories = {
  decks: new InMemoryDeckRepository(),
  cards: new InMemoryCardRepository(),
  reviews: new InMemoryReviewRepository(),
  settings: new InMemorySettingsRepository(),
};
