import { useLocalSearchParams } from 'expo-router';

import { CardEditorScreen } from '@/features/decks/presentation/card-editor-screen';
import { routeParam } from '@/shared/navigation/route-params';

export default function EditCardRoute() {
  const { deckId, cardId } = useLocalSearchParams<'/decks/[deckId]/cards/[cardId]/edit'>();
  return <CardEditorScreen deckId={routeParam(deckId)} cardId={routeParam(cardId)} />;
}
