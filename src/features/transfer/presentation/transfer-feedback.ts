import { AppError } from '@/core/errors/app-error';
import type { MessageKey } from '@/shared/localization/messages';

// Presentation allowlist only: parser/data contracts and original user content are unchanged.
const messages: Record<string, MessageKey> = {
  'Files must be smaller than 50 MB.': 'transfer.fileSize',
  'Anki collection exceeds the 100 MB limit.': 'transfer.ankiSize',
  'Anki collection is too large.': 'transfer.ankiSize',
  'Not a valid Anki package: missing SQLite collection.': 'transfer.ankiInvalid',
  'Missing Anki collection metadata.': 'transfer.ankiInvalid',
  'Anki note requires at least two fields.': 'transfer.ankiInvalid',
  'Empty Anki note.': 'transfer.ankiInvalid',
  'Invalid Anki note.': 'transfer.ankiInvalid',
  'Note has no card or deck.': 'transfer.ankiInvalid',
  'Malformed CSV header.': 'transfer.headersInvalid',
  'Malformed CSV quoting.': 'transfer.invalidRow',
  'No recognized Front and Back headers found.': 'transfer.headersInvalid',
  'No worksheet contains recognized Front and Back headers.': 'transfer.headersInvalid',
  'Ambiguous duplicate headers.': 'transfer.headersInvalid',
  'Examples must be an array of sentence/translation/notes objects.': 'transfer.examplesInvalid',
  'Examples continuation headers must start at Examples and follow consecutively.':
    'transfer.examplesInvalid',
  'Matching deck was deleted. Import into a different deck.': 'transfer.deckDeleted',
  'Selected deck is unavailable.': 'details.deckUnavailableHint',
  'Select and preview a file before confirming.': 'transfer.previewExpired',
  'An import is already being saved.': 'transfer.importBusy',
  'Select a CSV, XLSX, XLS, or Anki .apkg/.colpkg file.': 'transfer.selectFormat',
  'Choose a folder to save the export.': 'transfer.chooseFolder',
  'File sharing is unavailable on this device.': 'transfer.sharingUnavailable',
  'Export is incomplete because a card needs integrity repair. Original records and history were retained; preserve the database before controlled recovery.':
    'transfer.integrityError',
};

export function transferFeedbackKey(failure: unknown, fallback: MessageKey): MessageKey {
  if (failure instanceof AppError && failure.code === 'free-tier-limit') return 'access.restricted';
  const message =
    failure instanceof Error ? failure.message : typeof failure === 'string' ? failure : '';
  return (Object.hasOwn(messages, message) ? messages[message] : undefined) ?? fallback;
}

export function transferLocation(
  location: string,
  t: (key: MessageKey, values: Record<string, string>) => string,
): string {
  const row = /^Row (\d+)$/.exec(location);
  const note = /^Note (\d+)$/.exec(location);
  return row
    ? t('transfer.rowLocation', { number: row[1]! })
    : note
      ? t('transfer.noteLocation', { number: note[1]! })
      : location;
}
