import { calendarDate, instant, languageTag } from '@/core/domain/values';
import { defaultSettings } from './default-settings';
import type { Repositories } from '@/core/ports/repositories';

/** Explicit, disposable sample data. Production repositories begin empty. */
export async function seedDevelopmentData({
  decks,
  cards,
  reviews,
  settings,
}: Repositories): Promise<void> {
  const createdAt = instant('2026-01-01T00:00:00.000Z');
  const samples = [
    {
      id: 'everyday-phrases',
      name: 'Everyday phrases',
      description: 'Short phrases for everyday conversations.',
      language: languageTag('en'),
      textAlignment: 'ltr' as const,
    },
    {
      id: 'word-roots',
      name: 'Word roots',
      description: 'Recognize familiar patterns in new words.',
      language: languageTag('en'),
      textAlignment: 'center' as const,
    },
    {
      id: 'travel-basics',
      name: 'Travel basics',
      description: 'Useful words for getting around.',
      language: languageTag('fa-IR'),
      textAlignment: 'rtl' as const,
    },
  ];
  for (const deck of samples) {
    if (!(await decks.getById(deck.id)))
      await decks.create({
        ...deck,
        typographySize: 'medium',
        createdAt,
        updatedAt: createdAt,
        archivedAt: null,
      });
  }
  const sampleCards = [
    {
      id: 'phrase-hello',
      deckId: 'everyday-phrases',
      frontText: 'Hello',
      meaning: 'A greeting',
      examples: [{ sentence: 'Hello, how are you?', translation: 'A friendly greeting.' }],
    },
    {
      id: 'phrase-thanks',
      deckId: 'everyday-phrases',
      frontText: 'Thank you',
      meaning: 'Express gratitude',
      examples: [],
    },
    {
      id: 'root-port',
      deckId: 'word-roots',
      frontText: 'port',
      meaning: 'To carry',
      examples: [{ sentence: 'Transport means to carry across.' }],
    },
    {
      id: 'travel-salaam',
      deckId: 'travel-basics',
      frontText: 'سلام',
      meaning: 'Hello',
      examples: [],
    },
  ];
  for (const card of sampleCards) {
    if (!(await cards.getById(card.id)))
      await cards.create({
        ...card,
        phonetic: null,
        category: null,
        createdAt,
        updatedAt: createdAt,
        archivedAt: null,
      });
  }
  if (!(await reviews.getState('phrase-hello'))) {
    await reviews.saveState({
      cardId: 'phrase-hello',
      box: 3,
      dueDate: calendarDate('2026-01-10'),
      lastReviewedAt: createdAt,
      consecutiveSuccesses: 2,
      totalReviews: 2,
      totalSuccesses: 2,
      updatedAt: createdAt,
    });
  }
  if (!(await reviews.getState('phrase-thanks'))) {
    await reviews.saveState({
      cardId: 'phrase-thanks',
      box: 1,
      dueDate: calendarDate('2026-01-02'),
      lastReviewedAt: null,
      consecutiveSuccesses: 0,
      totalReviews: 0,
      totalSuccesses: 0,
      updatedAt: createdAt,
    });
  }
  const existingEventIds = new Set(
    (await reviews.listEvents({ cardId: 'phrase-hello' })).map((event) => event.id),
  );
  if (!existingEventIds.has('seed-review-1')) {
  }
  if (!existingEventIds.has('seed-review-2')) {
    await reviews.addEvent({
      id: 'seed-review-1',
      cardId: 'phrase-hello',
      deckId: 'everyday-phrases',
      previousBox: 1,
      newBox: 2,
      result: 'success',
      reviewedAt: createdAt,
      studySessionId: null,
    });
    await reviews.addEvent({
      id: 'seed-review-2',
      cardId: 'phrase-hello',
      deckId: 'everyday-phrases',
      previousBox: 2,
      newBox: 3,
      result: 'success',
      reviewedAt: createdAt,
      studySessionId: null,
    });
  }
  if (!(await settings.get())) await settings.update(defaultSettings());
}
