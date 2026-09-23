import { EmptyState } from '@/shared/ui/empty-state';
import { Screen } from '@/shared/ui/screen';
import { Text } from '@/shared/ui/text';

export function StudyScreen() {
  return (
    <Screen>
      <Text className="text-3xl font-bold">Study</Text>
      <EmptyState title="Study sessions" description="Your practice experience will appear here." />
    </Screen>
  );
}
