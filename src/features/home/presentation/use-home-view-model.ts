import { DEMO_DECKS } from '@/shared/demo/decks';

const DEMO_HOME_VIEW_MODEL = {
  greeting: 'A little practice, every day.',
  cardsDue: 12,
  reviewedToday: 8,
  currentStreak: 4,
  recentDecks: DEMO_DECKS.slice(0, 2),
};

export function useHomeViewModel() {
  return DEMO_HOME_VIEW_MODEL;
}
