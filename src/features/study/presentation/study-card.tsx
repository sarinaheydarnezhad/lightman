import { memo, useEffect, useRef } from 'react';
import { AccessibilityInfo, findNodeHandle, Platform, ScrollView, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useLocalization } from '@/shared/localization/localization-provider';

import type { Deck, TypographySize } from '@/features/decks/domain/deck';
import {
  deckContentStyle,
  deckBadgeAlignment,
  deckTypography,
} from '@/features/decks/presentation/deck-presentation';
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
  readonly onFlip?: () => void;
  readonly swipePending?: boolean;
  readonly onSwipeStart?: () => void;
  readonly onSwipeAnswer?: (result: ReviewResult) => void;
}

const frontTypography: Record<TypographySize, TypographyVariant> = {
  small: 'headingMedium',
  medium: 'headingLarge',
  large: 'display',
};

/** Supplies card content and presentation settings without owning the animation or session. */
export const StudyCard = memo(function StudyCard({
  card,
  deck,
  revealed,
  backTab,
  onSelectBackTab,
  onFlip,
  swipePending = false,
  onSwipeStart,
  onSwipeAnswer,
}: StudyCardProps) {
  const { t } = useLocalization();
  const size = deckTypography[deck.typographySize];
  const flip = swipePending ? undefined : onFlip;

  const content = (
    <FlipCard
      key={card.id}
      revealed={revealed}
      accessibilityLabel={t('study.flashcard', { term: card.frontText })}
      onFlip={onFlip}
      disabled={swipePending}
      front={<FrontContent card={card} deck={deck} size={size} onFlip={flip} />}
      back={
        <BackContent
          card={card}
          revealed={revealed}
          deck={deck}
          size={size}
          backTab={backTab}
          onSelectBackTab={onSelectBackTab}
          onFlip={flip}
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
});

function FrontContent({
  card,
  deck,
  size,
  onFlip,
}: {
  card: StudyCardData;
  deck: Deck;
  size: TypographyVariant;
  onFlip?: () => void;
}) {
  const { t } = useLocalization();
  return (
    <View className="min-h-0 flex-1 gap-lg">
      <View className="flex-row items-center justify-end gap-sm">
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
            style={deckContentStyle(card.frontText, deck.textAlignment)}
            accessibilityRole="header"
            accessibilityActions={onFlip ? [{ name: 'activate', label: t('study.reveal') }] : []}
            onAccessibilityAction={(event) => {
              if (event.nativeEvent.actionName === 'activate') onFlip?.();
            }}
          >
            {card.frontText}
          </Text>
          {card.phonetic ? (
            <Text
              variant={size}
              tone="secondary"
              style={deckContentStyle(card.phonetic, deck.textAlignment)}
              accessibilityLabel={t('study.phonetic', { value: card.phonetic })}
            >
              {card.phonetic}
            </Text>
          ) : null}
          {card.category ? (
            <Badge
              label={card.category}
              style={{ alignSelf: deckBadgeAlignment[deck.textAlignment] }}
              accessibilityLabel={t('study.category', { value: card.category })}
            />
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

function BackContent({
  card,
  revealed,
  deck,
  size,
  backTab,
  onSelectBackTab,
  onFlip,
}: {
  card: StudyCardData;
  revealed: boolean;
  deck: Deck;
  size: TypographyVariant;
  backTab: 'meaning' | 'examples';
  onSelectBackTab: (tab: 'meaning' | 'examples') => void;
  onFlip?: () => void;
}) {
  const { t } = useLocalization();
  const title = useRef<View>(null);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (!revealed || Platform.OS === 'web') return;
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
        style={{ position: 'absolute', width: 1, height: 1 }}
        collapsable={false}
        accessible
        accessibilityRole="header"
        accessibilityLabel={t('study.answerRevealed')}
        accessibilityActions={onFlip ? [{ name: 'activate', label: t('study.showFront') }] : []}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'activate') onFlip?.();
        }}
      />
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
            style={deckContentStyle(card.meaning || t('study.noDefinition'), deck.textAlignment)}
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
                className="gap-sm border-b border-border pb-md"
              >
                <Text
                  variant={size}
                  style={deckContentStyle(example.sentence, deck.textAlignment)}
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
                    style={deckContentStyle(example.translation, deck.textAlignment)}
                    accessibilityLabel={t('study.translation', { value: example.translation })}
                  >
                    {example.translation}
                  </Text>
                ) : null}
                {example.notes ? (
                  <Text
                    tone="tertiary"
                    variant="bodySmall"
                    style={deckContentStyle(example.notes, deck.textAlignment)}
                    accessibilityLabel={t('study.notes', { value: example.notes })}
                  >
                    {example.notes}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : (
          <Text
            tone="secondary"
            style={deckContentStyle(t('study.noExamples'), deck.textAlignment)}
          >
            {t('study.noExamples')}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
