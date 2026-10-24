import { CloudError } from '@/core/sync/cloud-client';
import { en, fa } from '@/shared/localization/messages';
import { translate } from '@/shared/localization/localization';
import { guestTransferFeedback } from './guest-transfer-feedback';

test.each([
  [
    'Only Leitner decks can be transferred with the current backend. Other scheduler data stays local.',
    'migration.reason.scheduler',
  ],
  [
    'Account decks are missing from the sync feed. A backend sync backfill is required before transfer.',
    'migration.reason.accountSync',
  ],
  [
    'The data changed since the preview. Refresh and confirm the new preview.',
    'migration.reason.changed',
  ],
  ['Sign in before transferring guest data.', 'auth.sessionExpired'],
] as const)('Persian transfer feedback translates %s', (message, key) => {
  expect(
    guestTransferFeedback(message, 'fa', (key) => translate('fa', key), 'migration.blocked'),
  ).toBe(fa[key]);
});

test.each([
  [0, 'migration.reason.network'],
  [401, 'auth.sessionExpired'],
  [429, 'auth.rateLimit'],
  [503, 'migration.reason.service'],
] as const)('Persian cloud failure %s has a translated action', (status, key) => {
  expect(
    guestTransferFeedback(
      new CloudError(status),
      'fa',
      (key) => translate('fa', key),
      'migration.failure',
    ),
  ).toBe(fa[key]);
});

test('unrecognized Persian errors and blockers show safe localized fallback text', () => {
  const message = 'Microsoft.Data.SqlClient.SqlException: internal details';
  expect(
    guestTransferFeedback(
      new Error(message),
      'fa',
      (key) => translate('fa', key),
      'migration.failure',
    ),
  ).toBe(fa['migration.failure']);
  expect(
    guestTransferFeedback(message, 'fa', (key) => translate('fa', key), 'migration.blocked'),
  ).toBe(fa['migration.blocked']);
  expect(
    guestTransferFeedback('toString', 'fa', (key) => translate('fa', key), 'migration.blocked'),
  ).toBe(fa['migration.blocked']);
});

test('English diagnostic feedback remains available without changing transfer behavior', () => {
  expect(
    guestTransferFeedback(
      new Error('Backup offline'),
      'en',
      (key) => translate('en', key),
      'migration.failure',
    ),
  ).toBe('Backup offline');
  expect(
    guestTransferFeedback(null, 'en', (key) => translate('en', key), 'migration.failure'),
  ).toBe(en['migration.failure']);
});
