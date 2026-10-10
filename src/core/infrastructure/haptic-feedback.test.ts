import { createHapticFeedbackService } from './haptic-feedback';

test('enabled semantic events reach the adapter, disabled events never do', async () => {
  let enabled = true;
  const perform = jest.fn(async () => {});
  const haptics = createHapticFeedbackService(async () => enabled, perform);
  await haptics.cardReveal();
  await haptics.answerSuccess();
  await haptics.answerFailure();
  await haptics.swipeCommit();
  expect(perform.mock.calls).toEqual([
    ['cardReveal'],
    ['answerSuccess'],
    ['answerFailure'],
    ['swipeCommit'],
  ]);
  enabled = false;
  await haptics.selection();
  await haptics.answerSuccess();
  expect(perform).toHaveBeenCalledTimes(4);
});

test('native failure or missing settings never breaks an interaction and warns once', async () => {
  const report = jest.fn();
  const haptics = createHapticFeedbackService(
    async () => true,
    async () => {
      throw new Error('haptics unavailable');
    },
    report,
  );
  await expect(haptics.selection()).resolves.toBeUndefined();
  await expect(haptics.cardReveal()).resolves.toBeUndefined();
  expect(report).toHaveBeenCalledTimes(1);
  const missingSettings = createHapticFeedbackService(async () => {
    throw new Error('settings unavailable');
  }, jest.fn());
  await expect(missingSettings.answerFailure()).resolves.toBeUndefined();
});

test('each correct answer rechecks the haptics setting and emits once only when enabled', async () => {
  let enabled = true;
  const preference = jest.fn(async () => enabled);
  const perform = jest.fn(async () => {});
  const feedback = createHapticFeedbackService(preference, perform);
  await feedback.answerSuccess();
  await feedback.answerSuccess();
  enabled = false;
  await feedback.answerSuccess();
  enabled = true;
  await feedback.answerSuccess();
  expect(preference).toHaveBeenCalledTimes(4);
  expect(perform.mock.calls).toEqual([['answerSuccess'], ['answerSuccess'], ['answerSuccess']]);
});
