import type { AppClock, AppConfig, AppLogger, IdGenerator } from '@/core/ports/platform';
import { randomUUID } from 'expo-crypto';

export const clock: AppClock = {
  now: () => new Date(),
  timeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
};
export const idGenerator: IdGenerator = { create: randomUUID };
export const config: AppConfig = {
  environment: __DEV__ ? 'development' : 'production',
};
export const logger: AppLogger = {
  info: (message, context) => {
    if (__DEV__) console.info(message, context);
  },
  error: (message, error) => console.error(message, error),
};
