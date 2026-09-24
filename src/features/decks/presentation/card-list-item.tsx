import type { Deck } from '@/features/decks/domain/deck';
import type { Card as CardEntity } from '@/features/study/domain/card';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/text';
import { deckAlignment, deckTypography } from './deck-presentation';

export function CardListItem({
  card,
  deck,
  onPress,
}: {
  card: CardEntity;
  deck: Deck;
  onPress: () => void;
}) {
  const style = {
    textAlign: deckAlignment[deck.textAlignment],
    writingDirection: deck.textAlignment === 'rtl' ? ('rtl' as const) : ('ltr' as const),
  };
  return (
    <Card
      variant="interactive"
      className="gap-sm"
      accessibilityLabel={`Open ${card.frontText} card${card.category ? `, ${card.category}` : ''}`}
      accessibilityHint="Opens card details"
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
        <Text tone="tertiary" variant="caption" style={style}>
          {card.category}
        </Text>
      ) : null}
      <Text tone="secondary" numberOfLines={2} style={style}>
        {card.meaning}
      </Text>
    </Card>
  );
}
