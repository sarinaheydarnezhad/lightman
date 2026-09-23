import { EmptyState } from '@/shared/ui/empty-state';
import { Screen } from '@/shared/ui/screen';
import { Text } from '@/shared/ui/text';

export function DecksScreen() {
  return (
    <Screen>
      <Text className="text-3xl font-bold">Decks</Text>
      <EmptyState
        title="A place for your decks"
        description="Deck creation is coming in a future step."
      />
    </Screen>
  );
}
