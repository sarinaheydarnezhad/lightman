import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Text } from '@/shared/ui/text';
import { BootstrapGate } from './bootstrap-gate';

const initialMetrics = {
  frame: { x: 0, y: 0, width: 320, height: 640 },
  insets: { top: 24, bottom: 16, left: 0, right: 0 },
};

function renderBootstrap(initialize: () => Promise<void>) {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <BootstrapGate initialize={initialize}>
        <Text>Application ready</Text>
      </BootstrapGate>
    </SafeAreaProvider>,
  );
}

test('shows loading before initialization finishes, then renders the app', async () => {
  let complete: (() => void) | undefined;
  const initialize = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        complete = () => resolve();
      }),
  );

  renderBootstrap(initialize);
  expect(screen.getByLabelText('Preparing your study space')).toBeTruthy();
  expect(screen.queryByText('Application ready')).toBeNull();

  await waitFor(() => expect(initialize).toHaveBeenCalledTimes(1));
  complete?.();
  await waitFor(() => expect(screen.getByText('Application ready')).toBeTruthy());
  expect(initialize).toHaveBeenCalledTimes(1);
});

test('shows a safe error and retries initialization', async () => {
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
  const initialize = jest
    .fn()
    .mockRejectedValueOnce(new Error('Internal setup details'))
    .mockResolvedValueOnce(undefined);

  try {
    renderBootstrap(initialize);
    await waitFor(() => expect(screen.getByText('Could not open your study space')).toBeTruthy());
    expect(screen.queryByText('Internal setup details')).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getByText('Application ready')).toBeTruthy());
    expect(initialize).toHaveBeenCalledTimes(2);
  } finally {
    errorLog.mockRestore();
  }
});
