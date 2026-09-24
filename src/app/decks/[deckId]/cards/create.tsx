import { useLocalSearchParams } from 'expo-router';

import { getDemoDeck } from '@/features/decks/presentation/use-decks-view-model';
import { routeParam } from '@/shared/navigation/route-params';
import { FeaturePlaceholder } from '@/shared/ui/feature-placeholder';

export default function CreateCardRoute() {
  const { deckId } = useLocalSearchParams<'/decks/[deckId]/cards/create'>();
  const deck = getDemoDeck(routeParam(deckId));

  return (
    <FeaturePlaceholder
      title="Create a card"
      description={`Card creation for ${deck?.title ?? 'this deck'} will be available in a future update.`}
    />
  );
}
