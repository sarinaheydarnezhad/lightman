import { useLocalSearchParams } from 'expo-router';

import { CardListScreen } from '@/features/decks/presentation/card-list-screen';
import { routeParam } from '@/shared/navigation/route-params';

export default function CardListRoute() {
  const { deckId } = useLocalSearchParams<'/decks/[deckId]/cards'>();
  return <CardListScreen deckId={routeParam(deckId)} />;
}
