import type { DeckRepository } from '@/features/decks/domain/deck-repository';
import type { CardRepository } from '@/features/study/domain/card-repository';
import type { ReviewRepository } from '@/features/study/domain/review-repository';
import type { SettingsRepository } from '@/features/settings/domain/settings-repository';

export interface Repositories {
  readonly decks: DeckRepository;
  readonly cards: CardRepository;
  readonly reviews: ReviewRepository;
  readonly settings: SettingsRepository;
}
