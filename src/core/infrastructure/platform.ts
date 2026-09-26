import type { AppClock, AppConfig, AppLogger, IdGenerator } from '@/core/ports/platform';
import { AppError } from '@/core/errors/app-error';
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

export function summarizeErrorForLogging(error: unknown): Record<string, string> | undefined {
  if (error === undefined) {
    return undefined;
  }
  if (error instanceof AppError) {
    return { name: error.name, code: error.code };
  }
  if (error instanceof Error) {
    return { name: error.name };
  }
  return { type: typeof error };
}

export const logger: AppLogger = {
  info: (message, context) => {
    if (__DEV__) console.info(message, context);
  },
  error: (message, error) => {
    if (__DEV__) {
      console.error(message, error);
      return;
    }
    console.error(message, summarizeErrorForLogging(error));
  },
};
