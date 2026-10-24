import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Modal, Platform } from 'react-native';

import { ConfirmationPanel } from './confirmation-panel';

test('web confirmation focus avoids unsupported native accessibility APIs', () => {
  const platform = jest.replaceProperty(Platform, 'OS', 'web');
  const nativeFocus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  try {
    render(
      <ConfirmationPanel
        title="Delete this card?"
        description="The card will leave the active deck."
        cancelLabel="Keep card"
        confirmLabel="Confirm delete"
        onCancel={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );
    fireEvent(screen.UNSAFE_getByType(Modal), 'show');
    expect(screen.getByRole('header', { name: 'Delete this card?' }).props.tabIndex).toBe(-1);
    expect(nativeFocus).not.toHaveBeenCalled();
  } finally {
    platform.restore();
    nativeFocus.mockRestore();
  }
});

test('confirmation exposes a named question and distinct actions', () => {
  const cancel = jest.fn();
  const confirm = jest.fn();
  const { unmount } = render(
    <ConfirmationPanel
      title="Delete this card?"
      description="The card will leave the active deck."
      cancelLabel="Keep card"
      confirmLabel="Confirm delete"
      onCancel={cancel}
      onConfirm={confirm}
    />,
  );
  expect(screen.getByRole('header', { name: 'Delete this card?' })).toBeTruthy();
  expect(screen.getByText('The card will leave the active deck.')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Keep card' }));
  fireEvent.press(screen.getByRole('button', { name: 'Confirm delete' }));
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(confirm).toHaveBeenCalledTimes(1);
  unmount();
});

test('Android back dismisses a confirmation but cannot interrupt an in-progress action', () => {
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
  expect(screen.UNSAFE_getByType(Modal).props.transparent).toBe(true);
  fireEvent(screen.UNSAFE_getByType(Modal), 'requestClose');
  expect(cancel).toHaveBeenCalledTimes(1);
  rerender(<ConfirmationPanel {...props} busy />);
  expect(screen.getByRole('button', { name: 'Keep studying', disabled: true })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'End session', busy: true })).toBeTruthy();
  fireEvent(screen.UNSAFE_getByType(Modal), 'requestClose');
  expect(cancel).toHaveBeenCalledTimes(1);
  unmount();
});

test('action failures stay inside the confirmation modal', () => {
  render(
    <ConfirmationPanel
      title="Delete this card?"
      description="The card will leave the active deck."
      cancelLabel="Keep card"
      confirmLabel="Confirm delete"
      error="Could not delete the card."
      onCancel={jest.fn()}
      onConfirm={jest.fn()}
    />,
  );
  expect(
    screen.UNSAFE_getByType(Modal).findByProps({ accessibilityViewIsModal: true }),
  ).toBeTruthy();
  expect(screen.getByText('Could not delete the card.')).toBeTruthy();
});
