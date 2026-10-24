import { View } from 'react-native';

import { FeedbackModal } from './feedback-modal';

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
  return (
    <View className="gap-md">
      <FeedbackModal title={title} message={description} onRetry={onRetry} />
    </View>
  );
}
