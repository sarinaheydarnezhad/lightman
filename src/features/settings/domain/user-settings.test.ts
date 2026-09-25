import { AppError } from '@/core/errors/app-error';
import { makeSettings } from '@/../test/fixtures';
import { validateUserSettings } from './user-settings';

test('settings accept all themes and a valid optional reminder', () => {
  for (const theme of ['system', 'light', 'dark', 'oled'] as const) {
    expect(validateUserSettings(makeSettings({ theme, dailyReminderEnabled: true })).theme).toBe(
      theme,
    );
  }
});

test('settings reject invalid theme, language and local time', () => {
  expect(() => validateUserSettings(makeSettings({ hapticsEnabled: 'yes' as never }))).toThrow(
    AppError,
  );
  expect(() =>
    validateUserSettings(makeSettings({ preferredSpeechAccent: 'au' as never })),
  ).toThrow(AppError);
  expect(() => validateUserSettings(makeSettings({ theme: 'blue' as never }))).toThrow(AppError);
  expect(() => validateUserSettings(makeSettings({ language: '??' as never }))).toThrow(AppError);
  expect(() => validateUserSettings(makeSettings({ dailyReminderTime: '25:00' as never }))).toThrow(
    AppError,
  );
  expect(() =>
    validateUserSettings(makeSettings({ dailyReminderEnabled: true, dailyReminderTime: null })),
  ).toThrow(AppError);
});
