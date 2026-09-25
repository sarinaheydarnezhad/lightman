import { useCallback, useEffect } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { AccessibilityInfo, useWindowDimensions, View } from 'react-native';

import { Badge } from '@/shared/ui/badge';
import { speech } from '@/core/composition/speech';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { ConfirmationPanel } from '@/shared/ui/confirmation-panel';
import { EmptyState } from '@/shared/ui/empty-state';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { Text } from '@/shared/ui/text';
import { StudyCard } from './study-card';
import { StudyControls } from './study-controls';
import { useStudySessionViewModel } from './use-study-session-view-model';

export function StudySessionScreen({ sessionId }: { sessionId: string }) {
  useFocusEffect(useCallback(() => () => void speech.stop(), []));
  const { fontScale, width } = useWindowDimensions();
  const study = useStudySessionViewModel(sessionId);
  const { session, progress, item, card, deck } = study;
  const empty = session?.status === 'completed' && session.initialQueue.length === 0;
  useEffect(() => {
    if (study.phase === 'completed' && session)
      AccessibilityInfo.announceForAccessibility(
        empty ? 'No cards due today.' : 'Session complete. Every card is finished.',
      );
  }, [study.phase, session, empty]);
  useEffect(() => {
    if (study.actionError) AccessibilityInfo.announceForAccessibility(study.actionError);
  }, [study.actionError]);

  if (study.phase === 'loading') {
    return (
      <Screen>
        <View className="flex-1 justify-center">
          <LoadingState label="Loading study session" />
        </View>
      </Screen>
    );
  }
  if (study.phase === 'error') {
    return (
      <Screen>
        <View className="flex-1 justify-center gap-lg">
          <View
            className="gap-lg"
            pointerEvents={study.confirmExit ? 'none' : 'auto'}
            accessibilityElementsHidden={study.confirmExit}
            importantForAccessibility={study.confirmExit ? 'no-hide-descendants' : 'auto'}
          >
            <EmptyState
              title="Study unavailable"
              description={study.error ?? 'Unable to show this session.'}
            />
            <Button label="Try again" onPress={() => void study.load()} />
            <Button label="Leave study" variant="secondary" onPress={study.leave} />
          </View>
          {study.confirmExit ? (
            <ConfirmationPanel
              title="End this session?"
              description="Your completed reviews will be kept, but this study session will end."
              cancelLabel="Keep studying"
              confirmLabel="End session"
              busy={study.cancelling}
              error={study.actionError}
              onCancel={study.dismissExit}
              onConfirm={() => void study.cancel()}
            />
          ) : null}
        </View>
      </Screen>
    );
  }
  if (empty || study.phase === 'cancelled') {
    return (
      <Screen>
        <View className="flex-1 justify-center gap-xl">
          <EmptyState
            title={empty ? 'No cards due today' : 'Session ended'}
            description={
              empty
                ? 'You are all caught up for now. Add a card or try another deck.'
                : 'Your completed reviews were saved.'
            }
          />
          <Button label="Browse decks" onPress={() => router.replace('/decks')} />
          <Button label="Return home" variant="secondary" onPress={() => router.replace('/')} />
        </View>
      </Screen>
    );
  }
  if (study.phase === 'completed' && session && progress) {
    const minutes = Math.ceil((progress.durationMs ?? 0) / 60000);
    return (
      <Screen>
        <View className="flex-1 justify-center gap-xl">
          <EmptyState
            title="Session complete"
            description="You finished every card in this session."
          />
          <Card className="gap-md">
            <Text>Cards studied: {progress.uniqueCardsStudied}</Text>
            <Text>Retries: {progress.retryCount}</Text>
            <Text>
              Study time:{' '}
              {minutes < 1
                ? 'Under a minute'
                : `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`}
            </Text>
          </Card>
          {study.start.error ? (
            <Text tone="error" accessibilityLiveRegion="polite">
              {study.start.error}
            </Text>
          ) : null}
          {study.start.activeSession ? (
            <Button
              label="Resume session"
              variant="secondary"
              onPress={() =>
                study.start.activeSession &&
                router.replace({
                  pathname: '/study/[sessionId]',
                  params: { sessionId: study.start.activeSession.id },
                })
              }
            />
          ) : null}
          <Button
            label="Study again"
            loading={study.start.starting}
            onPress={() => void study.start.start(session.scope, true)}
          />
          <Button label="Done" variant="secondary" onPress={() => router.replace('/study')} />
        </View>
      </Screen>
    );
  }
  if (!card || !deck || !item || !progress) return null;
  const total = progress.completed + progress.remaining;
  return (
    <Screen scroll testID="study-session-screen">
      <View className="min-h-0 flex-1 gap-lg">
        <View
          className="min-h-0 flex-1 gap-lg"
          pointerEvents={study.confirmExit ? 'none' : 'auto'}
          accessibilityElementsHidden={study.confirmExit}
          importantForAccessibility={study.confirmExit ? 'no-hide-descendants' : 'auto'}
        >
          <View
            className={`${fontScale >= 1.4 || width < 360 ? 'gap-sm' : 'flex-row items-center justify-between gap-sm'}`}
          >
            <View className="min-w-0 flex-1">
              <Text tone="secondary" variant="labelMedium">
                {deck.name}
              </Text>
              <Text variant="headingSmall" accessibilityRole="header">
                Study session
              </Text>
            </View>
            <Button
              label="Exit study"
              variant="tertiary"
              disabled={study.submitting || study.swipePending}
              onPress={study.leave}
            />
          </View>
          <View
            className="flex-row items-center justify-between gap-md"
            accessible
            accessibilityLabel={`Card ${progress.currentPosition} of ${total}. ${progress.completed} completed.${item.kind === 'retry' ? ' One more try.' : ''}`}
          >
            <Text variant="labelLarge">
              {progress.currentPosition} / {total}
            </Text>
            {item.kind === 'retry' ? (
              <Badge label="One more try" />
            ) : (
              <Text variant="bodySmall" tone="secondary">
                {progress.remaining} remaining
              </Text>
            )}
          </View>
          <StudyCard
            key={`${item.presentationId}-${study.swipeResetKey}`}
            card={card}
            deck={deck}
            revealed={study.revealed}
            backTab={study.backTab}
            onSelectBackTab={study.selectBackTab}
            swipePending={study.swipePending || study.submitting || study.confirmExit}
            onSwipeStart={study.beginSwipe}
            onSwipeAnswer={(result) => void study.submitSwipe(result)}
          />
          {study.actionError && !study.confirmExit ? (
            <Text tone="error" accessibilityLiveRegion="polite">
              {study.actionError}
            </Text>
          ) : null}
          <StudyControls
            revealed={study.revealed}
            submitting={study.submitting || study.swipePending || study.confirmExit}
            onReveal={study.reveal}
            onFailure={() => void study.submit('failure')}
            onSuccess={() => void study.submit('success')}
          />
        </View>
        {study.confirmExit ? (
          <ConfirmationPanel
            title="End this session?"
            description="Your completed reviews will be kept, but this study session will end."
            cancelLabel="Keep studying"
            confirmLabel="End session"
            busy={study.cancelling}
            error={study.actionError}
            onCancel={study.dismissExit}
            onConfirm={() => void study.cancel()}
          />
        ) : null}
      </View>
    </Screen>
  );
}
