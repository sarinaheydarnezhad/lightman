import {
  addCalendarDays,
  calendarDate,
  localCalendarDateConverter,
  type CalendarDate,
  type Instant,
} from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';
import {
  validateReviewState,
  type CardReviewState,
  type LeitnerBox,
  type ReviewEvent,
} from '@/features/study/domain/review';
import type { StudyScope } from '@/features/study/domain/study-session';

export type AnalyticsWindow = 7 | 30 | 90;
export type AnalyticsScope = StudyScope;
export interface AnalyticsRange {
  readonly from: CalendarDate;
  readonly to: CalendarDate;
}
export interface DailyReviewActivity {
  readonly date: CalendarDate;
  readonly reviewCount: number;
  readonly uniqueCardsReviewed: number;
  readonly successfulReviews: number;
  readonly failedReviews: number;
}
export type BoxDistribution = Readonly<Record<LeitnerBox, number>>;
export interface StudySummary {
  readonly range: AnalyticsRange;
  readonly today: CalendarDate;
  readonly hasHistory: boolean;
  readonly currentStreak: number;
  readonly bestStreak: number;
  readonly cardsReviewedToday: number;
  readonly totalReviews: number;
  readonly retentionRate: number | null;
  readonly activeStudyDays: number;
  readonly dailyActivity: readonly DailyReviewActivity[];
  readonly activeCardCount: number;
  readonly boxDistribution: BoxDistribution;
}

export function analyticsWindow(today: CalendarDate, days: AnalyticsWindow): AnalyticsRange {
  calendarDate(today);
  return { from: addCalendarDays(today, 1 - days), to: today };
}

export function validateAnalyticsRange(range: AnalyticsRange): AnalyticsRange {
  calendarDate(range.from);
  calendarDate(range.to);
  if (range.from > range.to || range.to > addCalendarDays(range.from, 365))
    throw new AppError('validation', 'Analytics range must contain 1–366 calendar days.');
  return range;
}

export function getBoxDistribution(states: readonly CardReviewState[]): BoxDistribution {
  const counts: Record<LeitnerBox, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const state of states) counts[validateReviewState(state).box]++;
  return counts;
}

interface HistoryTotals {
  readonly currentStreak: number;
  readonly bestStreak: number;
  readonly cardsReviewedToday: number;
  readonly dailyActivity: readonly DailyReviewActivity[];
  readonly hasHistory: boolean;
}

export function getCurrentStreak(
  studyDays: ReadonlySet<CalendarDate>,
  today: CalendarDate,
): number {
  let count = 0;
  let cursor = today;
  while (studyDays.has(cursor)) {
    count++;
    cursor = addCalendarDays(cursor, -1);
  }
  return count;
}

export function getBestStreak(studyDays: ReadonlySet<CalendarDate>): number {
  let best = 0;
  let run = 0;
  let previous: CalendarDate | null = null;
  for (const day of [...studyDays].sort()) {
    run = previous !== null && addCalendarDays(previous, 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }
  return best;
}

export function getRetentionRate(successes: number, total: number): number | null {
  return total ? (successes / total) * 100 : null;
}

/** One pass over historical events; state distribution is calculated separately. */
export function getDailyActivity(
  events: readonly ReviewEvent[],
  range: AnalyticsRange,
  today: CalendarDate,
  currentInstant: Instant,
  timeZone: string,
): HistoryTotals {
  validateAnalyticsRange(range);
  const toLocalDay = localCalendarDateConverter(timeZone);
  const studyDays = new Set<CalendarDate>();
  const todayCards = new Set<string>();
  const buckets = new Map<
    CalendarDate,
    { reviews: number; successes: number; cards: Set<string> }
  >();
  for (const event of events) {
    if (event.reviewedAt > currentInstant) continue;
    const day = toLocalDay(event.reviewedAt);
    if (day > today) continue;
    studyDays.add(day);
    if (day === today) todayCards.add(event.cardId);
    if (day < range.from || day > range.to) continue;
    let bucket = buckets.get(day);
    if (!bucket) {
      bucket = { reviews: 0, successes: 0, cards: new Set() };
      buckets.set(day, bucket);
    }
    bucket.reviews++;
    if (event.result === 'success') bucket.successes++;
    bucket.cards.add(event.cardId);
  }
  const dailyActivity: DailyReviewActivity[] = [];
  for (let day = range.from; day <= range.to; day = addCalendarDays(day, 1)) {
    const bucket = buckets.get(day);
    dailyActivity.push({
      date: day,
      reviewCount: bucket?.reviews ?? 0,
      uniqueCardsReviewed: bucket?.cards.size ?? 0,
      successfulReviews: bucket?.successes ?? 0,
      failedReviews: bucket ? bucket.reviews - bucket.successes : 0,
    });
  }
  return {
    dailyActivity,
    currentStreak: getCurrentStreak(studyDays, today),
    bestStreak: getBestStreak(studyDays),
    cardsReviewedToday: todayCards.size,
    hasHistory: studyDays.size > 0,
  };
}

export function getStudySummary(
  events: readonly ReviewEvent[],
  activeStates: readonly CardReviewState[],
  range: AnalyticsRange,
  today: CalendarDate,
  currentInstant: Instant,
  timeZone: string,
): StudySummary {
  const history = getDailyActivity(events, range, today, currentInstant, timeZone);
  const totalReviews = history.dailyActivity.reduce((total, day) => total + day.reviewCount, 0);
  const successfulReviews = history.dailyActivity.reduce(
    (total, day) => total + day.successfulReviews,
    0,
  );
  return {
    range,
    today,
    ...history,
    totalReviews,
    retentionRate: getRetentionRate(successfulReviews, totalReviews),
    activeStudyDays: history.dailyActivity.filter((day) => day.reviewCount > 0).length,
    activeCardCount: activeStates.length,
    boxDistribution: getBoxDistribution(activeStates),
  };
}
