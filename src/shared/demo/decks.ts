export interface DemoDeck {
  id: string;
  title: string;
  description: string;
  cardCount: number;
  activityLabel: string;
}

export const DEMO_DECKS: readonly DemoDeck[] = [
  {
    id: 'everyday-phrases',
    title: 'Everyday phrases',
    description: 'Short phrases for everyday conversations.',
    cardCount: 24,
    activityLabel: 'Recently opened',
  },
  {
    id: 'word-roots',
    title: 'Word roots',
    description: 'Recognize familiar patterns in new words.',
    cardCount: 18,
    activityLabel: 'Ready to explore',
  },
  {
    id: 'travel-basics',
    title: 'Travel basics',
    description: 'Useful words for getting around.',
    cardCount: 12,
    activityLabel: 'Ready to explore',
  },
];
