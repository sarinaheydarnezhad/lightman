import { ActivityChart, chartBarHeights } from './activity-chart';
import { calendarDate } from '@/core/domain/values';
import { render, screen } from '@testing-library/react-native';
import { Rect } from 'react-native-svg';
import { setTestTheme } from '@/../test/set-test-theme';
import { ThemeProvider } from '@/shared/theme/theme-provider';
import { palette } from '@/shared/theme/tokens';

afterEach(async () => setTestTheme('light'));

const day = (reviewCount: number) => ({
  date: calendarDate('2026-09-25'),
  reviewCount,
  uniqueCardsReviewed: reviewCount,
  successfulReviews: reviewCount,
  failedReviews: 0,
});

test('empty, zero, one-point, large counts, and 90 bars scale without division by zero', () => {
  expect(chartBarHeights([])).toEqual([]);
  expect(chartBarHeights([day(0), day(0)])).toEqual([0, 0]);
  expect(chartBarHeights([day(999_999)])).toEqual([60]);
  expect(chartBarHeights([day(1), day(100_000)])).toEqual([2, 60]);
  expect(chartBarHeights(Array.from({ length: 90 }, (_, i) => day(i)))).toHaveLength(90);
});

test('the accessible chart scales to its parent and keeps its date axis chronological in RTL', () => {
  const from = { ...day(1), date: calendarDate('2026-09-19') };
  const to = day(3);
  render(<ActivityChart activity={[from, to]} window={7} totalReviews={4} activeDays={2} />);
  expect(
    screen.getByLabelText('7-day review activity: 4 reviews across 2 active days.'),
  ).toBeTruthy();
  expect(screen.getByText('2026-09-19').parent?.props.style).toMatchObject({
    writingDirection: 'ltr',
  });
  expect(screen.getByText('2026-09-25')).toBeTruthy();
});

test.each(['light', 'dark'] as const)('%s activity uses the secondary accent', async (theme) => {
  await setTestTheme(theme);
  render(
    <ThemeProvider>
      <ActivityChart activity={[day(3)]} window={7} totalReviews={3} activeDays={1} />
    </ThemeProvider>,
  );
  expect(screen.UNSAFE_getByType(Rect).props.fill).toBe(palette[theme].secondaryAccent);
});
