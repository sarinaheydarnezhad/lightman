export type AppErrorCode =
  | 'validation'
  | 'not-found'
  | 'conflict'
  | 'persistence'
  | 'unavailable'
  | 'unexpected'
  | 'free-tier-limit';

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
