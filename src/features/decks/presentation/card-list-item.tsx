import type { Deck } from '@/features/decks/domain/deck';
import type { Card as CardEntity } from '@/features/study/domain/card';
import { Badge } from '@/shared/ui/badge';
import { Card } from '@/shared/ui/card';
import { useLocalization } from '@/shared/localization/localization-provider';
import { Text } from '@/shared/ui/text';
import { deckAlignment, deckBadgeAlignment, deckTypography } from './deck-presentation';

export function CardListItem({
  card,
  deck,
  onPress,
}: {
  card: CardEntity;
  deck: Deck;
  onPress: () => void;
}) {
  const { t } = useLocalization();
  const style = {
    textAlign: deckAlignment[deck.textAlignment],
    writingDirection: deck.textAlignment === 'rtl' ? ('rtl' as const) : ('ltr' as const),
  };
  return (
    <Card
      variant="interactive"
      className="gap-sm"
      accessibilityLabel={t('details.openCard', {
        name: card.frontText,
        category: card.category ? `, ${card.category}` : '',
      })}
      accessibilityHint={t('details.openCardHint')}
      onPress={onPress}
    >
      <Text variant={deckTypography[deck.typographySize]} style={style} numberOfLines={2}>
        {card.frontText}
      </Text>
      {card.phonetic ? (
        <Text tone="secondary" variant="bodySmall" style={style} numberOfLines={1}>
          {card.phonetic}
        </Text>
      ) : null}
      {card.category ? (
        <Badge
          label={card.category}
          style={{ alignSelf: deckBadgeAlignment[deck.textAlignment] }}
        />
      ) : null}
      <Text tone="secondary" numberOfLines={2} style={style}>
        {card.meaning}
      </Text>
    </Card>
  );
}
