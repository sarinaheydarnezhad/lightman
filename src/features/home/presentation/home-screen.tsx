import { BookOpen, Sparkles } from 'lucide-react-native';
import { Link } from 'expo-router';
import { View } from 'react-native';

import { APP_NAME } from '@/core/constants';
import { useThemeMode } from '@/shared/theme/theme-provider';
import { palette } from '@/shared/theme/tokens';
import { Card } from '@/shared/ui/card';
import { Screen } from '@/shared/ui/screen';
import { Text } from '@/shared/ui/text';

export function HomeScreen() {
  const colors = palette[useThemeMode()];
  return (
    <Screen>
      <View className="flex-1 justify-center gap-8">
        <View className="gap-3">
          <View className="h-14 w-14 items-center justify-center rounded-2xl bg-accent">
            <BookOpen size={27} color={colors.accentContrast} />
          </View>
          <Text tone="secondary" className="text-sm font-semibold uppercase tracking-widest">
            {APP_NAME} / your study space
          </Text>
          <Text className="text-4xl font-bold leading-tight">A little practice, every day.</Text>
          <Text tone="secondary" className="text-lg leading-7">
            Your decks and study sessions will have a home here. The foundation is ready to grow
            with you.
          </Text>
        </View>
        <Card className="gap-4">
          <Sparkles color={colors.accent} size={23} />
          <Text className="text-lg font-semibold">Ready for what’s next</Text>
          <Text tone="secondary">
            Explore the sections below while we build the study experience.
          </Text>
          <Link href="/decks" className="font-semibold text-accent" accessibilityRole="link">
            Browse decks →
          </Link>
        </Card>
      </View>
    </Screen>
  );
}
