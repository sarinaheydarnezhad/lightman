import { useCallback } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { View } from 'react-native';

import { Badge } from '@/shared/ui/badge';
import { speech } from '@/core/composition/speech';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { EmptyState } from '@/shared/ui/empty-state';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { Text } from '@/shared/ui/text';
import { StudyCard } from './study-card';
import { StudyControls } from './study-controls';
import { useStudySessionViewModel } from './use-study-session-view-model';

export function StudySessionScreen({ sessionId }: { sessionId: string }) {
  useFocusEffect(useCallback(() => () => void speech.stop(), []));
  const study = useStudySessionViewModel(sessionId);
  const { session, progress, item, card, deck } = study;
  const empty = session?.status === 'completed' && session.initialQueue.length === 0;

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
          <EmptyState
            title="Study unavailable"
            description={study.error ?? 'Unable to show this session.'}
          />
          <Button label="Try again" onPress={() => void study.load()} />
          <Button label="Leave study" variant="secondary" onPress={study.leave} />
          {study.confirmExit ? <ExitConfirmation study={study} /> : null}
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
    <Screen testID="study-session-screen">
      <View className="min-h-0 flex-1 gap-lg">
        <View className="flex-row items-center justify-between gap-sm">
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
          accessibilityLabel={`Card ${progress.currentPosition} of ${total}. ${progress.completed} completed.`}
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
          swipePending={study.swipePending || study.submitting}
          onSwipeStart={study.beginSwipe}
          onSwipeAnswer={(result) => void study.submitSwipe(result)}
        />
        {study.actionError ? (
          <Text tone="error" accessibilityLiveRegion="polite">
            {study.actionError}
          </Text>
        ) : null}
        {study.confirmExit ? (
          <ExitConfirmation study={study} />
        ) : (
          <StudyControls
            revealed={study.revealed}
            submitting={study.submitting || study.swipePending}
            onReveal={study.reveal}
            onFailure={() => void study.submit('failure')}
            onSuccess={() => void study.submit('success')}
          />
        )}
      </View>
    </Screen>
  );
}

function ExitConfirmation({ study }: { study: ReturnType<typeof useStudySessionViewModel> }) {
  return (
    <Card className="gap-md" accessibilityLiveRegion="polite">
      <Text variant="headingSmall">End this session?</Text>
      <Text tone="secondary">
        Your completed reviews will be kept, but this study session will end.
      </Text>
      {study.actionError ? <Text tone="error">{study.actionError}</Text> : null}
      <Button
        label="Keep studying"
        variant="secondary"
        disabled={study.cancelling}
        onPress={study.dismissExit}
      />
      <Button
        label="End session"
        variant="destructive"
        loading={study.cancelling}
        onPress={() => void study.cancel()}
      />
    </Card>
  );
}
