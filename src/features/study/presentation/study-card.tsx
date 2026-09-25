import { ScrollView, View } from 'react-native';

import type { Deck, TypographySize } from '@/features/decks/domain/deck';
import { deckAlignment, deckTypography } from '@/features/decks/presentation/deck-presentation';
import type { TypographyVariant } from '@/shared/theme/tokens';
import { Badge } from '@/shared/ui/badge';
import { PronunciationButton } from '@/shared/speech/pronunciation-button';
import { Tab } from '@/shared/ui/tab';
import { Text } from '@/shared/ui/text';
import type { Card as StudyCardData } from '../domain/card';
import type { ReviewResult } from '../domain/review';
import { FlipCard } from './flip-card';
import { SwipeableStudyCard } from './swipeable-study-card';

interface StudyCardProps {
  readonly card: StudyCardData;
  readonly deck: Deck;
  readonly revealed: boolean;
  readonly backTab: 'meaning' | 'examples';
  readonly onSelectBackTab: (tab: 'meaning' | 'examples') => void;
  readonly swipePending?: boolean;
  readonly onSwipeStart?: () => void;
  readonly onSwipeAnswer?: (result: ReviewResult) => void;
}

type ContentAlignment = {
  readonly textAlign: 'left' | 'right' | 'center';
  readonly writingDirection: 'ltr' | 'rtl';
};

const frontTypography: Record<TypographySize, TypographyVariant> = {
  small: 'headingMedium',
  medium: 'headingLarge',
  large: 'display',
};

/** Supplies card content and presentation settings without owning the animation or session. */
export function StudyCard({
  card,
  deck,
  revealed,
  backTab,
  onSelectBackTab,
  swipePending = false,
  onSwipeStart,
  onSwipeAnswer,
}: StudyCardProps) {
  const alignment: ContentAlignment = {
    textAlign: deckAlignment[deck.textAlignment],
    writingDirection: deck.textAlignment === 'rtl' ? 'rtl' : 'ltr',
  };
  const size = deckTypography[deck.typographySize];

  const content = (
    <FlipCard
      key={card.id}
      revealed={revealed}
      accessibilityLabel={`Flashcard: ${card.frontText}`}
      front={<FrontContent card={card} deck={deck} alignment={alignment} size={size} />}
      back={
        <BackContent
          card={card}
          alignment={alignment}
          size={size}
          backTab={backTab}
          onSelectBackTab={onSelectBackTab}
        />
      }
    />
  );
  if (!onSwipeStart || !onSwipeAnswer) return content;
  return (
    <SwipeableStudyCard
      revealed={revealed}
      active={!swipePending}
      pending={swipePending}
      onCommitStart={onSwipeStart}
      onAnswer={onSwipeAnswer}
    >
      {content}
    </SwipeableStudyCard>
  );
}

function FrontContent({
  card,
  deck,
  alignment,
  size,
}: {
  card: StudyCardData;
  deck: Deck;
  alignment: ContentAlignment;
  size: TypographyVariant;
}) {
  return (
    <View className="min-h-0 flex-1 gap-lg">
      <View
        className="flex-row items-center justify-between gap-sm"
        style={{ flexDirection: deck.textAlignment === 'rtl' ? 'row-reverse' : 'row' }}
      >
        <Text variant="labelMedium" tone="secondary">
          FRONT
        </Text>
        <PronunciationButton text={card.frontText} language={deck.language} />
      </View>
      <ScrollView
        nestedScrollEnabled
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        accessibilityLabel="Flashcard front"
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
        </View>
      </ScrollView>
    </View>
  );
}

function BackContent({
  card,
  alignment,
  size,
  backTab,
  onSelectBackTab,
}: {
  card: StudyCardData;
  alignment: ContentAlignment;
  size: TypographyVariant;
  backTab: 'meaning' | 'examples';
  onSelectBackTab: (tab: 'meaning' | 'examples') => void;
}) {
  return (
    <View className="min-h-0 flex-1 gap-lg" accessibilityLiveRegion="polite">
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
      <ScrollView nestedScrollEnabled style={{ flex: 1 }} accessibilityLabel="Flashcard answer">
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
      </ScrollView>
    </View>
  );
}
