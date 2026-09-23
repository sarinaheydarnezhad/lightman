import { DevelopmentInMemoryDeckRepository } from '@/features/decks/data/development-in-memory-deck-repository';
import type { DeckRepository } from '@/features/decks/domain/deck-repository';
import { DevelopmentInMemorySettingsRepository } from '@/features/settings/data/development-in-memory-settings-repository';
import type { SettingsRepository } from '@/features/settings/domain/settings-repository';
import { DevelopmentInMemoryCardRepository } from '@/features/study/data/development-in-memory-card-repository';
import { DevelopmentInMemoryReviewRepository } from '@/features/study/data/development-in-memory-review-repository';
import type { CardRepository } from '@/features/study/domain/card-repository';
import type { ReviewRepository } from '@/features/study/domain/review-repository';

export interface Repositories {
  readonly decks: DeckRepository;
  readonly cards: CardRepository;
  readonly reviews: ReviewRepository;
  readonly settings: SettingsRepository;
}

/** The sole binding site for replaceable development infrastructure. */
export const repositories: Repositories = {
  decks: new DevelopmentInMemoryDeckRepository(),
  cards: new DevelopmentInMemoryCardRepository(),
  reviews: new DevelopmentInMemoryReviewRepository(),
  settings: new DevelopmentInMemorySettingsRepository(),
};
