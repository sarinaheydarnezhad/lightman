import { calendarDate, instant, localTime } from '@/core/domain/values';
import type { AppClock } from '@/core/ports/platform';
import { reminderPlanningDays, type NotificationService } from '@/core/ports/notification';
import {
  makeCard,
  makeDeck,
  makeRepositories,
  makeSettings,
  makeState,
  sequenceIds,
  timestamp,
} from '@/../test/fixtures';
import { createStudyReminderPlan } from './create-study-reminder-plan';
import { createApplication } from './create-application';

const clock: AppClock = {
  now: () => new Date(2026, 8, 24, 8, 0),
  timeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
};

test('empty storage produces no reminders', async () => {
  expect(await createStudyReminderPlan(makeRepositories(), clock, localTime('09:00'))).toEqual([]);
});

test('counts due cards for each reminder date and excludes deleted cards and decks', async () => {
  const repositories = makeRepositories();
  await repositories.decks.create(makeDeck());
  await repositories.decks.create(makeDeck({ id: 'deleted-deck' }));
  for (const [id, deckId, deleted, dueDate] of [
    ['due', 'deck-1', false, '2026-09-24'],
    ['future', 'deck-1', false, '2026-09-25'],
    ['deleted-card', 'deck-1', true, '2026-09-24'],
    ['hidden', 'deleted-deck', false, '2026-09-24'],
  ] as const) {
    await repositories.cards.create(makeCard({ id, deckId }));
    if (deleted) await repositories.cards.archive(id, timestamp);
    await repositories.reviews.saveState(makeState({ cardId: id, dueDate: calendarDate(dueDate) }));
  }
  await repositories.decks.archive('deleted-deck', timestamp);
  const reminders = await createStudyReminderPlan(repositories, clock, localTime('09:00'));
  expect(reminders).toHaveLength(reminderPlanningDays);
  expect(reminders[0]).toEqual({
    scheduledForUtc: new Date(2026, 8, 24, 9).toISOString(),
    dueCount: 1,
  });
  expect(reminders[1]?.dueCount).toBe(2);
  expect(reminders.every((item) => item.dueCount > 0)).toBe(true);
});

test('skips empty dates until a card becomes due and uses tomorrow if the time already passed', async () => {
  const repositories = makeRepositories();
  await repositories.decks.create(makeDeck());
  await repositories.cards.create(makeCard());
  await repositories.reviews.saveState(makeState({ dueDate: calendarDate('2026-09-26') }));
  const reminders = await createStudyReminderPlan(repositories, clock, localTime('07:00'));
  expect(reminders[0]).toEqual({
    scheduledForUtc: new Date(2026, 8, 26, 7).toISOString(),
    dueCount: 1,
  });
  expect(reminders).toHaveLength(reminderPlanningDays - 1);
});

test('uses scheduler due rules and recalculates after review progress changes', async () => {
  const repositories = makeRepositories();
  await repositories.decks.create(makeDeck());
  await repositories.cards.create(makeCard());
  await repositories.reviews.saveState(
    makeState({ updatedAt: instant('2026-09-23T00:00:00.000Z') }),
  );
  expect(
    (await createStudyReminderPlan(repositories, clock, localTime('09:00')))[0]?.dueCount,
  ).toBe(1);
  const app = createApplication(repositories, clock, sequenceIds());
  await app.reviewCard({
    cardId: 'card-1',
    deckId: 'deck-1',
    result: 'success',
    studySessionId: null,
  });
  const reminders = await createStudyReminderPlan(repositories, clock, localTime('09:00'));
  expect(reminders[0]!.scheduledForUtc > new Date(2026, 8, 24, 9).toISOString()).toBe(true);
  await repositories.cards.archive('card-1', timestamp);
  expect(await createStudyReminderPlan(repositories, clock, localTime('09:00'))).toEqual([]);
});

test('missing review state fails instead of inventing a count', async () => {
  const repositories = makeRepositories();
  await repositories.decks.create(makeDeck());
  await repositories.cards.create(makeCard());
  await expect(
    createStudyReminderPlan(repositories, clock, localTime('09:00')),
  ).rejects.toMatchObject({ code: 'persistence' });
});

test('enabling an empty reminder preserves the preference; another scope never contributes cards', async () => {
  const repositories = makeRepositories();
  const other = makeRepositories();
  await repositories.settings.update(makeSettings());
  await other.decks.create(makeDeck());
  await other.cards.create(makeCard());
  await other.reviews.saveState(makeState());
  const notifications: NotificationService = {
    getPermissionStatus: async () => 'authorized',
    requestPermission: async () => 'authorized',
    getScheduledReminder: async () => null,
    scheduleDailyReminder: jest.fn().mockResolvedValue(undefined),
    cancelDailyReminder: jest.fn().mockResolvedValue(undefined),
    openSystemSettings: async () => {},
    subscribeToReminderTaps: () => () => {},
    consumeLastReminderTap: () => false,
  };
  const app = createApplication(repositories, clock, sequenceIds(), notifications);
  await app.settings.setReminderEnabled(true);
  expect(notifications.scheduleDailyReminder).toHaveBeenLastCalledWith('09:30', 'en', []);
  expect((await repositories.settings.get())?.dailyReminderEnabled).toBe(true);
  await repositories.decks.create(makeDeck());
  await repositories.cards.create(makeCard());
  await repositories.reviews.saveState(makeState());
  await app.settings.reconcileReminder();
  expect(notifications.scheduleDailyReminder).toHaveBeenLastCalledWith(
    '09:30',
    'en',
    expect.arrayContaining([expect.objectContaining({ dueCount: 1 })]),
  );
});
