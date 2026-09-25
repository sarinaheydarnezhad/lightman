import { createApplication } from '@/core/application/create-application';
import { fixedClock, makeRepositories, sequenceIds } from '@/../test/fixtures';
import { createReminderTapHandler } from './create-reminder-tap-handler';

test('a reminder tap enters the current all-decks queue and shows the normal empty study state', async () => {
  const app = createApplication(makeRepositories(), fixedClock, sequenceIds());
  const open = jest.fn();
  await createReminderTapHandler(app, open, jest.fn())();
  expect(open).toHaveBeenCalledWith(
    expect.objectContaining({
      scope: { kind: 'all-decks' },
      status: 'completed',
      initialQueue: [],
    }),
  );
  expect(await app.getActiveStudySession()).toBeNull();
});

test('tapping while a study session is active resumes it instead of creating another', async () => {
  const current = { id: 'already-started' } as never;
  const app = {
    getActiveStudySession: jest.fn().mockResolvedValue(current),
    startStudySession: jest.fn(),
  };
  const open = jest.fn();
  await createReminderTapHandler(app, open, jest.fn())();
  expect(open).toHaveBeenCalledWith(current);
  expect(app.startStudySession).not.toHaveBeenCalled();
});

test('a study loading failure falls back to the Study entry screen', async () => {
  const app = {
    getActiveStudySession: jest.fn().mockRejectedValue(new Error('storage error')),
    startStudySession: jest.fn(),
  };
  const fallback = jest.fn();
  await createReminderTapHandler(app, jest.fn(), fallback)();
  expect(fallback).toHaveBeenCalledTimes(1);
});
