import { AppError } from '@/core/errors/app-error';

export function mapDatabaseError(
  error: unknown,
  message = 'Unable to access local data.',
): AppError {
  if (error instanceof AppError) return error;
  const text = error instanceof Error ? error.message.toLowerCase() : '';
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
