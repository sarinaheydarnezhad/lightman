import { useCallback } from 'react';
import { application } from '@/core/composition/application';
import { useFocusedResource } from '@/shared/navigation/use-focused-resource';

export function useHomeViewModel() {
  const resource = useFocusedResource(
    useCallback(async () => {
      const [summary, activity] = await Promise.all([
        application.getHomeSummary(),
        application.getAnalyticsWindow(7),
      ]);
      const due = await application.getStudyQueue({
        scope: { kind: 'all-decks' },
        targetDate: activity.today,
      });
      return {
        ...summary,
        dueCount: due.length,
        streak: activity.currentStreak,
        reviewedToday: activity.cardsReviewedToday,
      };
    }, []),
  );
  return {
    ...resource,
    cardCount: resource.data?.cardCount ?? 0,
    reviewCount: resource.data?.reviewCount ?? 0,
    dueCount: resource.data?.dueCount ?? 0,
    streak: resource.data?.streak ?? 0,
    reviewedToday: resource.data?.reviewedToday ?? 0,
    featuredDecks: resource.data?.decks.slice(0, 2) ?? [],
  };
}
