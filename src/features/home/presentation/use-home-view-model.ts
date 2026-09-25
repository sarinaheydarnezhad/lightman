import { useCallback } from 'react';
import { application } from '@/core/composition/application';
import { useFocusedResource } from '@/shared/navigation/use-focused-resource';

export function useHomeViewModel() {
  const resource = useFocusedResource(useCallback(() => application.getHomeSummary(), []));
  return {
    ...resource,
    cardCount: resource.data?.cardCount ?? 0,
    reviewCount: resource.data?.reviewCount ?? 0,
    featuredDecks: resource.data?.decks.slice(0, 2) ?? [],
  };
}
