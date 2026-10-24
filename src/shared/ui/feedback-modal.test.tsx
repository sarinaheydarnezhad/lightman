import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Modal, Platform } from 'react-native';

import { LocalizationProvider } from '@/shared/localization/localization-provider';
import { FeedbackModal } from './feedback-modal';

jest.mock('@/core/composition/application', () => ({
  application: {
    settings: { subscribe: () => () => {}, snapshot: () => null },
  },
}));

test('web modal focus does not call unsupported native accessibility APIs', () => {
  const platform = jest.replaceProperty(Platform, 'OS', 'web');
  const nativeFocus = jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus');
  try {
    render(<FeedbackModal message="A browser notice." />);
    fireEvent(screen.UNSAFE_getByType(Modal), 'show');
    expect(screen.getByRole('header', { name: 'Something went wrong' }).props.tabIndex).toBe(-1);
    expect(nativeFocus).not.toHaveBeenCalled();
  } finally {
    platform.restore();
    nativeFocus.mockRestore();
  }
});

test('feedback appears in a real modal and closes without leaving an inline message', () => {
  const dismissed = jest.fn();
  render(<FeedbackModal message="Saved successfully." tone="success" onDismiss={dismissed} />);
  expect(screen.UNSAFE_getByType(Modal).props.transparent).toBe(true);
  expect(screen.getByTestId('feedback-modal').props.accessibilityViewIsModal).toBe(true);
  expect(screen.getByRole('header', { name: 'Notice' })).toBeTruthy();
  expect(screen.getByText('Saved successfully.')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByText('Saved successfully.')).toBeNull();
  expect(screen.queryByTestId('feedback-modal')).toBeNull();
  expect(dismissed).toHaveBeenCalledTimes(1);
});

test('back dismisses feedback and retry remains available after closing the modal', () => {
  const retry = jest.fn();
  render(<FeedbackModal message="Unable to load." onRetry={retry} />);
  fireEvent(screen.UNSAFE_getByType(Modal), 'requestClose');
  expect(screen.queryByText('Unable to load.')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(retry).toHaveBeenCalledTimes(1);
});

test('retry closes the modal before invoking the recovery action', () => {
  const retry = jest.fn();
  render(<FeedbackModal message="Network unavailable." onRetry={retry} retryLabel="Reconnect" />);
  fireEvent.press(screen.getByRole('button', { name: 'Reconnect' }));
  expect(retry).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('feedback-modal')).toBeNull();
});

test('dismissed notices stay dismissed on rerender but a new event reopens them', () => {
  const first = {};
  const second = {};
  const { rerender } = render(<FeedbackModal message="Operation completed." eventKey={first} />);
  fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  rerender(<FeedbackModal message="Operation completed." eventKey={first} />);
  expect(screen.queryByText('Operation completed.')).toBeNull();
  rerender(<FeedbackModal message="Operation completed." eventKey={second} />);
  expect(screen.getByText('Operation completed.')).toBeTruthy();
});

test('clearing a message allows the same error to appear on another attempt', () => {
  const { rerender } = render(<FeedbackModal message="Check your password." />);
  fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  rerender(<FeedbackModal message="" />);
  rerender(<FeedbackModal message="Check your password." />);
  expect(screen.getByText('Check your password.')).toBeTruthy();
});

test('a changed message reopens feedback even when the event key stays the same', () => {
  const eventKey = {};
  const { rerender } = render(<FeedbackModal message="Backup completed." eventKey={eventKey} />);
  fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  rerender(<FeedbackModal message="Backup expired." eventKey={eventKey} />);
  expect(screen.getByText('Backup expired.')).toBeTruthy();
});

test('removing the active notice advances the queue without showing stale messages', () => {
  const { rerender } = render(
    <>
      <FeedbackModal key="first" message="First notice" />
      <FeedbackModal key="second" message="Second notice" />
      <FeedbackModal key="third" message="Third notice" />
    </>,
  );
  rerender(
    <>
      <FeedbackModal key="second" message="Second notice" />
      <FeedbackModal key="third" message="Third notice" />
    </>,
  );
  expect(screen.getAllByTestId('feedback-modal')).toHaveLength(1);
  expect(screen.getByText('Second notice')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  expect(screen.getByText('Third notice')).toBeTruthy();
});

test('simultaneous notices appear one at a time and queue cleanup removes unmounted notices', () => {
  const { rerender } = render(
    <>
      <FeedbackModal message="First error" />
      <FeedbackModal message="Second error" />
    </>,
  );
  expect(screen.getAllByTestId('feedback-modal')).toHaveLength(1);
  expect(screen.getByText('First error')).toBeTruthy();
  expect(screen.queryByText('Second error')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  expect(screen.getByText('Second error')).toBeTruthy();
  rerender(<FeedbackModal message="Replacement error" />);
  expect(screen.getByText('Replacement error')).toBeTruthy();
  expect(screen.queryByText('Second error')).toBeNull();
});

test('Persian feedback uses localized controls and right-to-left message text', () => {
  render(
    <LocalizationProvider language="fa">
      <FeedbackModal message="داده‌ها ذخیره شدند." tone="info" />
    </LocalizationProvider>,
  );
  expect(screen.getByRole('header', { name: 'اطلاع‌رسانی' })).toBeTruthy();
  expect(screen.getByText('داده‌ها ذخیره شدند.')).toHaveStyle({
    writingDirection: 'rtl',
    textAlign: 'right',
  });
  fireEvent.press(screen.getByRole('button', { name: 'بستن' }));
  expect(screen.queryByTestId('feedback-modal')).toBeNull();
});
