import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { StrictMode } from 'react';
import { router } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { transferService } from '@/core/composition/transfer';
import type { ImportPreview, ImportSummary } from '../application/transfer-service';
import { LocalizationProvider } from '@/shared/localization/localization-provider';
import { translate, type UiLanguage } from '@/shared/localization/localization';
import { ImportPreviewScreen } from './import-preview-screen';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  Stack: { Screen: () => null },
}));
jest.mock('expo-router/react-navigation', () => ({ usePreventRemove: jest.fn() }));
jest.mock('@/core/composition/application', () => ({
  application: { settings: { subscribe: () => () => {}, snapshot: () => null } },
}));
jest.mock('@/core/composition/transfer', () => ({
  transferService: { pendingPreview: jest.fn(), confirm: jest.fn(), cancel: jest.fn() },
}));

const preview: ImportPreview = {
  fileName: 'Cards.csv',
  format: 'csv',
  decks: ['Vocabulary'],
  totalCards: 3,
  newCards: 1,
  duplicates: 1,
  invalidRows: 1,
  issues: [{ location: 'Row 4', message: 'Missing back' }],
  columns: ['Note'],
  rows: [
    {
      location: 'Row 2',
      status: 'ready',
      card: {
        deckName: 'Vocabulary',
        frontText: 'Hello',
        meaning: 'Greeting',
        phonetic: null,
        category: null,
        examples: [],
        extra: { Note: 'Keep this' },
      },
    },
    {
      location: 'Row 3',
      status: 'duplicate',
      card: {
        deckName: 'Vocabulary',
        frontText: 'World',
        meaning: 'Earth',
        phonetic: null,
        category: null,
        examples: [],
      },
    },
  ],
};
const summary: ImportSummary = {
  imported: 1,
  duplicatesSkipped: 1,
  invalidSkipped: 1,
  issues: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(transferService.pendingPreview).mockReturnValue(preview);
  jest.mocked(transferService.confirm).mockReset().mockResolvedValue(summary);
  jest.mocked(router.canGoBack).mockReturnValue(true);
});

function mount(language: UiLanguage = 'en') {
  return render(
    <LocalizationProvider language={language}>
      <ImportPreviewScreen />
    </LocalizationProvider>,
  );
}

test.each(['en', 'fa'] as const)(
  'cards scroll separately from the fixed side-by-side actions in %s',
  (language) => {
    mount(language);
    expect(screen.getByText('Cards.csv')).toBeTruthy();
    expect(screen.getAllByLabelText(`${translate(language, 'form.front')} *`)).toHaveLength(2);
    expect(screen.getByText('Row 4: Missing back')).toBeTruthy();
    const actions = screen.getByTestId('import-preview-actions');
    expect(actions.props.className).toContain(language === 'fa' ? 'flex-row-reverse' : 'flex-row');
    for (const key of ['transfer.approve', 'transfer.reject'] as const) {
      const name = translate(language, key);
      expect(within(actions).getByRole('button', { name })).toHaveStyle({ flex: 1 });
      expect(
        within(screen.getByTestId('import-preview-cards')).queryByRole('button', { name }),
      ).toBeNull();
    }
    expect(transferService.confirm).not.toHaveBeenCalled();
  },
);

test('approval saves only the edited, retained cards and returns after the summary is closed', async () => {
  const view = mount();
  fireEvent.changeText(screen.getAllByLabelText('Front *')[0]!, 'Edited hello');
  fireEvent.changeText(screen.getAllByLabelText('Note')[0]!, 'Edited note');
  fireEvent.press(screen.getAllByRole('button', { name: 'Delete row' })[1]!);
  fireEvent.press(screen.getByRole('button', { name: 'Approve' }));
  await screen.findByText('Imported: 1\nDuplicates skipped: 1\nInvalid / skipped rows: 1');
  expect(transferService.confirm).toHaveBeenCalledWith(preview, [
    {
      ...preview.rows![0],
      card: {
        ...preview.rows![0]!.card,
        frontText: 'Edited hello',
        extra: { Note: 'Edited note' },
      },
    },
  ]);
  expect(router.back).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  expect(router.back).toHaveBeenCalledTimes(1);
  view.unmount();
  await act(async () => {});
  expect(transferService.cancel).not.toHaveBeenCalled();
});

