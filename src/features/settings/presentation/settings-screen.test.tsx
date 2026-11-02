import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Platform, Text as NativeText, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { makeSettings } from '@/../test/fixtures';
import { config } from '@/core/infrastructure/platform';
import { useLocalization } from '@/shared/localization/localization-provider';
import {
  formatNumber,
  resolveDirection,
  translate,
  type UiLanguage,
} from '@/shared/localization/localization';
import { SettingsScreen } from './settings-screen';
import { useSettingsViewModel } from './use-settings-view-model';

jest.mock('expo-router', () => ({
  Link: 'Link',
  router: { push: jest.fn() },
  useFocusEffect: jest.fn(),
}));

jest.mock('@/core/composition/application', () => ({ application: {} }));
jest.mock('@/shared/localization/localization-provider', () => ({ useLocalization: jest.fn() }));
jest.mock('./use-settings-view-model', () => ({ useSettingsViewModel: jest.fn() }));

function setLanguage(language: UiLanguage) {
  jest.mocked(useLocalization).mockReturnValue({
    language,
    direction: resolveDirection(language),
    t: (key, values) => translate(language, key, values),
    number: (value) => formatNumber(value, language),
  });
}

function settingsScreen() {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      }}
    >
      <SettingsScreen />
    </SafeAreaProvider>
  );
}

function mockSettings(overrides: Partial<ReturnType<typeof useSettingsViewModel>> = {}) {
  const vm: ReturnType<typeof useSettingsViewModel> = {
    settings: makeSettings(),
    loading: false,
    loadError: false,
    busy: {},
    errors: {},
    reminderPermission: 'authorized',
    reload: jest.fn(),
    refreshReminder: jest.fn(async () => {}),
    setTheme: jest.fn(),
    setLanguage: jest.fn(),
    setHaptics: jest.fn(),
    setReminder: jest.fn(),
    setReminderTime: jest.fn().mockResolvedValue(true),
    setSpeechLanguage: jest.fn(),
    setSpeechAccent: jest.fn(),
    openNotificationSettings: jest.fn(),
    ...overrides,
  };
  jest.mocked(useSettingsViewModel).mockReturnValue(vm);
  return vm;
}

function expectControls(language: UiLanguage, enabled: boolean) {
  const direction = resolveDirection(language);
  expect(screen.getAllByRole('header').slice(0, 2)).toEqual([
    screen.getByRole('header', { name: translate(language, 'nav.settings') }),
    screen.getByRole('header', { name: translate(language, 'settings.appearance') }),
  ]);
  expect(
    screen.getByRole('button', { name: translate(language, 'account.loginSignup') }),
  ).toBeTruthy();
  expect(
    screen.getByRole('button', { name: translate(language, 'subscription.title') }),
  ).toBeTruthy();
  const buttons = screen
    .getAllByRole('button')
    .filter(
      (button) =>
        ![
          translate(language, 'account.loginSignup'),
          translate(language, 'subscription.title'),
        ].includes(button.props.accessibilityLabel),
    );
  expect(buttons).toHaveLength(enabled ? 6 : 5);
  for (const button of buttons) {
    const classes = button.props.className.split(' ');
    expect(classes).toContain('w-full');
    expect(classes).toContain('justify-between');
    expect(classes).toContain('py-lg');
    expect(classes).toContain(direction === 'rtl' ? 'flex-row-reverse' : 'flex-row');
    expect(classes).not.toContain(direction === 'rtl' ? 'flex-row' : 'flex-row-reverse');
    expect(
      within(button).UNSAFE_getAllByType(direction === 'rtl' ? ChevronLeft : ChevronRight),
    ).toHaveLength(1);
    expect(
      within(button).UNSAFE_queryByType(direction === 'rtl' ? ChevronRight : ChevronLeft),
    ).toBeNull();
  }
  for (const key of [
    'settings.app',
    'settings.version',
    ...(config.buildNumber ? (['settings.build'] as const) : []),
    'settings.yourData',
  ] as const) {
    const row = screen
      .UNSAFE_getAllByType(View)
      .find(
        (view) =>
          view.props.className?.split(' ').includes('border-b') &&
          within(view).queryByText(translate(language, key)),
      );
    expect(row).toBeDefined();
    const classes = row!.props.className.split(' ');
    expect(classes).toContain('flex-row');
    expect(classes).toContain('items-center');
    expect(classes).toContain('py-lg');
    expect(classes).toContain('min-h-listItem');
  }
  const toggles = screen.getAllByRole('switch');
  expect(toggles).toHaveLength(1);
  for (const toggle of toggles) {
    const classes = toggle.props.className.split(' ');
    expect(classes).toContain('w-full');
    expect(classes).toContain('justify-between');
    expect(classes).toContain('py-lg');
    expect(classes).toContain(direction === 'rtl' ? 'flex-row-reverse' : 'flex-row');
    expect(classes).not.toContain(direction === 'rtl' ? 'flex-row' : 'flex-row-reverse');
    expect(toggle.props.accessibilityState.checked).toBe(enabled);
    expect(
      within(toggle).getByText(translate(language, enabled ? 'common.on' : 'common.off')),
    ).toBeTruthy();
  }
  for (const key of [
    'settings.theme',
    'settings.dailyReminder',
    'settings.pronunciation',
    'settings.pronunciationHint',
  ] as const) {
    expect(screen.getByText(translate(language, key))).toHaveStyle({
      textAlign: direction === 'rtl' ? 'right' : 'left',
      writingDirection: direction,
    });
  }
  expect(screen.queryByText(translate(language, 'settings.reminderHint'))).toBeNull();
  const permission = translate(language, 'settings.permission', {
    value: translate(language, 'settings.permission.authorized'),
  });
  const labels = screen.UNSAFE_getAllByType(NativeText).map((text) => text.props.children);
  expect(labels.indexOf(permission)).toBeGreaterThan(
    labels.indexOf(translate(language, 'settings.dailyReminder')),
  );
  expect(
    screen.queryByRole('header', { name: translate(language, 'settings.interaction') }),
  ).toBeNull();
  expect(
    screen.queryByRole('switch', { name: translate(language, 'settings.haptics') }),
  ).toBeNull();
  expect(screen.queryByText(translate(language, 'settings.hapticsHint'))).toBeNull();
}

