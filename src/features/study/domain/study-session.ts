import {
  calendarDate,
  durationInMilliseconds,
  instant,
  requiredId,
  type CalendarDate,
  type Instant,
} from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';
import { leitnerBox, type LeitnerBox } from './review';

export type StudyScope =
  { readonly kind: 'all-decks' } | { readonly kind: 'specific-deck'; readonly deckId: string };
export type StudySessionStatus = 'not-started' | 'in-progress' | 'completed' | 'cancelled';
export type StudyPresentationKind = 'initial' | 'retry';

export interface StudyQueueItem {
  readonly cardId: string;
  readonly deckId: string;
  readonly dueDate: CalendarDate;
  readonly box: LeitnerBox;
}

export interface StudySession {
  readonly id: string;
  readonly scope: StudyScope;
  readonly status: StudySessionStatus;
  readonly startedAt: Instant | null;
  readonly completedAt: Instant | null;
  readonly cancelledAt: Instant | null;
  /** Fixed at start. Reviews never rebuild the initial queue. */
  readonly initialQueue: readonly StudyQueueItem[];
  /** Initial failures, in first-failure order, appear at most once each. */
  readonly retryQueue: readonly StudyQueueItem[];
  /** Answered presentations; also the zero-based current position. */
  readonly currentIndex: number;
  readonly retrySuccesses: number;
}

export function validateStudyScope(scope: StudyScope): StudyScope {
  if (scope?.kind === 'all-decks') return { kind: 'all-decks' };
  if (scope?.kind === 'specific-deck')
    return { kind: 'specific-deck', deckId: requiredId(scope.deckId, 'Deck ID') };
  throw new AppError('validation', 'Invalid study scope.');
}

export function validateStudyQueueItem(item: StudyQueueItem): StudyQueueItem {
  requiredId(item.cardId, 'Card ID');
  requiredId(item.deckId, 'Deck ID');
  calendarDate(item.dueDate);
  leitnerBox(item.box);
  return { cardId: item.cardId, deckId: item.deckId, dueDate: item.dueDate, box: item.box };
}

export function validateStudySession(session: StudySession): StudySession {
  requiredId(session.id, 'Study session ID');
  const scope = validateStudyScope(session.scope);
  if (!['not-started', 'in-progress', 'completed', 'cancelled'].includes(session.status))
    throw new AppError('validation', 'Invalid study session status.');
  if (session.startedAt !== null) instant(session.startedAt);
  if (session.completedAt !== null) instant(session.completedAt);
  if (session.cancelledAt !== null) instant(session.cancelledAt);
  if (session.status === 'not-started') {
    if (session.startedAt !== null || session.completedAt !== null || session.cancelledAt !== null)
      throw new AppError('validation', 'Unstarted session cannot have timestamps.');
  } else if (session.startedAt === null)
    throw new AppError('validation', 'Study start time is required.');
  if (session.completedAt !== null && session.startedAt !== null)
    durationInMilliseconds(session.startedAt, session.completedAt);
  if (session.cancelledAt !== null && session.startedAt !== null)
    durationInMilliseconds(session.startedAt, session.cancelledAt);
  if (!Array.isArray(session.initialQueue) || !Array.isArray(session.retryQueue))
    throw new AppError('validation', 'Invalid study queue.');
  const initialQueue = session.initialQueue.map(validateStudyQueueItem);
  const retryQueue = session.retryQueue.map(validateStudyQueueItem);
  const initialIds = new Set(initialQueue.map((item) => item.cardId));
  const initialById = new Map(initialQueue.map((item) => [item.cardId, item]));
  const retryIds = new Set(retryQueue.map((item) => item.cardId));
  if (
    initialIds.size !== initialQueue.length ||
    retryIds.size !== retryQueue.length ||
    retryQueue.some((item) => {
      const initial = initialById.get(item.cardId);
      return (
        !initial ||
        item.deckId !== initial.deckId ||
        item.dueDate !== initial.dueDate ||
        item.box !== initial.box
      );
    }) ||
    (scope.kind === 'specific-deck' && initialQueue.some((item) => item.deckId !== scope.deckId))
  )
    throw new AppError('validation', 'Duplicate or unknown study card.');
  const total = initialQueue.length + retryQueue.length;
  if (
    !Number.isSafeInteger(session.currentIndex) ||
    session.currentIndex < 0 ||
    session.currentIndex > total ||
    retryQueue.length > Math.min(session.currentIndex, initialQueue.length)
  )
    throw new AppError('validation', 'Invalid study position.');
  const answeredRetries = Math.max(0, session.currentIndex - initialQueue.length);
  if (
    !Number.isSafeInteger(session.retrySuccesses) ||
    session.retrySuccesses < 0 ||
    session.retrySuccesses > answeredRetries
  )
    throw new AppError('validation', 'Invalid study retry count.');
  if (
    session.status === 'in-progress' &&
    (session.currentIndex >= total || session.completedAt || session.cancelledAt)
  )
    throw new AppError('validation', 'Active study session has no current card.');
  if (
    session.status === 'completed' &&
    (session.currentIndex !== total || !session.completedAt || session.cancelledAt)
  )
    throw new AppError('validation', 'Completed study session has inconsistent progress.');
  if (session.status === 'cancelled' && (!session.cancelledAt || session.completedAt))
    throw new AppError('validation', 'Cancelled study session requires a cancellation time.');
  if (session.status === 'not-started' && session.currentIndex !== 0)
    throw new AppError('validation', 'Unstarted session cannot have progress.');
  return { ...session, scope, initialQueue, retryQueue };
}
