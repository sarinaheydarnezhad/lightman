import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { application } from '@/core/composition/application';
import {
  transferService,
  selectTransferFile,
  shareTransferFile,
  saveTransferFile,
  downloadSampleFile,
} from '@/core/composition/transfer';
import { makeDeck } from '@/../test/fixtures';
import { TransferScreen } from './transfer-screen';

jest.setTimeout(20_000);

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: (effect: () => (() => void) | void) => {
    const react = jest.requireActual<typeof import('react')>('react');
    react.useEffect(effect, [effect]);
  },
}));

jest.mock('@/core/composition/application', () => ({ application: { listDecks: jest.fn() } }));
jest.mock('@/core/composition/transfer', () => ({
  selectTransferFile: jest.fn(),
  shareTransferFile: jest.fn(),
  saveTransferFile: jest.fn(),
  downloadSampleFile: jest.fn(),
  transferService: {
    preview: jest.fn(),
    confirm: jest.fn(),
    cancel: jest.fn(),
    export: jest.fn(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(application.listDecks).mockResolvedValue([makeDeck()]);
  jest
    .mocked(selectTransferFile)
    .mockResolvedValue({ name: 'Cards.csv', format: 'csv', bytes: new Uint8Array([1]) });
  jest.mocked(transferService.preview).mockResolvedValue({
    format: 'csv',
    decks: ['Vocabulary'],
    totalCards: 3,
    newCards: 1,
    duplicates: 1,
    invalidRows: 1,
    issues: [{ location: 'Row 4', message: 'Missing back' }],
  });
  jest
    .mocked(transferService.confirm)
    .mockResolvedValue({ imported: 1, duplicatesSkipped: 1, invalidSkipped: 1, issues: [] });
  jest.mocked(transferService.export).mockResolvedValue(new Uint8Array([2]));
  jest.mocked(shareTransferFile).mockResolvedValue('file:///cache/cards.csv');
});

test('selection opens a separate preview page without saving cards', async () => {
  const view = render(<TransferScreen />);
  await waitFor(() => expect(application.listDecks).toHaveBeenCalled());
  fireEvent.press(screen.getByText('Select file'));
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/settings/import-preview'));
  expect(transferService.preview).toHaveBeenCalledWith('csv', new Uint8Array([1]), 'Cards.csv');
  expect(screen.queryByText('Import preview')).toBeNull();
  expect(transferService.confirm).not.toHaveBeenCalled();
  view.unmount();
  expect(transferService.cancel).not.toHaveBeenCalled();
});

test('a parsing failure stays on the upload page', async () => {
  jest.mocked(transferService.preview).mockRejectedValueOnce(new Error('Invalid file'));
  render(<TransferScreen />);
  fireEvent.press(screen.getByText('Select file'));
  await screen.findByText('Invalid file');
  expect(router.push).not.toHaveBeenCalled();
  expect(transferService.confirm).not.toHaveBeenCalled();
});

test('picker cancellation never parses or saves', async () => {
  jest.mocked(selectTransferFile).mockResolvedValue(null);
  render(<TransferScreen />);
  fireEvent.press(screen.getByText('Select file'));
  await waitFor(() => expect(selectTransferFile).toHaveBeenCalledTimes(1));
  expect(transferService.preview).not.toHaveBeenCalled();
  expect(transferService.confirm).not.toHaveBeenCalled();
});

test('exports a selected deck in chosen format using the platform sharing adapter', async () => {
  render(<TransferScreen initialDeckId="deck-1" />);
  await screen.findByText('Vocabulary');
  fireEvent.press(screen.getByText('XLSX'));
  fireEvent.press(screen.getByText('Share / Save file'));
  await waitFor(() => expect(shareTransferFile).toHaveBeenCalledWith('xlsx', new Uint8Array([2])));
  await screen.findByText('Ready to share: /cache/cards.csv');
  fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  expect(transferService.export).toHaveBeenCalledWith('xlsx', 'deck-1');
  fireEvent.press(screen.getByText('All decks'));
  fireEvent.press(screen.getByText('Anki (.apkg)'));
  fireEvent.press(screen.getByText('Share / Save file'));
  await waitFor(() => expect(transferService.export).toHaveBeenCalledWith('apkg', undefined));
  await screen.findByText('Ready to share: /cache/cards.csv');
});

test('export confirmation displays the chosen folder and filename instead of the Android URI', async () => {
  const uri =
    'content://com.android.externalstorage.documents/tree/primary%3ADownload%2FLerona/document/primary%3ADownload%2FLerona%2Flerona-2026-10-11T10-36-32-200Z.csv';
  jest.mocked(saveTransferFile).mockResolvedValue(uri);
  render(<TransferScreen />);
  await screen.findByText('Vocabulary');
  fireEvent.press(screen.getByText('Save file to device'));
  await screen.findByText('Saved: Download/Lerona/lerona-2026-10-11T10-36-32-200Z.csv');
  expect(saveTransferFile).toHaveBeenCalledWith('csv', new Uint8Array([2]));
  expect(screen.queryByText(`Saved: ${uri}`)).toBeNull();
});

test('sample download confirmation also displays a readable path', async () => {
  jest
    .mocked(downloadSampleFile)
    .mockResolvedValue(
      'content://com.android.externalstorage.documents/document/primary%3ADownload%2Fsample.xlsx',
    );
  render(<TransferScreen />);
  await screen.findByText('Vocabulary');
  fireEvent.press(screen.getByText('Download Excel sample'));
  await screen.findByText('Saved: Download/sample.xlsx');
});
