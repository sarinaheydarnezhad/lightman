import { AppError } from '@/core/errors/app-error';
import { languageTag } from '@/core/domain/values';
import { makeSettings } from '@/../test/fixtures';
import { validateUserSettings } from './user-settings';

test('settings accept all themes and a valid optional reminder', () => {
  for (const theme of ['light', 'dark'] as const) {
    expect(validateUserSettings(makeSettings({ theme, dailyReminderEnabled: true })).theme).toBe(
      theme,
    );
  }
});

test.each([
  ['system', 'light'],
  ['oled', 'dark'],
] as const)(
  'legacy saved theme %s loads as %s without breaking other preferences',
  (legacy, expected) => {
    const settings = makeSettings({ theme: legacy as never, hapticsEnabled: false });
    expect(validateUserSettings(settings)).toEqual({ ...settings, theme: expected });
  },
);

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
  expect(() =>
    validateUserSettings(
      makeSettings({ preferredSpeechLanguage: languageTag('fa'), preferredSpeechAccent: 'uk' }),
    ),
  ).toThrow(AppError);
});
