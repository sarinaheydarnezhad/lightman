import { BookOpen, Sparkles } from 'lucide-react-native';
import { Link } from 'expo-router';
import { View } from 'react-native';

import { APP_NAME } from '@/core/constants';
import { useThemeColors } from '@/shared/theme/theme-provider';
import { icons } from '@/shared/theme/tokens';
import { Card } from '@/shared/ui/card';
import { Screen } from '@/shared/ui/screen';
import { Text } from '@/shared/ui/text';

export function HomeScreen() {
  const colors = useThemeColors();
  return (
    <Screen>
      <View className="flex-1 justify-center gap-2xl">
        <View className="gap-md">
          <View className="h-listItem w-listItem items-center justify-center rounded-lg bg-primary">
            <BookOpen size={icons.large} color={colors.primaryForeground} accessible={false} />
          </View>
          <Text tone="secondary" variant="labelMedium">
            {APP_NAME} / your study space
          </Text>
          <Text variant="display">A little practice, every day.</Text>
          <Text tone="secondary" variant="bodyLarge">
            Your decks and study sessions will have a home here. The foundation is ready to grow
            with you.
          </Text>
        </View>
        <Card className="gap-lg">
          <Sparkles color={colors.primary} size={icons.medium} accessible={false} />
          <Text variant="headingSmall">Ready for what’s next</Text>
          <Text tone="secondary">
            Explore the sections below while we build the study experience.
          </Text>
          <Link href="/decks" className="text-labelLarge text-primary" accessibilityRole="link">
            Browse decks →
          </Link>
        </Card>
      </View>
    </Screen>
  );
}
