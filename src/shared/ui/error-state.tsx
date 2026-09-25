import { View } from 'react-native';

import { useLocalization } from '@/shared/localization/localization-provider';
import { Button } from './button';
import { EmptyState } from './empty-state';

/** Retryable resource errors share the same message hierarchy and action. */
export function ErrorState({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry: () => void;
}) {
  const { t } = useLocalization();
  return (
    <View className="gap-md" accessibilityLiveRegion="polite">
      <EmptyState title={title} description={description} />
      <Button label={t('common.tryAgain')} onPress={onRetry} />
    </View>
  );
}
