import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { syncEngine } from '@/core/composition/sync';
import type { AccountProfile } from '@/core/sync/cloud-client';
import { LocalizationProvider } from '@/shared/localization/localization-provider';
import { translate, type UiLanguage } from '@/shared/localization/localization';
import { AccountNameGate } from './account-name-gate';

jest.mock('@/core/composition/application', () => ({
  application: { settings: { subscribe: () => () => {}, snapshot: () => null } },
}));
jest.mock('@/core/composition/sync', () => ({
  syncEngine: {
    accountProfile: jest.fn(),
    updateAccountName: jest.fn(),
    signOut: jest.fn(),
  },
}));

const engine = syncEngine!;
const profile: AccountProfile = { id: 'owner', displayName: '', phoneNumber: null, email: null };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(engine.accountProfile).mockReset().mockResolvedValue(profile);
  jest
    .mocked(engine.updateAccountName)
    .mockReset()
    .mockImplementation(async (displayName) => ({
      ...profile,
      displayName,
    }));
  jest.mocked(engine.signOut).mockReset().mockResolvedValue({
    synchronized: false,
    serverRevoked: true,
    credentialsCleared: true,
    retryAvailable: false,
  });
});

function content(language: UiLanguage = 'en') {
  return (
    <LocalizationProvider language={language}>
      <AccountNameGate>
        <Text>Account entry</Text>
      </AccountNameGate>
    </LocalizationProvider>
  );
}

test.each(['en', 'fa'] as const)(
  'first login asks for a name in %s before account entry',
  async (language) => {
    render(content(language));
    const input = await screen.findByLabelText(translate(language, 'onboarding.nameLabel'));
    expect(screen.queryByText('Account entry')).toBeNull();
    fireEvent.changeText(input, language === 'fa' ? '  سارا  ' : '  Sara  ');
    fireEvent.press(
      screen.getByRole('button', { name: translate(language, 'onboarding.nameSave') }),
    );
    await screen.findByText('Account entry');
    expect(engine.updateAccountName).toHaveBeenCalledWith(language === 'fa' ? 'سارا' : 'Sara');
    expect(screen.queryByTestId('account-name-prompt')).toBeNull();
  },
);

test('a returning account with a saved name is not asked again', async () => {
  jest.mocked(engine.accountProfile).mockResolvedValue({ ...profile, displayName: 'Sara' });
  render(content());
  await screen.findByText('Account entry');
  expect(screen.queryByLabelText('Your name')).toBeNull();
  expect(engine.updateAccountName).not.toHaveBeenCalled();
});

test.each(['', '   ', 'a'.repeat(121)])(
  'invalid names do not advance onboarding: %j',
  async (name) => {
    render(content());
    fireEvent.changeText(await screen.findByLabelText('Your name'), name);
    fireEvent.press(screen.getByRole('button', { name: 'Save and continue' }));
    expect(screen.getByText(translate('en', 'onboarding.nameInvalid'))).toBeTruthy();
    expect(engine.updateAccountName).not.toHaveBeenCalled();
    expect(screen.queryByText('Account entry')).toBeNull();
  },
);

test('a failed save preserves the name and allows retry without completing onboarding', async () => {
  jest.mocked(engine.updateAccountName).mockRejectedValueOnce(new Error('Private backend error'));
  render(content());
  fireEvent.changeText(await screen.findByLabelText('Your name'), 'Sara');
  fireEvent.press(screen.getByRole('button', { name: 'Save and continue' }));
  await screen.findByText(translate('en', 'onboarding.nameSaveError'));
  expect(screen.queryByText('Private backend error')).toBeNull();
  expect(screen.queryByText('Account entry')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  expect(screen.getByLabelText('Your name').props.value).toBe('Sara');
  fireEvent.press(screen.getByRole('button', { name: 'Save and continue' }));
  await screen.findByText('Account entry');
});

test('profile loading errors allow retry instead of assuming a new or returning account', async () => {
  jest.mocked(engine.accountProfile).mockRejectedValueOnce(new Error('Offline'));
  render(content());
  await screen.findByText(translate('en', 'onboarding.nameLoadError'));
  expect(screen.queryByLabelText('Your name')).toBeNull();
  expect(screen.queryByText('Account entry')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByLabelText('Your name');
});

test('duplicate submissions are blocked and unmounting ignores a late save', async () => {
  let finish!: (account: AccountProfile) => void;
  jest.mocked(engine.updateAccountName).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const view = render(content());
  fireEvent.changeText(await screen.findByLabelText('Your name'), 'Sara');
  const button = screen.getByRole('button', { name: 'Save and continue' });
  fireEvent.press(button);
  fireEvent.press(button);
  expect(engine.updateAccountName).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Account entry')).toBeNull();
  view.unmount();
  await act(async () => finish({ ...profile, displayName: 'Sara' }));
});

test('a response for another account cannot complete onboarding', async () => {
  jest
    .mocked(engine.updateAccountName)
    .mockResolvedValue({ ...profile, id: 'other', displayName: 'Sara' });
  render(content());
  fireEvent.changeText(await screen.findByLabelText('Your name'), 'Sara');
  fireEvent.press(screen.getByRole('button', { name: 'Save and continue' }));
  await screen.findByText(translate('en', 'onboarding.nameSaveError'));
  expect(screen.queryByText('Account entry')).toBeNull();
});

test('language changes preserve the draft without reloading the profile', async () => {
  const { rerender } = render(content());
  fireEvent.changeText(await screen.findByLabelText('Your name'), 'Sara');
  rerender(content('fa'));
  expect(screen.getByLabelText(translate('fa', 'onboarding.nameLabel')).props.value).toBe('Sara');
  expect(engine.accountProfile).toHaveBeenCalledTimes(1);
});

test('leaving onboarding requires logout confirmation', async () => {
  render(content());
  await screen.findByLabelText('Your name');
  fireEvent.press(screen.getByRole('button', { name: 'Log Out' }));
  expect(engine.signOut).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Log Out Without Backing Up' }));
  await act(async () => {});
  expect(engine.signOut).toHaveBeenCalledTimes(1);
});
