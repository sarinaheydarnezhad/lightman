import { durationInMilliseconds, instant, type Instant } from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';
import { reviewResult, type ReviewResult } from './review';
import {
  validateStudySession,
  validateStudyQueueItem,
  type StudyPresentationKind,
  type StudyQueueItem,
  type StudyScope,
  type StudySession,
  type StudySessionStatus,
} from './study-session';

export function startStudySession(
  id: string,
  scope: StudyScope,
  initialQueue: readonly StudyQueueItem[],
  startedAt: Instant,
): StudySession {
  const time = instant(startedAt);
  return validateStudySession({
    id,
    scope,
    status: initialQueue.length === 0 ? 'completed' : 'in-progress',
    startedAt: time,
    completedAt: initialQueue.length === 0 ? time : null,
    cancelledAt: null,
    initialQueue,
    retryQueue: [],
    currentIndex: 0,
    retrySuccesses: 0,
  });
}

export interface CurrentStudyItem extends StudyQueueItem {
  readonly presentationId: string;
  readonly kind: StudyPresentationKind;
}

export function getCurrentStudyItem(session: StudySession): CurrentStudyItem | null {
  if (session.status !== 'in-progress') return null;
  const index = session.currentIndex;
  const isInitial = index < session.initialQueue.length;
  const item = isInitial
    ? session.initialQueue[index]
    : session.retryQueue[index - session.initialQueue.length];
  if (!item) throw new AppError('validation', 'Study session has no current card.');
  return {
    ...item,
    presentationId: `${session.id}:${index}`,
    kind: isInitial ? 'initial' : 'retry',
  };
}

export function assertCurrentStudyItem(
  session: StudySession,
  cardId: string,
  presentationId: string,
): CurrentStudyItem {
  if (session.status !== 'in-progress')
    throw new AppError('conflict', 'Study session is not active.');
  const item = getCurrentStudyItem(session)!;
  if (item.presentationId !== presentationId)
    throw new AppError('conflict', 'Study presentation was already answered.');
  if (item.cardId !== cardId)
    throw new AppError('validation', 'Answer does not match the current study card.');
  return item;
}

/** Advance only after ReviewCard has recorded one review for this presentation. */
export function advanceStudySession(
  session: StudySession,
  item: CurrentStudyItem,
  result: ReviewResult,
  reviewedAt: Instant,
): StudySession {
  const current = assertCurrentStudyItem(session, item.cardId, item.presentationId);
  reviewResult(result);
  instant(reviewedAt);
  if (session.startedAt === null || reviewedAt < session.startedAt)
    throw new AppError('validation', 'Review time precedes the study session.');
  const retryQueue =
    current.kind === 'initial' && result === 'failure'
      ? [...session.retryQueue, validateStudyQueueItem(current)]
      : session.retryQueue;
  const currentIndex = session.currentIndex + 1;
  const completed = currentIndex === session.initialQueue.length + retryQueue.length;
  return validateStudySession({
    ...session,
    retryQueue,
    currentIndex,
    retrySuccesses:
      session.retrySuccesses + (current.kind === 'retry' && result === 'success' ? 1 : 0),
    status: completed ? 'completed' : 'in-progress',
    completedAt: completed ? reviewedAt : null,
  });
}

export function cancelStudySession(session: StudySession, cancelledAt: Instant): StudySession {
  if (session.status !== 'in-progress')
    throw new AppError('conflict', 'Study session is not active.');
  return validateStudySession({
    ...session,
    status: 'cancelled',
    cancelledAt: instant(cancelledAt),
  });
}

export interface StudyProgress {
  readonly status: StudySessionStatus;
  readonly currentPosition: number | null;
  readonly initialQueueSize: number;
  readonly completed: number;
  readonly remaining: number;
  readonly failures: number;
  readonly retries: number;
  readonly isComplete: boolean;
  readonly totalPresentations: number;
  readonly uniqueCardsStudied: number;
  readonly successfulInitialAnswers: number;
  readonly failedInitialAnswers: number;
  readonly retryCount: number;
  readonly finalSuccessCount: number;
  readonly durationMs: number | null;
}

export function getStudyProgress(session: StudySession): StudyProgress {
  const valid = validateStudySession(session);
  const initialSize = valid.initialQueue.length;
  const initialAnswered = Math.min(valid.currentIndex, initialSize);
  const retries = Math.max(0, valid.currentIndex - initialSize);
  const failedInitialAnswers = valid.retryQueue.length;
  const successfulInitialAnswers = initialAnswered - failedInitialAnswers;
  const end = valid.completedAt ?? valid.cancelledAt;
  return {
    status: valid.status,
    currentPosition: valid.status === 'in-progress' ? valid.currentIndex + 1 : null,
    initialQueueSize: initialSize,
    completed: valid.currentIndex,
    remaining: initialSize + valid.retryQueue.length - valid.currentIndex,
    failures: failedInitialAnswers + retries - valid.retrySuccesses,
    retries,
    isComplete: valid.status === 'completed',
    totalPresentations: valid.currentIndex,
    uniqueCardsStudied: initialAnswered,
    successfulInitialAnswers,
    failedInitialAnswers,
    retryCount: retries,
    finalSuccessCount: successfulInitialAnswers + valid.retrySuccesses,
    durationMs: valid.startedAt && end ? durationInMilliseconds(valid.startedAt, end) : null,
  };
}
