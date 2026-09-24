import { type PropsWithChildren } from 'react';
import { View } from 'react-native';

import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { EmptyState } from './empty-state';
import { Screen } from './screen';

export function FeaturePlaceholder({
  title,
  description,
  children,
}: PropsWithChildren<{ title: string; description: string }>) {
  return (
    <Screen scroll edges={stackScreenEdges}>
      <View className="flex-1 justify-center gap-xl">
        <EmptyState title={title} description={description} />
        {children}
      </View>
    </Screen>
  );
}
