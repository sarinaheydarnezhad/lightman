import { memo } from 'react';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import type { Deck } from '@/features/decks/domain/deck';
import { useLocalization } from '@/shared/localization/localization-provider';
import { deckLanguageLabel } from '@/shared/localization/localization';
import { useThemeColors } from '@/shared/theme/theme-provider';
import { icons } from '@/shared/theme/tokens';
import { Text } from '@/shared/ui/text';

export const DeckListItem = memo(function DeckListItem({
  deck,
  cardCount,
  onPress,
}: {
  deck: Deck;
  cardCount: number;
  onPress: (deckId: string) => void;
}) {
  const { t, number, language } = useLocalization();
  const colors = useThemeColors();
  const count =
    cardCount === 0
      ? t('cards.empty')
      : t(cardCount === 1 ? 'common.singleCard' : 'common.cardCount', { count: number(cardCount) });
  const deckLanguage = deckLanguageLabel(deck.language, language);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('decks.open', { name: deck.name, language: deckLanguage, count })}
      accessibilityHint={t('decks.openHint')}
      onPress={() => onPress(deck.id)}
      className="min-h-listItem flex-row items-center gap-md border-b border-border py-lg"
      style={(state) => (state.pressed ? { backgroundColor: colors.surfaceElevated } : undefined)}
    >
      <View className="min-w-0 flex-1 gap-xs">
        <Text variant="headingSmall" numberOfLines={2}>
          {deck.name}
        </Text>
        {deck.description ? (
          <Text variant="bodySmall" tone="secondary" numberOfLines={2}>
            {deck.description}
          </Text>
        ) : null}
        <Text variant="bodySmall" tone="secondary">
          {deckLanguage} · {count}
        </Text>
      </View>
      <ChevronRight color={colors.tertiaryText} size={icons.medium} />
    </Pressable>
  );
});
