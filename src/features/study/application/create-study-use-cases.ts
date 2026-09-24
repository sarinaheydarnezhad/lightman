import type { ReviewCardInput, ReviewCardOutput } from './review-card-contract';
import {
  calendarDate,
  calendarDateAtInstant,
  now,
  requiredId,
  type CalendarDate,
} from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';
import type { AppClock, IdGenerator } from '@/core/ports/platform';
import type { Repositories } from '@/core/ports/repositories';
import type { Deck } from '@/features/decks/domain/deck';
import { getDueReviewStates } from '../domain/leitner-srs';
import { reviewResult, type CardReviewState, type ReviewResult } from '../domain/review';
import {
  validateStudyScope,
  type StudyQueueItem,
  type StudyScope,
  type StudySession,
} from '../domain/study-session';
import {
  advanceStudySession,
  assertCurrentStudyItem,
  cancelStudySession as cancelSession,
  getCurrentStudyItem,
  getStudyProgress,
  startStudySession as createSession,
} from '../domain/study-session-workflow';

export type { CurrentStudyItem, StudyProgress } from '../domain/study-session-workflow';

interface StudyDependencies {
  readonly repositories: Repositories;
  readonly clock: AppClock;
  readonly ids: IdGenerator;
  readonly getDeck: (id: string) => Promise<Deck>;
  readonly reviewCard: (input: ReviewCardInput) => Promise<ReviewCardOutput>;
  readonly persistence: <T>(operation: () => Promise<T>) => Promise<T>;
}

export interface SubmitStudyAnswerInput {
  readonly sessionId: string;
  readonly cardId: string;
  /** Stable token for this presentation; an initial answer cannot also answer its retry. */
  readonly presentationId: string;
  readonly result: ReviewResult;
}

export function createStudyUseCases({
  repositories,
  clock,
  ids,
  getDeck,
  reviewCard,
  persistence,
}: StudyDependencies) {
  const { decks, cards, reviews, sessions } = repositories;
  const submitting = new Set<string>();

  async function getStudyQueue(input: {
    readonly scope: StudyScope;
    readonly targetDate: CalendarDate;
  }): Promise<StudyQueueItem[]> {
    const scope = validateStudyScope(input.scope);
    const targetDate = calendarDate(input.targetDate);
    const activeDecks =
      scope.kind === 'specific-deck'
        ? [await getDeck(scope.deckId)]
        : (await persistence(() => decks.list())).filter((deck) => !deck.archivedAt);
    const orderedDecks = [...activeDecks].sort((a, b) => compareIds(a.id, b.id));
    const cardLists = await Promise.all(
      orderedDecks.map((deck) => persistence(() => cards.listByDeck(deck.id))),
    );
    const deckIdByCardId = new Map<string, string>();
    for (let i = 0; i < orderedDecks.length; i++) {
      const deck = orderedDecks[i]!;
      for (const card of [...cardLists[i]!].sort((a, b) => compareIds(a.id, b.id))) {
        if (!card.archivedAt && card.deckId === deck.id && !deckIdByCardId.has(card.id))
          deckIdByCardId.set(card.id, deck.id);
      }
    }
    const states = await Promise.all(
      [...deckIdByCardId.keys()].map((cardId) => persistence(() => reviews.getState(cardId))),
    );
    const reviewStates: CardReviewState[] = states.map((state) => {
      if (!state || !deckIdByCardId.has(state.cardId))
        throw new AppError('not-found', 'Review state not found for an active card.');
      return state;
    });
    return getDueReviewStates(reviewStates, targetDate).map((state) => ({
      cardId: state.cardId,
      deckId: deckIdByCardId.get(state.cardId)!,
      dueDate: state.dueDate,
      box: state.box,
    }));
  }

  async function getStudySession(sessionId: string): Promise<StudySession> {
    requiredId(sessionId, 'Study session ID');
    const session = await persistence(() => sessions.getById(sessionId));
    if (!session) throw new AppError('not-found', 'Study session not found.');
    return session;
  }

  return {
    getStudyQueue,
    async getActiveStudySession(): Promise<StudySession | null> {
      return persistence(() => sessions.getActive());
    },
    async startStudySession(scope: StudyScope): Promise<StudySession> {
      validateStudyScope(scope);
      if (await persistence(() => sessions.getActive()))
        throw new AppError('conflict', 'Finish or cancel your current study session first.');
      const startedAt = now(clock);
      const targetDate = calendarDateAtInstant(startedAt, clock.timeZone());
      const queue = await getStudyQueue({ scope, targetDate });
      return persistence(() =>
        sessions.create(createSession(ids.create(), scope, queue, startedAt)),
      );
    },
    getStudySession,
    async getStudySnapshot(sessionId: string) {
      const session = await getStudySession(sessionId);
      return {
        session,
        currentItem: getCurrentStudyItem(session),
        progress: getStudyProgress(session),
      };
    },
    async getCurrentStudyItem(sessionId: string) {
      return getCurrentStudyItem(await getStudySession(sessionId));
    },
    async getStudyProgress(sessionId: string) {
      return getStudyProgress(await getStudySession(sessionId));
    },
    async submitStudyAnswer(input: SubmitStudyAnswerInput) {
      requiredId(input.sessionId, 'Study session ID');
      requiredId(input.cardId, 'Card ID');
      requiredId(input.presentationId, 'Presentation ID');
      reviewResult(input.result);
      if (submitting.has(input.sessionId))
        throw new AppError('conflict', 'Study answer is already being submitted.');
      submitting.add(input.sessionId);
      try {
        const session = await getStudySession(input.sessionId);
        const item = assertCurrentStudyItem(session, input.cardId, input.presentationId);
        const review = await reviewCard({
          cardId: item.cardId,
          deckId: item.deckId,
          result: input.result,
          studySessionId: session.id,
        });
        const next = advanceStudySession(
          session,
          item,
          input.result,
          review.reviewEvent.reviewedAt,
        );
        const saved = await persistence(() => sessions.update(next, session.currentIndex));
        return {
          session: saved,
          review,
          currentItem: getCurrentStudyItem(saved),
          progress: getStudyProgress(saved),
        };
      } finally {
        submitting.delete(input.sessionId);
      }
    },
    async cancelStudySession(sessionId: string): Promise<StudySession> {
      requiredId(sessionId, 'Study session ID');
      if (submitting.has(sessionId))
        throw new AppError('conflict', 'Finish submitting the current answer first.');
      const session = await getStudySession(sessionId);
      return persistence(() =>
        sessions.update(cancelSession(session, now(clock)), session.currentIndex),
      );
    },
  };
}

function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
