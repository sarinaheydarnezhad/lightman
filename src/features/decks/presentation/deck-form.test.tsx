import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Modal, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { makeDeck } from '@/../test/fixtures';
import { application } from '@/core/composition/application';
import { languageTag } from '@/core/domain/values';
import { useLocalization } from '@/shared/localization/localization-provider';
import {
  formatNumber,
  resolveDirection,
  translate,
  type UiLanguage,
} from '@/shared/localization/localization';
import { DeckForm } from './deck-form';
import { AppError } from '@/core/errors/app-error';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

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

function form(existing?: ReturnType<typeof makeDeck>, onSubmit = jest.fn(async () => {})) {
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 850 },
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      }}
    >
      <DeckForm existing={existing} onSubmit={onSubmit} />
    </SafeAreaProvider>
  );
}

function expectRows(language: UiLanguage) {
  const direction = resolveDirection(language);
  const rows = screen
    .UNSAFE_getAllByType(View)
    .filter((view) => view.props.className === 'flex-row flex-wrap gap-sm');
  const expectedLabels = [
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
  expect(rows).toHaveLength(3);
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
  for (const key of ['form.alignment', 'form.size', 'review.system', 'review.deckHint'] as const) {
    expect(screen.getByText(translate(language, key))).toHaveStyle({
      textAlign: direction === 'rtl' ? 'right' : 'left',
      writingDirection: direction,
    });
  }
  expect(
    within(header!).getByRole('button', { name: translate(language, 'review.infoButton') }),
  ).toBeTruthy();
  expect(screen.queryByText(translate(language, 'form.language'))).toBeNull();
  expect(screen.queryByText(translate(language, 'form.languageHint'))).toBeNull();
  for (const choice of ['en', 'fa'] as const) {
    expect(
      screen.queryByRole('button', { name: translate(language, `language.${choice}`) }),
    ).toBeNull();
  }
}

test.each(['en', 'fa'] as const)(
  'creation offers a localized import shortcut without submitting in %s',
  (language) => {
    const submit = jest.fn(async () => {});
    jest.mocked(router.push).mockClear();
    setLanguage(language);
    render(form(undefined, submit));
    fireEvent.press(screen.getByRole('button', { name: translate(language, 'transfer.import') }));
    expect(router.push).toHaveBeenCalledWith('/settings/transfer');
    expect(submit).not.toHaveBeenCalled();
  },
);

test.each(['en', 'fa'] as const)(
  'editing does not offer the creation import shortcut in %s',
  (language) => {
    setLanguage(language);
    render(form(makeDeck()));
    expect(
      screen.queryByRole('button', { name: translate(language, 'transfer.import') }),
    ).toBeNull();
  },
);

test.each(['en-US', 'fa-IR', 'es'])(
  'editing preserves stored %s language and category data when app language changes',
  async (tag) => {
    const existing = makeDeck({ language: languageTag(tag) });
    const submit = jest.fn(async () => {});
    setLanguage('fa');
    const { rerender } = render(form(existing, submit));
    setLanguage('en');
    rerender(form(existing, submit));
    fireEvent.press(screen.getByRole('button', { name: 'Save deck' }));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit).toHaveBeenCalledWith({
      name: existing.name,
      description: existing.description,
      language: existing.language,
      textAlignment: existing.textAlignment,
      typographySize: existing.typographySize,
      reviewSystem: existing.reviewSystem,
    });
  },
);

test.each(['en', 'fa'] as const)(
  'creation keeps the existing default language in %s',
  async (language) => {
    const submit = jest.fn(async () => {});
    setLanguage(language);
    render(form(undefined, submit));
    fireEvent.changeText(screen.getByLabelText(translate(language, 'form.deckName')), 'New deck');
    fireEvent.press(
      screen.getByRole('button', { name: translate(language, 'form.createDeckAction') }),
    );
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New deck', language: 'en' }),
    );
  },
);

test.each(['en', 'fa'] as const)(
  'deck quota errors are explicit in %s and retain entered data',
  async (language) => {
    setLanguage(language);
    render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 320, height: 850 },
          insets: { top: 0, right: 0, bottom: 0, left: 0 },
        }}
      >
        <DeckForm
          onSubmit={jest.fn().mockRejectedValue(new AppError('free-tier-limit', 'Quota'))}
        />
      </SafeAreaProvider>,
    );
    fireEvent.changeText(
      screen.getByLabelText(translate(language, 'form.deckName')),
      'Unsaved deck',
    );
    fireEvent.press(
      screen.getByRole('button', { name: translate(language, 'form.createDeckAction') }),
    );
    expect(await screen.findByText(translate(language, 'guest.deckLimit'))).toBeTruthy();
    expect(screen.getByLabelText(translate(language, 'form.deckName')).props.value).toBe(
      'Unsaved deck',
    );
  },
);

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
