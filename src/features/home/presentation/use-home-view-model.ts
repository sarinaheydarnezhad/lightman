import { useCallback } from 'react';
import { application } from '@/core/composition/application';
import { useFocusedResource } from '@/shared/navigation/use-focused-resource';

export function useHomeViewModel() {
  const resource = useFocusedResource(useCallback(() => application.getHomeSummary(), []));
  return {
    ...resource,
    greeting: 'A little practice, every day.',
    cardCount: resource.data?.cardCount ?? 0,
    reviewCount: resource.data?.reviewCount ?? 0,
    recentDecks: resource.data?.decks.slice(0, 2) ?? [],
  };
}
