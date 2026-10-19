import { calendarDateAtInstant, instant, localTime, type LocalTime } from '@/core/domain/values';
import { AppError } from '@/core/errors/app-error';
import type { AppClock } from '@/core/ports/platform';
import type { Repositories } from '@/core/ports/repositories';
import { reminderPlanningDays, type StudyReminder } from '@/core/ports/notification';
import { createReviewEngine } from '@/features/study/domain/review-engine-impl';

export async function createStudyReminderPlan(
  repositories: Repositories,
  clock: AppClock,
  time: LocalTime,
): Promise<StudyReminder[]> {
  localTime(time);
  const decks = (await repositories.decks.list()).filter((deck) => !deck.archivedAt);
  const groups = await Promise.all(
    decks.map(async (deck) => {
      const cards = (await repositories.cards.listByDeck(deck.id)).filter(
        (card) => !card.archivedAt,
      );
      const cardIds = new Set(cards.map((card) => card.id));
      const states = await repositories.reviews.listStates(cards.map((card) => card.id));
      if (
        states.length !== cards.length ||
        new Set(states.map((state) => state.cardId)).size !== cards.length ||
        states.some((state) => !cardIds.has(state.cardId))
      )
        throw new AppError('persistence', 'Unable to determine the number of due cards.');
      return { deck, states };
    }),
  );
  const engine = createReviewEngine();
  const current = clock.now();
  const [hour, minute] = time.split(':').map(Number);
  const next = new Date(current);
  next.setHours(hour!, minute!, 0, 0);
  if (next <= current) next.setDate(next.getDate() + 1);
  const reminders: StudyReminder[] = [];
  for (let offset = 0; offset < reminderPlanningDays; offset++) {
    const date = new Date(next);
    date.setDate(next.getDate() + offset);
    const targetDate = calendarDateAtInstant(instant(date.toISOString()), clock.timeZone());
    const dueCount = groups.reduce(
      (count, { deck, states }) =>
        count + engine.getDueStates(states, targetDate, deck.reviewSystem).length,
      0,
    );
    if (dueCount > 0) reminders.push({ scheduledForUtc: date.toISOString(), dueCount });
  }
  return reminders;
}
