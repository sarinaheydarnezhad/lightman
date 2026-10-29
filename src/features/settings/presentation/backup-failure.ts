import { CloudError } from '@/core/sync/cloud-client';
import type { MessageKey } from '@/shared/localization/messages';

export function backupFailureMessage(error: unknown): MessageKey {
  if (error instanceof CloudError) {
    if (error.code === 'backups_unavailable') return 'backup.configurationError';
    if (error.code === 'backup_capacity_reached') return 'backup.capacityError';
    if (error.status === 401) return 'backup.authError';
    if (error.status === 0) return 'backup.networkError';
    if (error.status === 429) return 'backup.rateError';
    if (error.status === 503 || error.status === 404) return 'backup.unavailable';
    if (error.status === 413) return 'backup.sizeError';
  }
  return 'backup.error';
}
