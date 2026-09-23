import { EmptyState } from '@/shared/ui/empty-state';
import { Screen } from '@/shared/ui/screen';
import { Text } from '@/shared/ui/text';

export function AnalyticsScreen() {
  return (
    <Screen>
      <Text variant="headingLarge">Analytics</Text>
      <EmptyState title="See your progress" description="Study insights will appear here later." />
    </Screen>
  );
}
