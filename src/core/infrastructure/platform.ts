import type { AppClock, AppConfig, AppLogger, IdGenerator } from '@/core/ports/platform';
import { randomUUID } from 'expo-crypto';
import Constants from 'expo-constants';

export const clock: AppClock = {
  now: () => new Date(),
  timeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
};
export const idGenerator: IdGenerator = { create: randomUUID };
export const config: AppConfig = {
  environment: __DEV__ ? 'development' : 'production',
  dictionaryApiBaseUrl: 'https://api.dictionaryapi.dev/api/v2',
  appName: Constants.expoConfig?.name ?? 'Lightman',
  appVersion: Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? null,
  buildNumber:
    Constants.nativeBuildVersion ??
    Constants.expoConfig?.ios?.buildNumber ??
    (Constants.expoConfig?.android?.versionCode
      ? String(Constants.expoConfig.android.versionCode)
      : null),
};
export const logger: AppLogger = {
  info: (message, context) => {
    if (__DEV__) console.info(message, context);
  },
  error: (message, error) => console.error(message, error),
};
