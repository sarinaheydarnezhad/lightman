import { AppError } from '@/core/errors/app-error';

export function mapDatabaseError(
  error: unknown,
  message = 'Unable to access local data.',
): AppError {
  if (error instanceof AppError) return error;
  const text = error instanceof Error ? error.message.toLowerCase() : '';
  if (text.includes('free_tier_dataset_limit'))
    return new AppError(
      'free-tier-limit',
      'Study and creation require Plus when data exceeds 1 active deck or 50 active cards. Existing data is preserved; viewing, editing and export remain available.',
      error,
    );
  if (text.includes('free_tier_deck_limit'))
    return new AppError(
      'free-tier-limit',
      'The free plan allows 1 active deck. Existing data is preserved.',
      error,
    );
  if (text.includes('free_tier_card_limit'))
    return new AppError(
      'free-tier-limit',
      'The free plan allows 50 active cards in total. Existing data is preserved.',
      error,
    );
  if (text.includes('unique constraint') || text.includes('already exists')) {
    return new AppError('conflict', 'The local record already exists.', error);
  }
  return new AppError('persistence', message, error);
}

export async function databaseOperation<T>(
  operation: () => Promise<T>,
  message = 'Unable to access local data.',
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw mapDatabaseError(error, message);
  }
}
