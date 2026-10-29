import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { makeSettings } from '@/../test/fixtures';
import type { UserSettings } from '@/features/settings/domain/user-settings';
import { LocalizationProvider, useLocalization } from './localization-provider';

let mockSettings: UserSettings | null = null;
const mockListeners = new Set<() => void>();
jest.mock('@/core/composition/application', () => ({
  application: {
    settings: {
      snapshot: () => mockSettings,
      subscribe: (listener: () => void) => {
        mockListeners.add(listener);
        return () => mockListeners.delete(listener);
      },
    },
  },
}));

function Language() {
  return <Text>{useLocalization().language}</Text>;
}

test('Persian stays visible while account storage switches and changes only when settings change', () => {
  mockSettings = makeSettings({ language: 'fa' as UserSettings['language'] });
  render(
    <LocalizationProvider>
      <Language />
    </LocalizationProvider>,
  );
  expect(screen.getByText('fa')).toBeTruthy();
  act(() => {
    mockSettings = null;
    mockListeners.forEach((listener) => listener());
  });
  expect(screen.getByText('fa')).toBeTruthy();
  expect(screen.queryByText('en')).toBeNull();
  act(() => {
    mockSettings = makeSettings();
    mockListeners.forEach((listener) => listener());
  });
  expect(screen.getByText('en')).toBeTruthy();
});
