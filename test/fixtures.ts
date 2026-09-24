import { calendarDate, instant, languageTag, localTime } from '@/core/domain/values';
import type { Repositories } from '@/core/ports/repositories';
import type { AppClock, IdGenerator } from '@/core/ports/platform';
import { InMemoryDeckRepository } from '@/features/decks/data/development-in-memory-deck-repository';
import type { Deck } from '@/features/decks/domain/deck';
import { InMemoryCardRepository } from '@/features/study/data/development-in-memory-card-repository';
import type { Card } from '@/features/study/domain/card';
import { InMemoryReviewRepository } from '@/features/study/data/development-in-memory-review-repository';
import type { CardReviewState, ReviewEvent } from '@/features/study/domain/review';
import { InMemorySettingsRepository } from '@/features/settings/data/development-in-memory-settings-repository';
import type { UserSettings } from '@/features/settings/domain/user-settings';

export const timestamp = instant('2026-09-24T10:00:00.000Z');

export function makeDeck(changes: Partial<Deck> = {}): Deck {
  return {
    id: 'deck-1',
    name: 'Vocabulary',
    description: 'A small deck',
    language: languageTag('en'),
    textAlignment: 'ltr',
    typographySize: 'medium',
    createdAt: timestamp,
    updatedAt: timestamp,
    archivedAt: null,
    ...changes,
  };
}

export function makeCard(changes: Partial<Card> = {}): Card {
  return {
    id: 'card-1',
    deckId: 'deck-1',
    frontText: 'hello',
    phonetic: null,
    category: null,
    meaning: 'greeting',
    examples: [{ sentence: 'Hello, friend.' }],
    createdAt: timestamp,
    updatedAt: timestamp,
    archivedAt: null,
    ...changes,
  };
}

export function makeState(changes: Partial<CardReviewState> = {}): CardReviewState {
  return {
    cardId: 'card-1',
    box: 1,
    dueDate: calendarDate('2026-09-24'),
    lastReviewedAt: null,
    consecutiveSuccesses: 0,
    totalReviews: 0,
    totalSuccesses: 0,
    updatedAt: timestamp,
    ...changes,
  };
}

export function makeEvent(changes: Partial<ReviewEvent> = {}): ReviewEvent {
  return {
    id: 'event-1',
    cardId: 'card-1',
    deckId: 'deck-1',
    previousBox: 1,
    newBox: 2,
    result: 'success',
    reviewedAt: timestamp,
    studySessionId: null,
    ...changes,
  };
}

export function makeSettings(changes: Partial<UserSettings> = {}): UserSettings {
  return {
    theme: 'system',
    language: languageTag('en'),
    dailyReminderEnabled: false,
    dailyReminderTime: localTime('09:30'),
    preferredSpeechLanguage: languageTag('en'),
    preferredSpeechAccent: null,
    ...changes,
  };
}

export function makeRepositories(): Repositories {
  return {
    decks: new InMemoryDeckRepository(),
    cards: new InMemoryCardRepository(),
    reviews: new InMemoryReviewRepository(),
    settings: new InMemorySettingsRepository(),
  };
}

export const fixedClock: AppClock = { now: () => new Date(timestamp), timeZone: () => 'UTC' };
export function sequenceIds(): IdGenerator {
  let next = 0;
  return { create: () => `generated-${++next}` };
}
