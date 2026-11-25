import { useLocalSearchParams } from 'expo-router';

import { CardListScreen } from '@/features/decks/presentation/card-list-screen';
import { routeParam } from '@/shared/navigation/route-params';

export default function CardListRoute() {
  const { deckId, reviewSection } = useLocalSearchParams<{
    deckId: string;
    reviewSection?: string;
  }>();
  return <CardListScreen deckId={routeParam(deckId)} reviewSection={routeParam(reviewSection)} />;
}
