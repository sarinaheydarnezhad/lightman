import { useLocalSearchParams } from 'expo-router';

import { CardEditorHeader } from '@/features/decks/presentation/card-editor-header';
import { CardEditorScreen } from '@/features/decks/presentation/card-editor-screen';
import { routeParam } from '@/shared/navigation/route-params';

export default function CreateCardRoute() {
  const { deckId } = useLocalSearchParams<'/decks/[deckId]/cards/create'>();
  return (
    <CardEditorScreen
      deckId={routeParam(deckId)}
      renderSaveAction={(saveAction) => <CardEditorHeader saveAction={saveAction} />}
    />
  );
}
