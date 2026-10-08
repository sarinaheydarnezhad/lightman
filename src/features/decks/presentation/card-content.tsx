import { View } from 'react-native';

import type { Deck } from '@/features/decks/domain/deck';
import type { Card } from '@/features/study/domain/card';
import { Badge } from '@/shared/ui/badge';
import { Card as Surface } from '@/shared/ui/card';
import { useLocalization } from '@/shared/localization/localization-provider';
import { Text } from '@/shared/ui/text';
import { deckContentStyle, deckBadgeAlignment, deckTypography } from './deck-presentation';

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
  const { t } = useLocalization();
  const variant = deckTypography[deck.typographySize];

  return (
    <View className="gap-md">
      <Surface className="gap-md">
        <Text variant="labelLarge">{t('form.front')}</Text>
        <Text variant={variant} style={deckContentStyle(content.frontText || t('form.termPreview'), deck.textAlignment)}>
          {content.frontText || (preview ? t('form.termPreview') : '')}
        </Text>
        {content.phonetic ? (
          <Text tone="secondary" style={deckContentStyle(content.phonetic, deck.textAlignment)}>
            {content.phonetic}
          </Text>
        ) : null}
        {content.category ? (
          <Badge
            label={content.category}
            style={{ alignSelf: deckBadgeAlignment[deck.textAlignment] }}
            accessibilityLabel={t('study.category', { value: content.category })}
          />
        ) : null}
      </Surface>
      <Surface className="gap-md">
        <Text variant="labelLarge">{t('form.back')}</Text>
        <Text variant={variant} style={deckContentStyle(content.meaning || t('form.meaningPreview'), deck.textAlignment)}>
          {content.meaning || (preview ? t('form.meaningPreview') : '')}
        </Text>
        {content.examples.map((example, index) => (
          <View key={index} className="gap-sm border-t border-border pt-md">
            <Text variant={variant} style={deckContentStyle(example.sentence, deck.textAlignment)}>
              {example.sentence}
            </Text>
            {example.translation ? (
              <Text tone="secondary" style={deckContentStyle(example.translation, deck.textAlignment)}>
                {example.translation}
              </Text>
            ) : null}
            {example.notes ? (
              <Text tone="tertiary" variant="bodySmall" style={deckContentStyle(example.notes, deck.textAlignment)}>
                {example.notes}
              </Text>
            ) : null}
          </View>
        ))}
      </Surface>
    </View>
  );
}
