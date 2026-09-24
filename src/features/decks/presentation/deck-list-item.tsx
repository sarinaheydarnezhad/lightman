import type { Deck } from '@/features/decks/domain/deck';
import { Badge } from '@/shared/ui/badge';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/text';
import { cardCountLabel, languageLabel } from './deck-presentation';

export function DeckListItem({
  deck,
  cardCount,
  onPress,
}: {
  deck: Deck;
  cardCount: number;
  onPress: () => void;
}) {
  const count = cardCountLabel(cardCount);
  return (
    <Card
      variant="interactive"
      accessibilityLabel={`Open ${deck.name} deck, ${languageLabel(deck.language)}, ${count}`}
      accessibilityHint="Opens deck details"
      onPress={onPress}
      className="gap-sm"
    >
      <Text variant="headingSmall">{deck.name}</Text>
      {deck.description ? (
        <Text tone="secondary" numberOfLines={2}>
          {deck.description}
        </Text>
      ) : null}
      <Text variant="bodySmall" tone="secondary">
        {languageLabel(deck.language)} · {count}
      </Text>
      <Badge label={`${deck.textAlignment.toUpperCase()} · ${deck.typographySize}`} />
    </Card>
  );
}
