import { useEffect, useRef } from 'react';
import { AccessibilityInfo, findNodeHandle, ScrollView, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useLocalization } from '@/shared/localization/localization-provider';

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
  const { t } = useLocalization();
  const alignment: ContentAlignment = {
    textAlign: deckAlignment[deck.textAlignment],
    writingDirection: deck.textAlignment === 'rtl' ? 'rtl' : 'ltr',
  };
  const size = deckTypography[deck.typographySize];

  const content = (
    <FlipCard
      key={card.id}
      revealed={revealed}
      accessibilityLabel={t('study.flashcard', { term: card.frontText })}
      front={<FrontContent card={card} deck={deck} alignment={alignment} size={size} />}
      back={
        <BackContent
          card={card}
          revealed={revealed}
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
  const { t } = useLocalization();
  return (
    <View className="min-h-0 flex-1 gap-lg">
      <View className="flex-row items-center justify-between gap-sm">
        <Text variant="labelMedium" tone="secondary">
          {t('study.front')}
        </Text>
        <PronunciationButton text={card.frontText} language={deck.language} />
      </View>
      <ScrollView
        nestedScrollEnabled
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        accessibilityLabel={t('study.front')}
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
            <Text
              variant={size}
              tone="secondary"
              style={alignment}
              accessibilityLabel={t('study.phonetic', { value: card.phonetic })}
            >
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
              <Badge
                label={card.category}
                accessibilityLabel={t('study.category', { value: card.category })}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function BackContent({
  card,
  revealed,
  alignment,
  size,
  backTab,
  onSelectBackTab,
}: {
  card: StudyCardData;
  revealed: boolean;
  alignment: ContentAlignment;
  size: TypographyVariant;
  backTab: 'meaning' | 'examples';
  onSelectBackTab: (tab: 'meaning' | 'examples') => void;
}) {
  const { t } = useLocalization();
  const title = useRef<View>(null);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (!revealed) return;
    const focus = setTimeout(
      () => {
        const target = findNodeHandle(title.current);
        if (target) AccessibilityInfo.setAccessibilityFocus(target);
      },
      reducedMotion ? 0 : 320,
    );
    return () => clearTimeout(focus);
  }, [revealed, reducedMotion]);
  return (
    <View className="min-h-0 flex-1 gap-lg">
      <View
        ref={title}
        collapsable={false}
        accessible
        accessibilityRole="header"
        accessibilityLabel={t('study.answerRevealed')}
      >
        <Text variant="labelMedium" tone="secondary">
          {t('study.answer')}
        </Text>
      </View>
      <View className="flex-row border-b border-border" accessibilityRole="tablist">
        <Tab
          label={t('study.meaning')}
          active={backTab === 'meaning'}
          onPress={() => onSelectBackTab('meaning')}
        />
        <Tab
          label={t('study.examples')}
          active={backTab === 'examples'}
          onPress={() => onSelectBackTab('examples')}
        />
      </View>
      <ScrollView nestedScrollEnabled style={{ flex: 1 }} accessibilityLabel={t('study.answer')}>
        {backTab === 'meaning' ? (
          <Text
            variant={size}
            style={alignment}
            accessibilityLabel={t('study.definition', {
              value: card.meaning || t('study.noDefinition'),
            })}
          >
            {card.meaning || t('study.noDefinition')}
          </Text>
        ) : card.examples.length ? (
          <View className="gap-md">
            {card.examples.map((example, index) => (
              <View
                key={`${card.id}-example-${index}`}
                className="gap-sm rounded-md border border-border p-md"
              >
                <Text
                  variant={size}
                  style={alignment}
                  accessibilityLabel={t('study.example', {
                    index: index + 1,
                    value: example.sentence,
                  })}
                >
                  {example.sentence}
                </Text>
                {example.translation ? (
                  <Text
                    tone="secondary"
                    variant={size}
                    style={alignment}
                    accessibilityLabel={t('study.translation', { value: example.translation })}
                  >
                    {example.translation}
                  </Text>
                ) : null}
                {example.notes ? (
                  <Text
                    tone="tertiary"
                    variant="bodySmall"
                    style={alignment}
                    accessibilityLabel={t('study.notes', { value: example.notes })}
                  >
                    {example.notes}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <Text tone="secondary" style={alignment}>
            {t('study.noExamples')}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
