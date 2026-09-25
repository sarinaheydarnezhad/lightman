import type { Deck } from '@/features/decks/domain/deck';
import { Badge } from '@/shared/ui/badge';
import { Card } from '@/shared/ui/card';
import { Text } from '@/shared/ui/text';
import { useLocalization } from '@/shared/localization/localization-provider';
import { deckLanguageLabel } from '@/shared/localization/localization';

export function DeckListItem({
  deck,
  cardCount,
  onPress,
}: {
  deck: Deck;
  cardCount: number;
  onPress: () => void;
}) {
  const { t, number, language } = useLocalization();
  const count =
    cardCount === 0
      ? t('cards.empty')
      : t(cardCount === 1 ? 'common.singleCard' : 'common.cardCount', { count: number(cardCount) });
  const deckLanguage = deckLanguageLabel(deck.language, language);
  return (
    <Card
      variant="interactive"
      accessibilityLabel={t('decks.open', { name: deck.name, language: deckLanguage, count })}
      accessibilityHint={t('decks.openHint')}
      onPress={onPress}
      className="gap-sm"
    >
      <Text variant="headingSmall" numberOfLines={2}>
        {deck.name}
      </Text>
      {deck.description ? (
        <Text tone="secondary" numberOfLines={2}>
          {deck.description}
        </Text>
      ) : null}
      <Text variant="bodySmall" tone="secondary">
        {deckLanguage} · {count}
      </Text>
      <Badge
        label={`${t(`form.alignment.${deck.textAlignment}`)} · ${t(`form.size.${deck.typographySize}`)}`}
      />
    </Card>
  );
}
