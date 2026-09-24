import { useLocalSearchParams } from 'expo-router';

import { DeckEditorScreen } from '@/features/decks/presentation/deck-editor-screen';
import { routeParam } from '@/shared/navigation/route-params';

export default function EditDeckRoute() {
  const { deckId } = useLocalSearchParams<'/decks/[deckId]/edit'>();
  return <DeckEditorScreen deckId={routeParam(deckId)} />;
}
