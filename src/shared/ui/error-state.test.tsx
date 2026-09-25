import { fireEvent, render, screen } from '@testing-library/react-native';

import { ErrorState } from './error-state';

test('retryable errors expose a heading, description and an actionable retry', () => {
  const retry = jest.fn();
  render(
    <ErrorState title="Cards unavailable" description="Could not load cards." onRetry={retry} />,
  );

  expect(screen.getByRole('header', { name: 'Cards unavailable' })).toBeTruthy();
  expect(screen.getByText('Could not load cards.')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(retry).toHaveBeenCalledTimes(1);
});
