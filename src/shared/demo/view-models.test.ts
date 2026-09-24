import { useAnalyticsViewModel } from '@/features/analytics/presentation/use-analytics-view-model';
import { getDemoDeck, useDecksViewModel } from '@/features/decks/presentation/use-decks-view-model';
import { useHomeViewModel } from '@/features/home/presentation/use-home-view-model';
import { useStudyViewModel } from '@/features/study/presentation/use-study-view-model';

test('demo decks can be searched and looked up without changing the dataset', () => {
  const all = useDecksViewModel();
  expect(all.totalCount).toBeGreaterThan(0);
  expect(useDecksViewModel('  WORD  ').decks.map((deck) => deck.id)).toEqual(['word-roots']);
  expect(useDecksViewModel('unmatched').decks).toEqual([]);
  expect(getDemoDeck(all.decks[0]!.id)).toEqual(all.decks[0]);
  expect(useDecksViewModel().decks).toHaveLength(all.totalCount);
});

test('home samples reference navigable demo decks', () => {
  for (const deck of useHomeViewModel().recentDecks) {
    expect(getDemoDeck(deck.id)).toBeDefined();
  }
});

test.each(['empty', 'ready', 'complete'] as const)(
  'study %s has a distinct shell presentation',
  (phase) => {
    const state = useStudyViewModel(phase);
    expect(state.phase).toBe(phase);
    expect(state.title).toBeTruthy();
    expect(state.action).toBeTruthy();
  },
);

test('analytics returns placeholders rather than calculated data', () => {
  expect(useAnalyticsViewModel().retention).toBe('—');
  expect(useAnalyticsViewModel().reviewed).toBe('—');
});
