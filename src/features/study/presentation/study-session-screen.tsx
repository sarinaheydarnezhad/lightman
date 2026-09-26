import { useCallback, useEffect } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { AccessibilityInfo, useWindowDimensions, View } from 'react-native';

import { Badge } from '@/shared/ui/badge';
import { speech } from '@/core/composition/speech';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { ConfirmationPanel } from '@/shared/ui/confirmation-panel';
import { EmptyState } from '@/shared/ui/empty-state';
import { ErrorState } from '@/shared/ui/error-state';
import { LoadingState } from '@/shared/ui/loading-state';
import { Screen } from '@/shared/ui/screen';
import { Text } from '@/shared/ui/text';
import { StudyCard } from './study-card';
import { StudyControls } from './study-controls';
import { useStudySessionViewModel } from './use-study-session-view-model';
import { useLocalization } from '@/shared/localization/localization-provider';

export function StudySessionScreen({ sessionId }: { sessionId: string }) {
  const { t, number, language } = useLocalization();
  useFocusEffect(useCallback(() => () => void speech.stop(), []));
  const { fontScale, width } = useWindowDimensions();
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
    const minutes = Math.ceil((progress.durationMs ?? 0) / 60000);
    return (
      <Screen>
        <View className="flex-1 justify-center gap-xl">
          <EmptyState title={t('study.complete')} description={t('study.completeHint')} />
          <Card className="gap-md">
            <Text>{t('study.cardsStudied', { count: number(progress.uniqueCardsStudied) })}</Text>
            <Text>{t('study.retries', { count: number(progress.retryCount) })}</Text>
            <Text>
              {t('study.time', {
                value:
                  minutes < 1
                    ? t('study.underMinute')
                    : t(minutes === 1 ? 'study.minute' : 'study.minutes', {
                        count: number(minutes),
                      }),
              })}
            </Text>
          </Card>
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
          <Button
            label={t('study.again')}
            loading={study.start.starting}
            onPress={() => void study.start.start(session.scope, true)}
          />
          <Button
            label={t('study.done')}
            variant="secondary"
            onPress={() => router.replace('/study')}
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
          <View
            className={`${fontScale >= 1.4 || width < 360 ? 'gap-sm' : 'flex-row items-center justify-between gap-sm'}`}
          >
            <View className="min-w-0 flex-1">
              <Text tone="secondary" variant="labelMedium">
                {deck.name}
              </Text>
              <Text variant="headingSmall" accessibilityRole="header">
                {t('study.session')}
              </Text>
            </View>
            <Button
              label={t('study.exit')}
              variant="tertiary"
              disabled={study.submitting || study.swipePending}
              onPress={study.leave}
            />
          </View>
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
          <StudyCard
            key={`${item.presentationId}-${study.swipeResetKey}`}
            card={card}
            deck={deck}
            revealed={study.revealed}
            backTab={study.backTab}
            onSelectBackTab={study.selectBackTab}
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
            onReveal={study.reveal}
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
