import { calendarDate, instant, languageTag } from '@/core/domain/values';
import { defaultSettings } from './default-settings';
import type { Repositories } from '@/core/ports/repositories';
import type { Card } from '@/features/study/domain/card';

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
      typographySize: 'small' as const,
    },
    {
      id: 'word-roots',
      name: 'Word roots',
      description: 'Recognize familiar patterns in new words.',
      language: languageTag('en'),
      textAlignment: 'center' as const,
      typographySize: 'medium' as const,
    },
    {
      id: 'travel-basics',
      name: 'Travel basics',
      description: 'Useful words for getting around.',
      language: languageTag('fa-IR'),
      textAlignment: 'rtl' as const,
      typographySize: 'large' as const,
    },
    {
      id: 'fresh-collection',
      name: 'Fresh collection',
      description: 'A space to add your first cards.',
      language: languageTag('en'),
      textAlignment: 'ltr' as const,
      typographySize: 'medium' as const,
    },
  ];
  for (const deck of samples) {
    if (!(await decks.getById(deck.id)))
      await decks.create({
        ...deck,
        createdAt,
        updatedAt: createdAt,
        archivedAt: null,
      });
  }
  const sampleCards: Pick<
    Card,
    'id' | 'deckId' | 'frontText' | 'meaning' | 'phonetic' | 'category' | 'examples'
  >[] = [
    {
      id: 'phrase-hello',
      deckId: 'everyday-phrases',
      frontText: 'Hello',
      phonetic: '/həˈloʊ/',
      category: 'Greetings',
      meaning: 'A greeting',
      examples: [
        { sentence: 'Hello, how are you?', translation: 'A friendly greeting.' },
        {
          sentence:
            'She greeted everyone at the door with a warm hello before introducing herself to the rest of the group.',
          notes: 'A longer conversational example.',
        },
      ],
    },
    {
      id: 'phrase-thanks',
      deckId: 'everyday-phrases',
      frontText: 'Thank you',
      phonetic: null,
      category: 'Courtesy',
      meaning: 'Express gratitude',
      examples: [],
    },
    {
      id: 'root-port',
      deckId: 'word-roots',
      frontText: 'port',
      phonetic: null,
      category: 'Word roots',
      meaning: 'To carry',
      examples: [{ sentence: 'Transport means to carry across.' }],
    },
    {
      id: 'travel-salaam',
      deckId: 'travel-basics',
      frontText: 'سلام',
      phonetic: null,
      category: null,
      meaning: 'Hello',
      examples: [],
    },
  ];
  for (const card of sampleCards) {
    if (!(await cards.getById(card.id)))
      await cards.create({
        ...card,
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
  }
  if (!existingEventIds.has('seed-review-2')) {
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
