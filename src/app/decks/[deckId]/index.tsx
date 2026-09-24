import { useLocalSearchParams } from 'expo-router';

import { DeckDetailsScreen } from '@/features/decks/presentation/deck-details-screen';
import { routeParam } from '@/shared/navigation/route-params';

export default function DeckDetailsRoute() {
  const { deckId } = useLocalSearchParams<'/decks/[deckId]'>();
  return <DeckDetailsScreen deckId={routeParam(deckId)} />;
}
