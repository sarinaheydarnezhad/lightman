import type { CalendarDate, Instant } from '@/core/domain/values';
import type { CardReviewState, ReviewEvent, ReviewResult } from './review';

export interface SchedulerLabel {
  readonly label: string;
  readonly localizedLabels?: Readonly<Record<string, string>>;
}

export interface SchedulerDistribution extends SchedulerLabel {
  readonly key: string;
  readonly label: string;
  readonly count: number;
}

export interface SchedulerDistributionGroup extends SchedulerLabel {
  readonly schedulerId: string;
  readonly label: string;
  readonly sections: readonly SchedulerDistribution[];
}

export interface SchedulerReviewStatus extends SchedulerLabel {
  readonly key: string;
  readonly label: string;
}

export interface SchedulerTransition {
  readonly previousState: string;
  readonly newState: string;
  readonly result: ReviewResult;
  readonly intervalDays: number;
  readonly previousDueDate: CalendarDate;
  readonly newDueDate: CalendarDate;
  readonly updatedReviewState: CardReviewState;
}

export interface Scheduler extends SchedulerLabel {
  readonly id: string;
  readonly label: string;
  createInitialState(cardId: string, reviewDate: CalendarDate, createdAt: Instant): CardReviewState;
  processReview(
    current: CardReviewState,
    result: ReviewResult,
    reviewDate: CalendarDate,
    reviewedAt: Instant,
  ): SchedulerTransition;
  getDueStates(states: readonly CardReviewState[], targetDate: CalendarDate): CardReviewState[];
  getReviewStatus(state: CardReviewState): SchedulerReviewStatus;
  getQueuePriority(state: CardReviewState): number;
  getDistribution(states: readonly CardReviewState[]): readonly SchedulerDistribution[];
  createReviewEvent(
    transition: SchedulerTransition,
    input: Pick<ReviewEvent, 'id' | 'cardId' | 'deckId' | 'reviewedAt' | 'studySessionId'>,
  ): ReviewEvent;
}

export interface ReviewEngine {
  getScheduler(id?: string): Scheduler;
  createInitialState(
    cardId: string,
    reviewDate: CalendarDate,
    createdAt: Instant,
    schedulerId?: string,
  ): CardReviewState;
  processReview(
    current: CardReviewState,
    result: ReviewResult,
    reviewDate: CalendarDate,
    reviewedAt: Instant,
    schedulerId?: string,
  ): SchedulerTransition;
  createReviewEvent(
    transition: SchedulerTransition,
    input: Pick<ReviewEvent, 'id' | 'cardId' | 'deckId' | 'reviewedAt' | 'studySessionId'>,
    schedulerId?: string,
  ): ReviewEvent;
  getDueStates(
    states: readonly CardReviewState[],
    targetDate: CalendarDate,
    schedulerId?: string,
  ): CardReviewState[];
  getReviewStatus(state: CardReviewState, schedulerId?: string): SchedulerReviewStatus;
  getQueuePriority(state: CardReviewState, schedulerId?: string): number;
  listSchedulers(): readonly Scheduler[];
  getDistribution(
    groups: readonly {
      readonly schedulerId?: string;
      readonly states: readonly CardReviewState[];
    }[],
  ): readonly SchedulerDistributionGroup[];
}
