import { memo } from 'react';
import { BookOpen, ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import type { Deck } from '@/features/decks/domain/deck';
import { useLocalization } from '@/shared/localization/localization-provider';
import { useThemeColors } from '@/shared/theme/theme-provider';
import { useSurfaceStyle } from '@/shared/theme/use-surface-style';
import { icons } from '@/shared/theme/tokens';
import { Text } from '@/shared/ui/text';

export const DeckListItem = memo(function DeckListItem({
  deck,
  cardCount = 0,
  showCount = true,
  accessibilityLabel,
  onPress,
}: {
  deck: Deck;
  cardCount?: number;
  showCount?: boolean;
  accessibilityLabel?: string;
  onPress: (deckId: string) => void;
}) {
  const { t, number } = useLocalization();
  const colors = useThemeColors();
  const shadow = useSurfaceStyle();
  const count =
    cardCount === 0
      ? t('cards.empty')
      : t(cardCount === 1 ? 'common.singleCard' : 'common.cardCount', { count: number(cardCount) });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ?? t('decks.open', { name: deck.name, count })
      }
      accessibilityHint={t('decks.openHint')}
      onPress={() => onPress(deck.id)}
      className="mb-md min-h-listItem flex-row items-center gap-xl rounded-lg border border-surface bg-surface p-lg"
      style={(state) => [
        shadow,
        state.pressed ? { backgroundColor: colors.surfaceElevated } : undefined,
      ]}
    >
      <View
        className="items-center justify-center rounded-md bg-primarySoft"
        style={{ width: 54, height: 54 }}
        importantForAccessibility="no-hide-descendants"
      >
        <BookOpen color={colors.decorativeIcon} size={icons.medium} />
      </View>
      <View className="min-w-0 flex-1 gap-xs">
        <Text variant="headingSmall" numberOfLines={2}>
          {deck.name}
        </Text>
        {showCount ? (
          <Text variant="bodySmall" tone="secondary">
            {count}
          </Text>
        ) : null}
      </View>
      <ChevronRight color={colors.tertiaryText} size={icons.medium} />
    </Pressable>
  );
});
