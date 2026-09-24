import { View } from 'react-native';

import type { Deck } from '@/features/decks/domain/deck';
import type { Card } from '@/features/study/domain/card';
import { Card as Surface } from '@/shared/ui/card';
import { Text } from '@/shared/ui/text';
import { deckAlignment, deckTypography } from './deck-presentation';

type Content = Pick<Card, 'frontText' | 'phonetic' | 'category' | 'meaning' | 'examples'>;

/** Both the save preview and details read presentation preferences from the parent deck. */
export function CardContent({
  deck,
  content,
  preview = false,
}: {
  deck: Deck;
  content: Content;
  preview?: boolean;
}) {
  const style = {
    textAlign: deckAlignment[deck.textAlignment],
    writingDirection: deck.textAlignment === 'rtl' ? ('rtl' as const) : ('ltr' as const),
  };
  const variant = deckTypography[deck.typographySize];

  return (
    <View className="gap-md">
      <Surface className="gap-md">
        <Text variant="labelLarge">Front</Text>
        <Text variant={variant} style={style}>
          {content.frontText || (preview ? 'Your term will appear here' : '')}
        </Text>
        {content.phonetic ? (
          <Text tone="secondary" style={style}>
            {content.phonetic}
          </Text>
        ) : null}
        {content.category ? (
          <Text tone="tertiary" style={style}>
            {content.category}
          </Text>
        ) : null}
      </Surface>
      <Surface className="gap-md">
        <Text variant="labelLarge">Back</Text>
        <Text variant={variant} style={style}>
          {content.meaning || (preview ? 'Your meaning will appear here' : '')}
        </Text>
        {content.examples.map((example, index) => (
          <View key={index} className="gap-sm border-t border-border pt-md">
            <Text variant={variant} style={style}>
              {example.sentence}
            </Text>
            {example.translation ? (
              <Text tone="secondary" style={style}>
                {example.translation}
              </Text>
            ) : null}
            {example.notes ? (
              <Text tone="tertiary" variant="bodySmall" style={style}>
                {example.notes}
              </Text>
            ) : null}
          </View>
        ))}
      </Surface>
    </View>
  );
}
