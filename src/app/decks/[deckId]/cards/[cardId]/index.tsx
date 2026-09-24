import { useLocalSearchParams } from 'expo-router';

import { CardDetailsScreen } from '@/features/decks/presentation/card-details-screen';
import { routeParam } from '@/shared/navigation/route-params';

export default function CardDetailsRoute() {
  const { deckId, cardId } = useLocalSearchParams<'/decks/[deckId]/cards/[cardId]'>();
  return <CardDetailsScreen deckId={routeParam(deckId)} cardId={routeParam(cardId)} />;
}
