import { instant } from '@/core/domain/values';
import { makeCard } from '@/../test/fixtures';
import { sortCards } from './card-presentation';

test('sort foundation supports updated, created and alphabetical without mutating input', () => {
  const alpha = makeCard({ id: 'alpha', frontText: 'Alpha' });
  const zulu = makeCard({
    id: 'zulu',
    frontText: 'Zulu',
    createdAt: instant('2026-09-24T10:05:00.000Z'),
    updatedAt: instant('2026-09-24T10:05:00.000Z'),
  });
  const cards = [alpha, zulu];
  expect(sortCards(cards, 'alphabetical').map((card) => card.id)).toEqual(['alpha', 'zulu']);
  expect(sortCards(cards, 'recently-created').map((card) => card.id)).toEqual(['zulu', 'alpha']);
  expect(sortCards(cards, 'recently-updated').map((card) => card.id)).toEqual(['zulu', 'alpha']);
  expect(cards).toEqual([alpha, zulu]);
});
