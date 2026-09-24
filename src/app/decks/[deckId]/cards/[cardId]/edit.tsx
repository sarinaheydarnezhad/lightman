import { useLocalSearchParams } from 'expo-router';

import { getDemoDeck } from '@/features/decks/presentation/use-decks-view-model';
import { routeParam } from '@/shared/navigation/route-params';
import { FeaturePlaceholder } from '@/shared/ui/feature-placeholder';

export default function EditCardRoute() {
  const { deckId, cardId } = useLocalSearchParams<'/decks/[deckId]/cards/[cardId]/edit'>();
  const deck = getDemoDeck(routeParam(deckId));

  return (
    <FeaturePlaceholder
      title="Edit card"
      description={
        deck && routeParam(cardId) === 'preview-card'
          ? `Card editing in ${deck.title} will be available in a future update.`
          : "This sample card isn't available."
      }
    />
  );
}
