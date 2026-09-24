import { router } from 'expo-router';

import { Button } from '@/shared/ui/button';
import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { EmptyState } from '@/shared/ui/empty-state';
import { Screen } from '@/shared/ui/screen';
import { View } from 'react-native';

export default function NotFound() {
  return (
    <Screen edges={stackScreenEdges}>
      <View className="flex-1 justify-center gap-lg">
        <EmptyState
          title="Page not found"
          description="The page you requested isn't here. You can return to your study space."
        />
        <Button label="Return home" onPress={() => router.replace('/')} />
      </View>
    </Screen>
  );
}
