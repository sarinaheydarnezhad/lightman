import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Modal, Platform } from 'react-native';
import { LocalizationProvider } from '@/shared/localization/localization-provider';
import { FeedbackNotice } from './feedback-notice';
import { Input } from './input';

test('iOS announces an operation once, keeps translated wording in the same event, and resets after removal', () => {
  const platform = jest.replaceProperty(Platform, 'OS', 'ios');
  const announce = jest
    .spyOn(AccessibilityInfo, 'announceForAccessibility')
    .mockImplementation(() => {});
  const event = {};
  try {
    const { rerender } = render(<FeedbackNotice message="Recovery required" eventKey={event} />);
    expect(announce).toHaveBeenCalledTimes(1);
    rerender(<FeedbackNotice message="ادامه نیاز به بررسی دارد" eventKey={event} />);
    expect(announce).toHaveBeenCalledTimes(1);
    rerender(<FeedbackNotice message={null} eventKey={event} />);
    rerender(<FeedbackNotice message="Recovery required" eventKey={event} />);
    expect(announce).toHaveBeenCalledTimes(2);
    rerender(<FeedbackNotice message="Recovery required" eventKey={{}} />);
    expect(announce).toHaveBeenCalledTimes(3);
    rerender(<FeedbackNotice message="Another account" enabled={false} />);
    expect(announce).toHaveBeenCalledTimes(3);
  } finally {
    platform.restore();
    announce.mockRestore();
  }
});

test('simultaneous task failures keep both recovery actions visible without a modal', () => {
  const retry = jest.fn();
  const { rerender } = render(
    <>
      <FeedbackNotice
        message="Backup completion is unknown"
        onRetry={retry}
        retryLabel="Check backup"
      />
      <FeedbackNotice message="Keep both histories" tone="warning">
        <Input label="Name" value="unsaved" />
      </FeedbackNotice>
    </>,
  );
  expect(screen.UNSAFE_queryByType(Modal)).toBeNull();
  expect(screen.getByText('Backup completion is unknown')).toBeTruthy();
  expect(screen.getByText('Keep both histories')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Check backup' }));
  expect(retry).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Backup completion is unknown')).toBeTruthy();
  rerender(<FeedbackNotice message="Other account" enabled={false} onRetry={retry} />);
  expect(screen.queryByText('Other account')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Check backup' })).toBeNull();
});

test('busy recovery prevents repeated actions and localized field errors remain beside the input', () => {
  const retry = jest.fn();
  render(
    <LocalizationProvider language="fa">
      <FeedbackNotice message="دوباره تلاش کن" busy onRetry={retry} retryLabel="تلاش دوباره" />
      <Input label="نام" error="نام را وارد کن" />
    </LocalizationProvider>,
  );
  expect(screen.getByRole('button', { name: 'تلاش دوباره', disabled: true })).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'تلاش دوباره' }));
  expect(retry).not.toHaveBeenCalled();
  expect(screen.getByLabelText('نام').props.accessibilityHint).toBe(
    'خطا: \u2068نام را وارد کن\u2069',
  );
  expect(screen.getByText('نام را وارد کن')).toBeTruthy();
  expect(screen.UNSAFE_queryByType(Modal)).toBeNull();
});
