import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { makeSettings } from '@/../test/fixtures';
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

function expectControls(language: UiLanguage, enabled: boolean) {
  const direction = resolveDirection(language);
  const buttons = screen.getAllByRole('button');
  expect(buttons).toHaveLength(enabled ? 6 : 5);
  for (const button of buttons) {
    const classes = button.props.className.split(' ');
    expect(classes).toContain('w-full');
    expect(classes).toContain('justify-between');
    expect(classes).toContain(direction === 'rtl' ? 'flex-row-reverse' : 'flex-row');
    expect(classes).not.toContain(direction === 'rtl' ? 'flex-row' : 'flex-row-reverse');
    expect(
      within(button).UNSAFE_getAllByType(direction === 'rtl' ? ChevronLeft : ChevronRight),
    ).toHaveLength(1);
    expect(
      within(button).UNSAFE_queryByType(direction === 'rtl' ? ChevronRight : ChevronLeft),
    ).toBeNull();
  }
  const toggles = screen.getAllByRole('switch');
  expect(toggles).toHaveLength(1);
  for (const toggle of toggles) {
    const classes = toggle.props.className.split(' ');
    expect(classes).toContain('w-full');
    expect(classes).toContain('justify-between');
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
    'settings.reminderHint',
    'settings.pronunciation',
    'settings.pronunciationHint',
  ] as const) {
    expect(screen.getByText(translate(language, key))).toHaveStyle({
      textAlign: direction === 'rtl' ? 'right' : 'left',
      writingDirection: direction,
    });
  }
  expect(
    screen.queryByRole('header', { name: translate(language, 'settings.interaction') }),
  ).toBeNull();
  expect(
    screen.queryByRole('switch', { name: translate(language, 'settings.haptics') }),
  ).toBeNull();
  expect(screen.queryByText(translate(language, 'settings.hapticsHint'))).toBeNull();
}

test.each([false, true])('settings mirror controls when toggles are %s', (enabled) => {
  const vm: ReturnType<typeof useSettingsViewModel> = {
    settings: makeSettings({ dailyReminderEnabled: enabled, hapticsEnabled: enabled }),
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
    setReminderTime: jest.fn(),
    setSpeechLanguage: jest.fn(),
    setSpeechAccent: jest.fn(),
    openNotificationSettings: jest.fn(),
  };
  jest.mocked(useSettingsViewModel).mockReturnValue(vm);
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
