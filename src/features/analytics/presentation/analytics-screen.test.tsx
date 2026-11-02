import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { calendarDate } from '@/core/domain/values';
import { useLocalization } from '@/shared/localization/localization-provider';
import { formatNumber, resolveDirection, translate } from '@/shared/localization/localization';
import type { StudySummary } from '../domain/analytics';
import { AnalyticsScreen } from './analytics-screen';

jest.mock('@/core/composition/application', () => ({ application: {} }));
jest.mock('@/shared/localization/localization-provider', () => ({ useLocalization: jest.fn() }));
jest.mock('./use-analytics-view-model', () => ({
  useAnalyticsViewModel: () => ({
    data: mockSummary,
    window: 7,
    setWindow: jest.fn(),
    loading: false,
    error: null,
  }),
}));

const mockSummary: StudySummary = {
  range: { from: calendarDate('2026-10-27'), to: calendarDate('2026-11-02') },
  today: calendarDate('2026-11-02'),
  hasHistory: true,
  currentStreak: 3,
  bestStreak: 9,
  cardsReviewedToday: 48,
  totalReviews: 64,
  retentionRate: 75,
  activeStudyDays: 4,
  activeCardCount: 12,
  boxDistribution: { 1: 12, 2: 0, 3: 0, 4: 0, 5: 0 },
  distribution: [
    {
      schedulerId: 'leitner',
      label: 'Leitner',
      sections: [{ key: 'box-1', label: 'Box 1', count: 12 }],
    },
  ],
  dailyActivity: ['2026-10-27', '2026-11-02'].map((date) => ({
    date: calendarDate(date),
    reviewCount: 32,
    uniqueCardsReviewed: 24,
    successfulReviews: 24,
    failedReviews: 8,
  })),
};

test.each(['fa', 'en'] as const)(
  '%s analytics numbers consistently use bundled Vazirmatn faces',
  (language) => {
    jest.mocked(useLocalization).mockReturnValue({
      language,
      direction: resolveDirection(language),
      number: (value) => formatNumber(value, language),
      t: (key, values) => translate(language, key, values),
    });
    render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, bottom: 0, left: 0, right: 0 },
        }}
      >
        <AnalyticsScreen />
      </SafeAreaProvider>,
    );
    expect(
      screen.getByText(translate(language, 'common.days', { count: formatNumber(3, language) })),
    ).toHaveStyle({
      fontFamily: 'Vazirmatn-Bold',
      fontWeight: 'normal',
    });
    for (const value of [
      formatNumber(48, language),
      formatNumber(75, language) + '%',
      formatNumber(12, language),
    ]) {
      expect(screen.getByText(value)).toHaveStyle({
        fontFamily: 'Vazirmatn-SemiBold',
        fontWeight: 'normal',
      });
    }
    for (const date of language === 'fa'
      ? ['۲۰۲۶-۱۰-۲۷', '۲۰۲۶-۱۱-۰۲']
      : ['2026-10-27', '2026-11-02']) {
      expect(screen.getByText(date)).toHaveStyle({
        fontFamily: 'Vazirmatn-Medium',
        fontWeight: 'normal',
        writingDirection: 'ltr',
      });
    }
  },
);
