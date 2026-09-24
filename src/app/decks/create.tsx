import { router } from 'expo-router';

import { Button } from '@/shared/ui/button';
import { FeaturePlaceholder } from '@/shared/ui/feature-placeholder';

export default function CreateDeckRoute() {
  return (
    <FeaturePlaceholder
      title="Create a deck"
      description="Deck creation will be available in a future update."
    >
      <Button label="Browse decks" variant="secondary" onPress={() => router.replace('/decks')} />
    </FeaturePlaceholder>
  );
}
