import { useCallback, useEffect } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { AccessibilityInfo, View } from 'react-native';
import { CircleCheck, X } from 'lucide-react-native';

import { Badge } from '@/shared/ui/badge';
import { speech } from '@/core/composition/speech';
import { Button } from '@/shared/ui/button';
import { ConfirmationPanel } from '@/shared/ui/confirmation-panel';
import { EmptyState } from '@/shared/ui/empty-state';
import { ErrorState } from '@/shared/ui/error-state';
import { LoadingState } from '@/shared/ui/loading-state';
import { IconButton } from '@/shared/ui/icon-button';
import { Progress } from '@/shared/ui/progress';
import { Screen } from '@/shared/ui/screen';
import { Text } from '@/shared/ui/text';
import { StudyCard } from './study-card';
import { StudyControls } from './study-controls';
import { StudyResultSummary } from './study-result-summary';
import { useStudySessionViewModel } from './use-study-session-view-model';
import { useLocalization } from '@/shared/localization/localization-provider';

export function StudySessionScreen({ sessionId }: { sessionId: string }) {
  const { t, number, language } = useLocalization();
  useFocusEffect(useCallback(() => () => void speech.stop(), []));
  const study = useStudySessionViewModel(sessionId);
  const { session, progress, item, card, deck } = study;
  const empty = session?.status === 'completed' && session.initialQueue.length === 0;
  useEffect(() => {
    if (study.phase === 'completed' && session)
      AccessibilityInfo.announceForAccessibility(
        empty ? t('study.noneDue') : t('study.completeHint'),
      );
  }, [study.phase, session, empty, t]);
  useEffect(() => {
    if (study.actionError)
      AccessibilityInfo.announceForAccessibility(
        language === 'en' ? study.actionError : t('common.genericError'),
      );
  }, [study.actionError, language, t]);

  if (study.phase === 'loading') {
    return (
      <Screen>
        <View className="flex-1 justify-center">
          <LoadingState label={t('study.session')} />
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
            <ErrorState
              title={t('study.unavailable')}
              description={
                language === 'en'
                  ? (study.error ?? t('study.unavailableHint'))
                  : t('study.unavailableHint')
              }
              onRetry={() => void study.load()}
            />
            <Button label={t('study.leave')} variant="secondary" onPress={study.leave} />
          </View>
          {study.confirmExit ? (
            <ConfirmationPanel
              title={t('study.exitTitle')}
              description={t('study.exitHint')}
              cancelLabel={t('study.keep')}
              confirmLabel={t('study.end')}
              busy={study.cancelling}
              error={
                language === 'en'
                  ? study.actionError
                  : study.actionError && t('common.genericError')
              }
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
            title={t(empty ? 'study.noneDue' : 'study.ended')}
            description={t(empty ? 'study.noneDueHint' : 'study.endedHint')}
          />
          <Button label={t('common.browseDecks')} onPress={() => router.replace('/decks')} />
          <Button
            label={t('common.returnHome')}
            variant="secondary"
            onPress={() => router.replace('/')}
          />
        </View>
      </Screen>
    );
  }
  if (study.phase === 'completed' && session && progress) {
    return (
      <Screen scroll>
        <View className="min-h-0 flex-1 justify-center gap-xl pb-xl">
          <EmptyState
            title={t('study.complete')}
            description={t('study.completeHint')}
            icon={CircleCheck}
          />
          <StudyResultSummary progress={progress} />
          {study.actionError ? (
            <Text tone="error" accessibilityLiveRegion="polite">
              {language === 'en' ? study.actionError : t('common.genericError')}
            </Text>
          ) : null}
          {progress.canReviewAgain ? (
            <Button
              label={t('review.again')}
              loading={study.reviewingAgain}
              onPress={() => void study.reviewAgain()}
            />
          ) : null}
          {study.start.error ? (
            <Text tone="error" accessibilityLiveRegion="polite">
              {language === 'en' ? study.start.error : t('common.genericError')}
            </Text>
          ) : null}
          {study.start.activeSession ? (
            <Button
              label={t('study.resume')}
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
          <Button label={t('study.done')} onPress={() => router.replace('/study')} />
          <Button
            label={t('study.again')}
            variant="secondary"
            loading={study.start.starting}
            onPress={() => void study.start.start(session.scope, true)}
          />
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
          <View className="flex-row items-center gap-md">
            <View className="min-w-0 flex-1 gap-xs">
              <Text tone="secondary" variant="labelMedium" numberOfLines={1}>
                {deck.name}
              </Text>
              <Text variant="headingSmall" accessibilityRole="header">
                {t('study.session')}
              </Text>
              <Text
                testID="study-correct-answers"
                variant="labelMedium"
                tone="success"
                accessibilityLiveRegion="polite"
              >
                {t('study.correctAnswers', { count: number(progress.correctReviews) })}
              </Text>
            </View>
            <IconButton
              icon={X}
              label={t('study.exit')}
              variant="ghost"
              disabled={study.submitting || study.swipePending}
              onPress={study.leave}
            />
          </View>
          <View className="gap-sm">
            <View
              className="flex-row items-center justify-between gap-md"
              accessible
              accessibilityLabel={`${t('study.progress', { position: number(progress.currentPosition ?? 0), total: number(total), completed: number(progress.completed) })}${item.kind === 'retry' ? ` ${t('study.retry')}.` : ''}`}
            >
              <Text variant="labelLarge" style={{ writingDirection: 'ltr' }}>
                {number(progress.currentPosition ?? 0)} / {number(total)}
              </Text>
              {item.kind === 'retry' ? (
                <Badge label={t('study.retry')} />
              ) : (
                <Text variant="bodySmall" tone="secondary">
                  {t('study.remaining', { count: number(progress.remaining) })}
                </Text>
              )}
            </View>
            <Progress
              value={total ? progress.completed / total : 0}
              label={t('study.progress', {
                position: number(progress.currentPosition ?? 0),
                total: number(total),
                completed: number(progress.completed),
              })}
            />
          </View>
          <StudyCard
            key={`${item.presentationId}-${study.swipeResetKey}`}
            card={card}
            deck={deck}
            revealed={study.revealed}
            backTab={study.backTab}
            onSelectBackTab={study.selectBackTab}
            onFlip={study.flip}
            swipePending={study.swipePending || study.submitting || study.confirmExit}
            onSwipeStart={study.beginSwipe}
            onSwipeAnswer={study.submitSwipe}
          />
          {study.actionError && !study.confirmExit ? (
            <Text tone="error" accessibilityLiveRegion="polite">
              {language === 'en' ? study.actionError : t('common.genericError')}
            </Text>
          ) : null}
          <StudyControls
            revealed={study.revealed}
            submitting={study.submitting || study.swipePending || study.confirmExit}
            onFailure={study.submitFailure}
            onSuccess={study.submitSuccess}
          />
        </View>
        {study.confirmExit ? (
          <ConfirmationPanel
            title={t('study.exitTitle')}
            description={t('study.exitHint')}
            cancelLabel={t('study.keep')}
            confirmLabel={t('study.end')}
            busy={study.cancelling}
            error={
              language === 'en' ? study.actionError : study.actionError && t('common.genericError')
            }
            onCancel={study.dismissExit}
            onConfirm={() => void study.cancel()}
          />
        ) : null}
      </View>
    </Screen>
  );
}
