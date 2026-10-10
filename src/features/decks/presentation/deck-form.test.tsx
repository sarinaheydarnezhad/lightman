import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { Modal, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { makeDeck } from '@/../test/fixtures';
import { application } from '@/core/composition/application';
import { useLocalization } from '@/shared/localization/localization-provider';
import {
  formatNumber,
  resolveDirection,
  translate,
  type UiLanguage,
} from '@/shared/localization/localization';
import { DeckForm } from './deck-form';

jest.mock('@/core/composition/application', () => ({
  application: {
    listSchedulers: jest.fn(() => [
      {
        id: 'leitner',
        label: 'Leitner',
        localizedLabels: { fa: '\u0644\u0627\u06cc\u062a\u0646\u0631' },
      },
      { id: 'sm2', label: 'SM-2', localizedLabels: { fa: 'SM-2' } },
    ]),
  },
}));

jest.mock('@/core/composition/haptics', () => ({
  haptics: { actionRejected: jest.fn(), actionConfirmed: jest.fn() },
}));

jest.mock('@/shared/localization/localization-provider', () => ({
  useLocalization: jest.fn(),
}));

function setLanguage(language: UiLanguage) {
  jest.mocked(useLocalization).mockReturnValue({
    language,
    direction: resolveDirection(language),
    t: (key, values) => translate(language, key, values),
    number: (value) => formatNumber(value, language),
  });
}

function form(existing?: ReturnType<typeof makeDeck>) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 850 },
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      }}
    >
      <DeckForm existing={existing} onSubmit={jest.fn(async () => {})} />
    </SafeAreaProvider>
  );
}

function expectRows(language: UiLanguage) {
  const direction = resolveDirection(language);
  const rows = screen
    .UNSAFE_getAllByType(View)
    .filter((view) => view.props.className === 'flex-row flex-wrap gap-sm');
  const expectedLabels = [
    [translate(language, 'language.en'), translate(language, 'language.fa')],
    (['ltr', 'rtl', 'center'] as const).map((choice) =>
      translate(language, `form.alignment.${choice}`),
    ),
    (['small', 'medium', 'large'] as const).map((choice) =>
      translate(language, `form.size.${choice}`),
    ),
    application
      .listSchedulers()
      .map((scheduler) => scheduler.localizedLabels?.[language] ?? scheduler.label),
  ];
  expect(rows).toHaveLength(4);
  rows.forEach((row, index) => {
    expect(StyleSheet.flatten(row.props.style)).toMatchObject({
      direction: 'ltr',
      flexDirection: direction === 'rtl' ? 'row-reverse' : 'row',
    });
    expect(
      within(row)
        .getAllByRole('button')
        .map((button) => button.props.accessibilityLabel),
    ).toEqual(expectedLabels[index]);
  });
  const header = screen
    .UNSAFE_getAllByType(View)
    .find((view) => view.props.className === 'flex-row items-center justify-between gap-sm');
  expect(header).toBeDefined();
  expect(StyleSheet.flatten(header!.props.style)).toMatchObject({
    direction: 'ltr',
    flexDirection: direction === 'rtl' ? 'row-reverse' : 'row',
  });
  for (const key of [
    'form.language',
    'form.languageHint',
    'form.alignment',
    'form.size',
    'review.system',
    'review.deckHint',
  ] as const) {
    expect(screen.getByText(translate(language, key))).toHaveStyle({
      textAlign: direction === 'rtl' ? 'right' : 'left',
      writingDirection: direction,
    });
  }
  expect(
    within(header!).getByRole('button', { name: translate(language, 'review.infoButton') }),
  ).toBeTruthy();
}

test.each(['create', 'edit'] as const)(
  '%s option rows and review header switch from RTL back to LTR',
  (mode) => {
    const existing = mode === 'edit' ? makeDeck() : undefined;
    setLanguage('fa');
    const { rerender } = render(form(existing));
    expectRows('fa');
    fireEvent.press(screen.getByRole('button', { name: translate('fa', 'form.size.large') }));
    expect(
      screen.getByRole('button', { name: translate('fa', 'form.size.large'), selected: true }),
    ).toBeTruthy();

    setLanguage('en');
    rerender(form(existing));
    expectRows('en');
    expect(screen.getByRole('button', { name: 'Large', selected: true })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Explain review systems' }));
    expect(screen.getByText(translate('en', 'review.infoTitle'))).toBeTruthy();
  },
);

describe.each(['create', 'edit'] as const)('%s review explanation', (mode) => {
  test.each(['fa', 'en'] as const)('is localized and centered in %s', (language) => {
    setLanguage(language);
    render(form(mode === 'edit' ? makeDeck() : undefined));
    fireEvent.press(screen.getByRole('button', { name: translate(language, 'review.infoButton') }));

    for (const key of [
      'review.infoTitle',
      'review.leitnerDescription',
      'review.sm2Description',
    ] as const) {
      const explanation = translate(language, key);
      if (language === 'fa') {
        expect(explanation).not.toBe(translate('en', key));
      }
      expect(screen.getByText(explanation)).toHaveStyle({
        textAlign: language === 'fa' ? 'right' : 'left',
        writingDirection: resolveDirection(language),
      });
    }
    if (language === 'fa') {
      expect(screen.getByRole('button', { name: 'توضیح سیستم‌های مرور' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'بستن' })).toBeTruthy();
    }

    const backdrop = screen
      .UNSAFE_getAllByType(View)
      .find((view) => view.props.accessibilityViewIsModal);
    expect(backdrop).toBeDefined();
    expect(backdrop!.props.className.split(' ')).toContain('justify-center');
    expect(backdrop!.props.className.split(' ')).not.toContain('justify-end');

    fireEvent.press(screen.getByRole('button', { name: translate(language, 'review.infoClose') }));
    expect(screen.UNSAFE_getByType(Modal).props.visible).toBe(false);
    expect(screen.queryByText(translate(language, 'review.infoTitle'))).toBeNull();
  });
});
