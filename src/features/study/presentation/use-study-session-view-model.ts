import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, BackHandler } from 'react-native';
import { router } from 'expo-router';

import { application } from '@/core/composition/application';
import { haptics } from '@/core/composition/haptics';
import { useLocalization } from '@/shared/localization/localization-provider';
import { AppError } from '@/core/errors/app-error';
import type { Deck } from '@/features/decks/domain/deck';
import type { Card } from '../domain/card';
import type { ReviewResult } from '../domain/review';
import type { StudySession } from '../domain/study-session';
import type { CurrentStudyItem, StudyProgress } from '../application/create-study-use-cases';
import { useStartStudy } from './use-start-study';

type Phase = 'loading' | 'ready' | 'completed' | 'cancelled' | 'error';
type BackTab = 'meaning' | 'examples';

function safeError(cause: unknown, fallback: string): string {
  if (cause instanceof AppError) {
    if (cause.code === 'not-found')
      return 'A card or session is no longer available. Try again or leave this session.';
    return cause.message;
  }
  return fallback;
}

export function useStudySessionViewModel(sessionId: string) {
  const { t } = useLocalization();
  const [phase, setPhase] = useState<Phase>('loading');
  const [session, setSession] = useState<StudySession | null>(null);
  const [progress, setProgress] = useState<StudyProgress | null>(null);
  const [item, setItem] = useState<CurrentStudyItem | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [backTab, setBackTab] = useState<BackTab>('meaning');
  const [submitting, setSubmitting] = useState(false);
  const [swipePending, setSwipePending] = useState(false);
  const [swipeResetKey, setSwipeResetKey] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const revealedRef = useRef(false);
  const swipePendingRef = useRef(false);
  const request = useRef(0);
  const start = useStartStudy();

  const load = useCallback(async () => {
    const version = ++request.current;
    setPhase('loading');
    setCard(null);
    setDeck(null);
    setItem(null);
    setRevealed(false);
    revealedRef.current = false;
    setBackTab('meaning');
    setError(null);
    try {
      const {
        session: currentSession,
        progress: currentProgress,
        currentItem: current,
      } = await application.getStudySnapshot(sessionId);
      if (version !== request.current) return;
      setSession(currentSession);
      setProgress(currentProgress);
      if (currentSession.status !== 'in-progress') {
        setPhase(currentSession.status === 'cancelled' ? 'cancelled' : 'completed');
        return;
      }
      if (!current) throw new AppError('not-found', 'Study card not found.');
      const [nextCard, nextDeck] = await Promise.all([
        application.getCard(current.cardId),
        application.getDeck(current.deckId),
      ]);
      if (nextCard.deckId !== nextDeck.id)
        throw new AppError('validation', 'Study card has changed decks.');
      if (version !== request.current) return;
      setItem(current);
      setCard(nextCard);
      setDeck(nextDeck);
      setPhase('ready');
    } catch (cause) {
      if (version === request.current) {
        setError(safeError(cause, 'Unable to load this study session. Try again.'));
        setPhase('error');
      }
    }
  }, [sessionId]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return load();
    });
    return () => {
      active = false;
      request.current += 1;
    };
  }, [load]);

  const beginSwipe = useCallback(() => {
    if (inFlight.current || swipePendingRef.current || !revealed || !item || phase !== 'ready')
      return;
    swipePendingRef.current = true;
    setSwipePending(true);
  }, [item, phase, revealed]);

  const submitAnswer = useCallback(
    async (result: ReviewResult, source: 'button' | 'swipe') => {
      if (
        inFlight.current ||
        !revealed ||
        !item ||
        phase !== 'ready' ||
        (source === 'button' && swipePendingRef.current) ||
        (source === 'swipe' && !swipePendingRef.current)
      )
        return;
      inFlight.current = true;
      setSubmitting(true);
      setActionError(null);
      try {
        await application.submitStudyAnswer({
          sessionId,
          cardId: item.cardId,
          presentationId: item.presentationId,
          result,
        });
        AccessibilityInfo.announceForAccessibility(
          t('study.answerSaved', {
            result: t(result === 'success' ? 'study.success' : 'study.failure'),
          }),
        );
        // This is the accepted-presentation boundary for both buttons and swipes.
        void (result === 'success' ? haptics.answerSuccess() : haptics.answerFailure());
        await load();
      } catch (cause) {
        setActionError(safeError(cause, 'Unable to save your answer. Try again.'));
        // Remount only the card surface; the revealed answer stays available for retry.
        setSwipeResetKey((key) => key + 1);
      } finally {
        inFlight.current = false;
        setSubmitting(false);
        swipePendingRef.current = false;
        setSwipePending(false);
      }
    },
    [item, load, phase, revealed, sessionId, t],
  );

  const submit = useCallback(
    (result: ReviewResult) => submitAnswer(result, 'button'),
    [submitAnswer],
  );
  const submitFailure = useCallback(() => void submit('failure'), [submit]);
  const submitSuccess = useCallback(() => void submit('success'), [submit]);

  const reveal = useCallback(() => {
    if (revealedRef.current || inFlight.current || !item || phase !== 'ready') return;
    revealedRef.current = true;
    setRevealed(true);
    void haptics.cardReveal();
  }, [item, phase]);
  const submitSwipe = useCallback(
    (result: ReviewResult) => submitAnswer(result, 'swipe'),
    [submitAnswer],
  );

  const cancel = useCallback(async () => {
    if (inFlight.current || swipePendingRef.current) return;
    inFlight.current = true;
    setCancelling(true);
    setActionError(null);
    try {
      await application.cancelStudySession(sessionId);
      setConfirmExit(false);
      router.replace('/study');
    } catch (cause) {
      setActionError(safeError(cause, 'Unable to end this session. Try again.'));
      setConfirmExit(false);
      setCancelling(false);
    } finally {
      inFlight.current = false;
    }
  }, [sessionId]);

  const leave = useCallback(() => {
    if (inFlight.current || swipePendingRef.current) return;
    if (session?.status === 'in-progress') {
      if (progress?.completed) setConfirmExit(true);
      else void cancel();
    } else router.replace('/study');
  }, [session, progress, cancel]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (phase === 'loading') return true;
      if (confirmExit) {
        if (!cancelling) setConfirmExit(false);
        return true;
      }
      if (phase === 'ready' || (phase === 'error' && session?.status === 'in-progress')) {
        leave();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [phase, session, leave, confirmExit, cancelling]);

  return {
    phase,
    session,
    progress,
    item,
    card,
    deck,
    revealed,
    backTab,
    submitting,
    swipePending,
    swipeResetKey,
    cancelling,
    confirmExit,
    error,
    actionError,
    start,
    load,
    leave,
    cancel,
    dismissExit: () => setConfirmExit(false),
    reveal,
    selectBackTab: setBackTab,
    submit,
    submitFailure,
    submitSuccess,
    beginSwipe,
    submitSwipe,
  };
}