test('rejection discards the preview without saving any cards', async () => {
  const view = mount();
  fireEvent.press(screen.getByRole('button', { name: 'Reject' }));
  expect(transferService.cancel).toHaveBeenCalledWith(preview);
  expect(router.back).toHaveBeenCalledTimes(1);
  expect(transferService.confirm).not.toHaveBeenCalled();
  view.unmount();
  await act(async () => {});
  expect(transferService.cancel).toHaveBeenCalledTimes(1);
});

test('navigating back discards an unapproved preview', async () => {
  const view = mount();
  view.unmount();
  await waitFor(() => expect(transferService.cancel).toHaveBeenCalledWith(preview));
  expect(transferService.confirm).not.toHaveBeenCalled();
});

test('strict effect replay does not cancel a preview that is still being reviewed', async () => {
  render(
    <StrictMode>
      <ImportPreviewScreen />
    </StrictMode>,
  );
  await act(async () => {});
  expect(transferService.cancel).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Approve' }));
  await screen.findByText('Imported: 1\nDuplicates skipped: 1\nInvalid / skipped rows: 1');
  expect(transferService.confirm).toHaveBeenCalledTimes(1);
});

test('saving blocks duplicate approvals, rejection, editing and back navigation', async () => {
  let finish!: (result: ImportSummary) => void;
  jest.mocked(transferService.confirm).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  mount();
  const approve = screen.getByRole('button', { name: 'Approve' });
  fireEvent.press(approve);
  fireEvent.press(approve);
  fireEvent.press(screen.getByRole('button', { name: 'Reject' }));
  expect(transferService.confirm).toHaveBeenCalledTimes(1);
  expect(transferService.cancel).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled();
  expect(screen.getAllByLabelText('Front *')[0]!.props.editable).toBe(false);
  expect(jest.mocked(usePreventRemove)).toHaveBeenLastCalledWith(true, expect.any(Function));
  await act(async () => finish(summary));
});

test('failed approval preserves edits and allows retry', async () => {
  jest.mocked(transferService.confirm).mockRejectedValueOnce(new Error('Storage unavailable'));
  mount();
  fireEvent.changeText(screen.getAllByLabelText('Front *')[0]!, 'Edited hello');
  fireEvent.press(screen.getByRole('button', { name: 'Approve' }));
  await screen.findByText('Storage unavailable');
  expect(router.back).not.toHaveBeenCalled();
  expect(transferService.cancel).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  expect(screen.getAllByLabelText('Front *')[0]!.props.value).toBe('Edited hello');
  fireEvent.press(screen.getByRole('button', { name: 'Approve' }));
  await screen.findByText('Imported: 1\nDuplicates skipped: 1\nInvalid / skipped rows: 1');
  expect(transferService.confirm).toHaveBeenCalledTimes(2);
});

test('deleting every card disables approval but leaves rejection available', () => {
  mount();
  fireEvent.press(screen.getAllByRole('button', { name: 'Delete row' })[0]!);
  fireEvent.press(screen.getAllByRole('button', { name: 'Delete row' })[0]!);
  expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Reject' })).not.toBeDisabled();
  fireEvent.press(screen.getByRole('button', { name: 'Approve' }));
  expect(transferService.confirm).not.toHaveBeenCalled();
});

test('a direct link without a pending file offers file selection instead of stale cards', () => {
  jest.mocked(transferService.pendingPreview).mockReturnValue(null);
  jest.mocked(router.canGoBack).mockReturnValue(false);
  mount();
  expect(screen.getByText(translate('en', 'transfer.previewMissing'))).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Select file' }));
  expect(router.replace).toHaveBeenCalledWith('/settings/transfer');
  expect(transferService.confirm).not.toHaveBeenCalled();
});
