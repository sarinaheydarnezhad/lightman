import { type PropsWithChildren } from 'react';
import { View } from 'react-native';

import { stackScreenEdges } from '@/shared/navigation/safe-area';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { Screen } from './screen';

export function FeaturePlaceholder({
  title,
  description,
  onRetry,
  children,
}: PropsWithChildren<{ title: string; description: string; onRetry?: () => void }>) {
  return (
    <Screen scroll edges={stackScreenEdges}>
      <View className="flex-1 justify-center gap-md">
        {onRetry ? (
          <ErrorState title={title} description={description} onRetry={onRetry} />
        ) : (
          <EmptyState title={title} description={description} />
        )}
        {children}
      </View>
    </Screen>
  );
}
