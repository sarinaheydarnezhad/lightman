import { render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '@/shared/theme/theme-provider';
import { ReviewDistribution } from './review-distribution';

test('distribution renders scheduler-provided labels and counts, including empty states', () => {
  render(
    <ThemeProvider>
      <ReviewDistribution
        distributions={[
          {
            schedulerId: 'example',
            label: 'Example system',
            sections: [
              { key: 'fresh', label: 'Fresh cards', count: 24 },
              { key: 'learning', label: 'Learning', count: 0 },
            ],
          },
        ]}
      />
    </ThemeProvider>,
  );
  expect(screen.getByRole('header', { name: 'Card distribution' })).toBeTruthy();
  expect(screen.getByLabelText('Fresh cards: 24 active cards')).toBeTruthy();
  expect(screen.getByLabelText('Learning: 0 active cards')).toBeTruthy();
  expect(screen.queryByText('Box 1')).toBeNull();
});

test('zero-card distributions still display their actual scheduler sections without inventing history', () => {
  render(
    <ThemeProvider>
      <ReviewDistribution
        distributions={[
          {
            schedulerId: 'leitner',
            label: 'Leitner',
            sections: [{ key: 'box-1', label: 'Box 1', count: 0 }],
          },
        ]}
      />
    </ThemeProvider>,
  );
  expect(screen.getByLabelText('Box 1: 0 active cards')).toBeTruthy();
  expect(screen.getByText('No active cards to distribute.')).toBeTruthy();
});
