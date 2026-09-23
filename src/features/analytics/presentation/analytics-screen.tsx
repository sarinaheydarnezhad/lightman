import { EmptyState } from '@/shared/ui/empty-state';
import { Screen } from '@/shared/ui/screen';
import { Text } from '@/shared/ui/text';

export function AnalyticsScreen() {
  return (
    <Screen>
      <Text className="text-3xl font-bold">Analytics</Text>
      <EmptyState title="See your progress" description="Study insights will appear here later." />
    </Screen>
  );
}
