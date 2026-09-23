export interface AppLogger {
  info(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: unknown): void;
}

export interface AppClock {
  now(): Date;
}

export interface IdGenerator {
  create(): string;
}

export interface AppConfig {
  readonly environment: 'development' | 'production' | 'test';
}
