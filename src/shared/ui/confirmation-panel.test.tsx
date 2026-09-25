import { fireEvent, render, screen } from '@testing-library/react-native';
import { BackHandler } from 'react-native';

import { ConfirmationPanel } from './confirmation-panel';

test('confirmation exposes a named question and distinct actions', () => {
  const cancel = jest.fn();
  const confirm = jest.fn();
  const { unmount } = render(
    <ConfirmationPanel
      title="Archive this card?"
      description="The card will leave the active deck."
      cancelLabel="Keep card"
      confirmLabel="Confirm archive"
      onCancel={cancel}
      onConfirm={confirm}
    />,
  );
  expect(screen.getByRole('header', { name: 'Archive this card?' })).toBeTruthy();
  expect(screen.getByText('The card will leave the active deck.')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Keep card' }));
  fireEvent.press(screen.getByRole('button', { name: 'Confirm archive' }));
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(confirm).toHaveBeenCalledTimes(1);
  unmount();
});

test('Android back dismisses a confirmation but cannot interrupt an in-progress action', () => {
  const addListener = jest.spyOn(BackHandler, 'addEventListener');
  const cancel = jest.fn();
  const props = {
    title: 'End this session?',
    description: 'Completed reviews are kept.',
    cancelLabel: 'Keep studying',
    confirmLabel: 'End session',
    onCancel: cancel,
    onConfirm: jest.fn(),
  };
  const { rerender, unmount } = render(<ConfirmationPanel {...props} />);
  const onBack = addListener.mock.calls.at(-1)![1];
  expect(onBack({} as never)).toBe(true);
  expect(cancel).toHaveBeenCalledTimes(1);
  rerender(<ConfirmationPanel {...props} busy />);
  expect(screen.getByRole('button', { name: 'Keep studying', disabled: true })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'End session', busy: true })).toBeTruthy();
  expect(onBack({} as never)).toBe(true);
  expect(cancel).toHaveBeenCalledTimes(1);
  unmount();
  addListener.mockRestore();
});
