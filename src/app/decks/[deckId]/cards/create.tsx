import { useLocalSearchParams } from 'expo-router';

import { CardEditorScreen } from '@/features/decks/presentation/card-editor-screen';
import { routeParam } from '@/shared/navigation/route-params';

export default function CreateCardRoute() {
  const { deckId } = useLocalSearchParams<'/decks/[deckId]/cards/create'>();
  return <CardEditorScreen deckId={routeParam(deckId)} />;
}