test.each([false, true])('settings mirror controls when toggles are %s', (enabled) => {
  const vm = mockSettings({
    settings: makeSettings({ dailyReminderEnabled: enabled, hapticsEnabled: enabled }),
  });
  setLanguage('en');
  const { rerender } = render(settingsScreen());
  expectControls('en', enabled);

  setLanguage('fa');
  rerender(settingsScreen());
  expectControls('fa', enabled);
  fireEvent.press(screen.getByRole('switch', { name: translate('fa', 'settings.dailyReminder') }));
  expect(vm.setReminder).toHaveBeenCalledWith(!enabled);
  expect(vm.setHaptics).not.toHaveBeenCalled();
  expect(vm.settings?.hapticsEnabled).toBe(enabled);
  fireEvent.press(screen.getByText(translate('fa', 'settings.theme')));
  expect(router.push).toHaveBeenCalledWith('/settings/appearance');

  setLanguage('en');
  rerender(settingsScreen());
  expectControls('en', enabled);
});

test.each([
  ['android', 'en', '18:45', '18:45'],
  ['ios', 'en', '00:00', '00:00'],
  ['web', 'en', '23:59', '23:59'],
  ['android', 'fa', '۱۸:۴۵', '18:45'],
  ['ios', 'fa', '٠٨:١٥', '08:15'],
  ['web', 'fa', ' 12:30 ', '12:30'],
] as const)(
  'reminder time uses typed entry on %s in %s (%s)',
  async (platform, language, typed, saved) => {
    const nativePlatform = jest.replaceProperty(Platform, 'OS', platform);
    try {
      setLanguage(language);
      const vm = mockSettings({ settings: makeSettings({ dailyReminderEnabled: true }) });
      render(settingsScreen());
      fireEvent.press(screen.getByText(translate(language, 'settings.reminderTime')));
      const input = screen.getByLabelText(translate(language, 'settings.reminderTime'));
      expect(input.props.value).toBe('09:30');
      expect(input.props.editable).toBe(true);
      fireEvent.changeText(input, typed);
      fireEvent.press(
        screen.getByRole('button', { name: translate(language, 'settings.saveTime') }),
      );
      await waitFor(() => expect(vm.setReminderTime).toHaveBeenCalledWith(saved));
      expect(vm.setReminderTime).toHaveBeenCalledTimes(1);
      await waitFor(() =>
        expect(screen.queryByLabelText(translate(language, 'settings.reminderTime'))).toBeNull(),
      );
    } finally {
      nativePlatform.restore();
    }
  },
);

test.each(['', '24:00', '12:60', '9:3', 'not a time'])(
  'invalid typed reminder time is not saved: %j',
  async (typed) => {
    setLanguage('en');
    const vm = mockSettings({ settings: makeSettings({ dailyReminderEnabled: true }) });
    render(settingsScreen());
    fireEvent.press(screen.getByText('Reminder time'));
    fireEvent.changeText(screen.getByLabelText('Reminder time'), typed);
    fireEvent.press(screen.getByRole('button', { name: 'Save time' }));
    expect(await screen.findByText(translate('en', 'settings.timeInvalid'))).toBeTruthy();
    expect(vm.setReminderTime).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: translate('en', 'common.close') }));
    fireEvent.changeText(screen.getByLabelText('Reminder time'), '18:45');
    expect(screen.getByLabelText('Reminder time').props.value).toBe('18:45');
    await act(async () => {
      fireEvent(screen.getByLabelText('Reminder time'), 'submitEditing');
    });
    await waitFor(() => expect(screen.queryByLabelText('Reminder time')).toBeNull());
    expect(vm.setReminderTime).toHaveBeenCalledWith('18:45');
  },
);

test('cancelling reminder time editing discards the draft', () => {
  setLanguage('en');
  const vm = mockSettings({ settings: makeSettings({ dailyReminderEnabled: true }) });
  render(settingsScreen());
  fireEvent.press(screen.getByText('Reminder time'));
  fireEvent.changeText(screen.getByLabelText('Reminder time'), '18:45');
  fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByLabelText('Reminder time')).toBeNull();
  expect(vm.setReminderTime).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Reminder time'));
  expect(screen.getByLabelText('Reminder time').props.value).toBe('09:30');
});

test('failed reminder time saves retain the typed value for retry', async () => {
  setLanguage('en');
  const vm = mockSettings({
    settings: makeSettings({ dailyReminderEnabled: true }),
    setReminderTime: jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true),
  });
  render(settingsScreen());
  fireEvent.press(screen.getByText('Reminder time'));
  fireEvent.changeText(screen.getByLabelText('Reminder time'), '18:45');
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'Save time' }));
  });
  expect(vm.setReminderTime).toHaveBeenCalledTimes(1);
  expect(screen.getByLabelText('Reminder time').props.value).toBe('18:45');
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: 'Save time' }));
  });
  await waitFor(() => expect(screen.queryByLabelText('Reminder time')).toBeNull());
  expect(vm.setReminderTime).toHaveBeenCalledTimes(2);
});
