import { instant } from '@/core/domain/values';
import { timestamp } from '@/../test/fixtures';
import { validateStudySession } from './study-session';

test('a study session keeps its own card IDs and a bounded current position', () => {
  const cardIds = ['card-1', 'card-2'];
  const session = validateStudySession({
    id: 'session-1',
    deckId: 'deck-1',
    startedAt: timestamp,
    completedAt: null,
    cardIds,
    currentIndex: 1,
  });
  cardIds.push('card-3');
  expect(session.cardIds).toEqual(['card-1', 'card-2']);
  expect(() => validateStudySession({ ...session, currentIndex: 3 })).toThrow();
  expect(() =>
    validateStudySession({ ...session, completedAt: instant('2026-09-24T09:00:00.000Z') }),
  ).toThrow();
});
