import { memo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import type { Deck } from '@/features/decks/domain/deck';
import type { Card as CardEntity } from '@/features/study/domain/card';
import { useLocalization } from '@/shared/localization/localization-provider';
import { useThemeColors } from '@/shared/theme/theme-provider';
import { icons } from '@/shared/theme/tokens';
import { Text } from '@/shared/ui/text';
import { deckAlignment, deckTypography } from './deck-presentation';

export const CardListItem = memo(function CardListItem({
  card,
  deck,
  onPress,
}: {
  card: CardEntity;
  deck: Deck;
  onPress: (cardId: string) => void;
}) {
  const { t, direction } = useLocalization();
  const colors = useThemeColors();
  const Next = direction === 'rtl' ? ChevronLeft : ChevronRight;
  const style = {
    textAlign: deckAlignment[deck.textAlignment],
    writingDirection: deck.textAlignment === 'rtl' ? ('rtl' as const) : ('ltr' as const),
  };
  return (
    <Pressable
      className="min-h-listItem flex-row items-center gap-md border-b border-border py-lg"
      accessibilityRole="button"
      accessibilityLabel={t('details.openCard', {
        name: card.frontText,
        category: card.category ? `, ${card.category}` : '',
      })}
      accessibilityHint={t('details.openCardHint')}
      onPress={() => onPress(card.id)}
      style={(state) => (state.pressed ? { backgroundColor: colors.surfaceElevated } : undefined)}
    >
      <View className="min-w-0 flex-1 gap-xs">
        <Text
          variant={deckTypography[deck.typographySize]}
          weight="semibold"
          style={style}
          numberOfLines={2}
        >
          {card.frontText}
        </Text>
        {card.phonetic ? (
          <Text tone="secondary" variant="bodySmall" style={style} numberOfLines={1}>
            {card.phonetic}
          </Text>
        ) : null}
        <Text tone="secondary" variant="bodySmall" numberOfLines={2} style={style}>
          {card.meaning}
        </Text>
        {card.category ? (
          <Text tone="tertiary" variant="caption" style={style}>
            {card.category}
          </Text>
        ) : null}
      </View>
      <Next color={colors.tertiaryText} size={icons.medium} />
    </Pressable>
  );
});
