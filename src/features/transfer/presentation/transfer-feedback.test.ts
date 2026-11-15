import { AppError } from '@/core/errors/app-error';
import { translate } from '@/shared/localization/localization';
import { transferFeedbackKey, transferLocation } from './transfer-feedback';

test.each(['en', 'fa'] as const)(
  'file recovery is localized and never exposes an unknown exception in %s',
  (language) => {
    expect(
      transferFeedbackKey(new AppError('free-tier-limit', 'quota'), 'transfer.operationError'),
    ).toBe('access.restricted');
    expect(
      transferFeedbackKey(
        new Error('Files must be smaller than 50 MB.'),
        'transfer.operationError',
      ),
    ).toBe('transfer.fileSize');
    expect(
      translate(
        language,
        transferFeedbackKey(new Error('private-provider-payload'), 'transfer.operationError'),
      ),
    ).toBe(translate(language, 'transfer.operationError'));
    expect(transferLocation('Row 4', (key, values) => translate(language, key, values))).toBe(
      translate(language, 'transfer.rowLocation', { number: '4' }),
    );
    // User-supplied sheet labels are preserved as content, never interpreted as a dictionary key.
    expect(transferLocation('My sheet', (key, values) => translate(language, key, values))).toBe(
      'My sheet',
    );
  },
);
