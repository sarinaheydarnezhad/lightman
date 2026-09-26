import type { DeckRepository } from '@/features/decks/domain/deck-repository';
import type { CardRepository } from '@/features/study/domain/card-repository';
import type { ReviewRepository } from '@/features/study/domain/review-repository';
import type { StudySessionRepository } from '@/features/study/domain/study-session-repository';
import type { SettingsRepository } from '@/features/settings/domain/settings-repository';
import type { Card } from '@/features/study/domain/card';
import type { CardReviewState } from '@/features/study/domain/review';

export interface AtomicCardCreationRepository {
  createWithInitialReviewState(card: Card, state: CardReviewState): Promise<Card>;
}

export interface Repositories {
  readonly decks: DeckRepository;
  readonly cards: CardRepository;
  readonly reviews: ReviewRepository;
  readonly sessions: StudySessionRepository;
  readonly settings: SettingsRepository;
  readonly cardCreation?: AtomicCardCreationRepository;
}
