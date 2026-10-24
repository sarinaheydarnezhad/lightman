import { CloudError } from '@/core/sync/cloud-client';
import type { UiLanguage } from '@/shared/localization/localization';
import type { MessageKey } from '@/shared/localization/messages';

const feedbackKeys: Record<string, MessageKey> = {
  'Only Leitner decks can be transferred with the current backend. Other scheduler data stays local.':
    'migration.reason.scheduler',
  'Unsupported scheduler progress stays local.': 'migration.reason.scheduler',
  'A guest deck language does not meet backend validation. Edit it in guest mode first.':
    'migration.reason.deckLanguage',
  'A guest deck exceeds the backend text limits. Edit it in guest mode first.':
    'migration.reason.deckText',
  'A guest card exceeds the backend sync payload size. Shorten its contents before copying.':
    'migration.reason.cardPayload',
  'A guest card does not meet backend text/example validation. Edit it in guest mode first.':
    'migration.reason.cardText',
  'A card is missing review state. Guest data was preserved; transfer needs repair first.':
    'migration.reason.reviewState',
  'Review progress without complete immutable history cannot safely be transferred.':
    'migration.reason.history',
  'A review history has unsupported scheduler data or relationships.': 'migration.reason.history',
  'Guest review progress cannot be reproduced by the backend UTC-day scheduler. No progress was changed.':
    'migration.reason.calendar',
  'Account decks are missing from the sync feed. A backend sync backfill is required before transfer.':
    'migration.reason.accountSync',
  'Account cards are missing from the sync feed. A backend sync backfill is required before transfer.':
    'migration.reason.accountSync',
  'Account review progress differs from the pulled sync data. Refresh first; legacy progress may require a backend sync backfill.':
    'migration.reason.accountProgress',
  'An account card has no server review state. Finish its initial synchronization or repair the backend state before transfer.':
    'migration.reason.accountProgress',
  'Account permissions expired while preparing the preview. Reconnect and refresh before transferring.':
    'migration.reason.permission',
  'Adding these decks would exceed the current free limits: 1 active deck and 50 active cards. Keep the datasets separate.':
    'migration.reason.limits',
  'The data changed since the preview. Refresh and confirm the new preview.':
    'migration.reason.changed',
  'A transfer operation has a sync conflict. Keep both histories and resolve the conflict before retrying.':
    'migration.reason.conflict',
  'Sign in before transferring guest data.': 'auth.sessionExpired',
  'Account ownership changed. Sign in again.': 'auth.sessionExpired',
  'The authenticated identity does not own this local account. Sign in again.':
    'auth.sessionExpired',
};

export function guestTransferFeedback(
  failure: unknown,
  language: UiLanguage,
  translate: (key: MessageKey) => string,
  fallback: MessageKey,
): string {
  const message =
    typeof failure === 'string' ? failure : failure instanceof Error ? failure.message : '';
  if (language === 'en') return message || translate(fallback);
  if (failure instanceof CloudError) {
    if (failure.code === 'network_error' || failure.status === 0)
      return translate('migration.reason.network');
    if (failure.status === 401) return translate('auth.sessionExpired');
    if (failure.status === 429) return translate('auth.rateLimit');
    if (failure.status === 503) return translate('migration.reason.service');
  }
  return translate(
    (Object.hasOwn(feedbackKeys, message) ? feedbackKeys[message] : undefined) ?? fallback,
  );
}
