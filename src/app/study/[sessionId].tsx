import { router, useLocalSearchParams } from 'expo-router';

import { Button } from '@/shared/ui/button';
import { FeaturePlaceholder } from '@/shared/ui/feature-placeholder';

export default function StudySessionRoute() {
  const { sessionId } = useLocalSearchParams<'/study/[sessionId]'>();

  return (
    <FeaturePlaceholder
      title="Study session"
      description={
        sessionId === 'preview'
          ? 'This is a session preview. Study sessions will be available in a future update.'
          : "This session isn't available yet."
      }
    >
      <Button label="Return to study" onPress={() => router.replace('/study')} />
    </FeaturePlaceholder>
  );
}
