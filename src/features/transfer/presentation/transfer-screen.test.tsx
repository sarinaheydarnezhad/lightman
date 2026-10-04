import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { application } from '@/core/composition/application';
import {
  transferService,
  selectTransferFile,
  shareTransferFile,
} from '@/core/composition/transfer';
import { makeDeck } from '@/../test/fixtures';
import { TransferScreen } from './transfer-screen';

jest.setTimeout(20_000);

jest.mock('@/core/composition/application', () => ({ application: { listDecks: jest.fn() } }));
jest.mock('@/core/composition/transfer', () => ({
  selectTransferFile: jest.fn(),
  shareTransferFile: jest.fn(),
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
});

test('selection parses to preview; nothing saves before explicit confirmation', async () => {
  render(<TransferScreen />);
  await waitFor(() => expect(application.listDecks).toHaveBeenCalled());
  fireEvent.press(screen.getByText('Select file'));
  await screen.findByText('Import preview');
  expect(
    screen.getByText('Format: CSV\nTotal cards: 3\nNew cards: 1\nDuplicates: 1\nInvalid rows: 1'),
  ).toBeTruthy();
  expect(screen.getByText('Decks: Vocabulary')).toBeTruthy();
  expect(screen.getByText('Row 4: Missing back')).toBeTruthy();
  expect(transferService.confirm).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Confirm import'));
  await screen.findByText('Imported: 1\nDuplicates skipped: 1\nInvalid / skipped rows: 1');
  expect(transferService.confirm).toHaveBeenCalledTimes(1);
});

test('cancelling a preview does not save any cards', async () => {
  render(<TransferScreen />);
  fireEvent.press(screen.getByText('Select file'));
  await screen.findByText('Import preview');
  fireEvent.press(screen.getByText('Cancel'));
  expect(transferService.cancel).toHaveBeenCalledTimes(1);
  expect(transferService.confirm).not.toHaveBeenCalled();
  expect(screen.queryByText('Import preview')).toBeNull();
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
  expect(transferService.export).toHaveBeenCalledWith('xlsx', 'deck-1');
  fireEvent.press(screen.getByText('All decks'));
  fireEvent.press(screen.getByText('Anki (.apkg)'));
  fireEvent.press(screen.getByText('Share / Save file'));
  await waitFor(() => expect(transferService.export).toHaveBeenCalledWith('apkg', undefined));
});
