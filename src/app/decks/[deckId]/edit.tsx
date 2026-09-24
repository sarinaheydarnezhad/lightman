import { useLocalSearchParams } from 'expo-router';

import { getDemoDeck } from '@/features/decks/presentation/use-decks-view-model';
import { routeParam } from '@/shared/navigation/route-params';
import { FeaturePlaceholder } from '@/shared/ui/feature-placeholder';

export default function EditDeckRoute() {
  const { deckId } = useLocalSearchParams<'/decks/[deckId]/edit'>();
  const deck = getDemoDeck(routeParam(deckId));

  return (
    <FeaturePlaceholder
      title={`Edit ${deck?.title ?? 'deck'}`}
      description="Deck editing will be available in a future update."
    />
  );
}
