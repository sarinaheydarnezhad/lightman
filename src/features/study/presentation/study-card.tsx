import { ScrollView, View } from 'react-native';

import type { Deck, TypographySize } from '@/features/decks/domain/deck';
import { deckAlignment, deckTypography } from '@/features/decks/presentation/deck-presentation';
import { Badge } from '@/shared/ui/badge';
import { Card } from '@/shared/ui/card';
import { Tab } from '@/shared/ui/tab';
import { Text } from '@/shared/ui/text';
import type { TypographyVariant } from '@/shared/theme/tokens';
import type { Card as StudyCardData } from '../domain/card';

interface StudyCardProps {
  readonly card: StudyCardData;
  readonly deck: Deck;
  readonly revealed: boolean;
  readonly backTab: 'meaning' | 'examples';
  readonly onSelectBackTab: (tab: 'meaning' | 'examples') => void;
}

const frontTypography: Record<TypographySize, TypographyVariant> = {
  small: 'headingMedium',
  medium: 'headingLarge',
  large: 'display',
};

/** Displays only the current presentation; the session and review rules live outside this component. */
export function StudyCard({ card, deck, revealed, backTab, onSelectBackTab }: StudyCardProps) {
  const alignment = {
    textAlign: deckAlignment[deck.textAlignment],
    writingDirection: deck.textAlignment === 'rtl' ? ('rtl' as const) : ('ltr' as const),
  };
  const size = deckTypography[deck.typographySize];

  return (
    <Card className="min-h-0 flex-1 gap-lg" accessibilityLabel={`Flashcard: ${card.frontText}`}>
      <Text variant="labelMedium" tone="secondary">
        FRONT
      </Text>
      <ScrollView
        nestedScrollEnabled
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        accessibilityLabel={revealed ? 'Flashcard front and answer' : 'Flashcard front'}
      >
        <View className="gap-md py-md">
          <Text
            variant={frontTypography[deck.typographySize]}
            weight="bold"
            style={alignment}
            accessibilityRole="header"
          >
            {card.frontText}
          </Text>
          {card.phonetic ? (
            <Text variant={size} tone="secondary" style={alignment}>
              {card.phonetic}
            </Text>
          ) : null}
          {card.category ? (
            <View
              style={{
                alignItems:
                  deck.textAlignment === 'rtl'
                    ? 'flex-end'
                    : deck.textAlignment === 'center'
                      ? 'center'
                      : 'flex-start',
              }}
            >
              <Badge label={card.category} />
            </View>
          ) : null}
          {revealed ? (
            <View className="gap-lg pt-xl" accessibilityLiveRegion="polite">
              <Text variant="labelMedium" tone="secondary">
                BACK
              </Text>
              <View className="flex-row border-b border-border" accessibilityRole="tablist">
                <Tab
                  label="Meaning"
                  active={backTab === 'meaning'}
                  onPress={() => onSelectBackTab('meaning')}
                />
                <Tab
                  label="Examples"
                  active={backTab === 'examples'}
                  onPress={() => onSelectBackTab('examples')}
                />
              </View>
              {backTab === 'meaning' ? (
                <Text variant={size} style={alignment}>
                  {card.meaning || 'No definition added'}
                </Text>
              ) : card.examples.length ? (
                <View className="gap-md">
                  {card.examples.map((example, index) => (
                    <View
                      key={`${card.id}-example-${index}`}
                      className="gap-sm rounded-md border border-border p-md"
                    >
                      <Text variant={size} style={alignment}>
                        {example.sentence}
                      </Text>
                      {example.translation ? (
                        <Text tone="secondary" variant={size} style={alignment}>
                          {example.translation}
                        </Text>
                      ) : null}
                      {example.notes ? (
                        <Text tone="tertiary" variant="bodySmall" style={alignment}>
                          {example.notes}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : (
                <Text tone="secondary" style={alignment}>
                  No examples added yet.
                </Text>
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Card>
  );
}
