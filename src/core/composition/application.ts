import { createApplication, type Application } from '@/core/application/create-application';
import { clock, idGenerator, logger } from '@/core/infrastructure/platform';
import { AppState } from 'react-native';
import { storageScopes } from './repositories';
import { expoNotificationService } from '@/core/infrastructure/expo-notification-service';
import type { LocalScope } from '@/core/storage/local-storage-scopes';
import type { Repositories } from '@/core/ports/repositories';
import { learningAccess } from './learning-access';

const applications = new WeakMap<Repositories, Application>();
let cachedRepositories: Repositories | null = null;
let observingScopes = false;
const reminderMutations = new Set<PropertyKey>([
  'createDeck',
  'updateDeck',
  'archiveDeck',
  'createCard',
  'updateCard',
  'archiveCard',
  'reviewCard',
  'submitStudyAnswer',
]);

export async function refreshStudyReminder(): Promise<void> {
  if (storageScopes.snapshot().phase !== 'ready') return;
  const revision = storageScopes.snapshot().revision;
  try {
    await activeApplication().settings.reconcileReminder();
  } catch (error) {
    if (storageScopes.snapshot().revision !== revision) return;
    await expoNotificationService.cancelDailyReminder().catch(() => {});
    logger.error('Unable to refresh study reminders', error);
  }
}

function guarded<Services extends object>(
  services: Services,
  scope: LocalScope<Repositories>,
): Services {
  const methods = new Map<PropertyKey, unknown>();
  const revision = storageScopes.snapshot().revision;
  return new Proxy(services, {
    get: (target, property) => {
      const value = Reflect.get(target, property);
      if (typeof value !== 'function') return value;
      if (!methods.has(property))
        methods.set(property, (...args: unknown[]) => {
          storageScopes.assertCurrent(scope, revision);
          const result: unknown = Reflect.apply(value, target, args);
          if (result instanceof Promise)
            return result.then(async (next: unknown) => {
              storageScopes.assertCurrent(scope, revision);
              if (reminderMutations.has(property)) await refreshStudyReminder();
              storageScopes.assertCurrent(scope, revision);
              return next;
            });
          return result;
        });
      return methods.get(property);
    },
    set: (target, property, value) => {
      methods.set(property, value);
      return Reflect.set(target, property, value);
    },
  });
}

export function activeApplication(): Application {
  if (!observingScopes) {
    storageScopes.subscribe(() => {
      if (
        cachedRepositories &&
        (storageScopes.snapshot().phase !== 'ready' ||
          storageScopes.current().value !== cachedRepositories)
      ) {
        applications.delete(cachedRepositories);
        cachedRepositories = null;
      }
      if (storageScopes.snapshot().phase !== 'ready') {
        void expoNotificationService
          .cancelDailyReminder()
          .catch((error: unknown) =>
            logger.error('Unable to clear previous study reminders', error),
          );
      } else {
        void refreshStudyReminder();
      }
    });
    AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshStudyReminder();
    });
    observingScopes = true;
  }
  const scope = storageScopes.current();
  cachedRepositories = scope.value;
  let current = applications.get(scope.value);
  if (!current) {
    const revision = storageScopes.snapshot().revision;
    const created = createApplication(
      scope.value,
      clock,
      idGenerator,
      {
        ...expoNotificationService,
        scheduleDailyReminder: (time, language, plan) => {
          storageScopes.assertCurrent(scope, revision);
          return expoNotificationService.scheduleDailyReminder(time, language, plan);
        },
        cancelDailyReminder: () => {
          storageScopes.assertCurrent(scope, revision);
          return expoNotificationService.cancelDailyReminder();
        },
      },
      undefined,
      learningAccess(),
    );
    current = guarded({ ...created, settings: guarded(created.settings, scope) }, scope);
    applications.set(scope.value, current);
  }
  return current;
}

const settings = new Proxy({} as Application['settings'], {
  ownKeys: () => Reflect.ownKeys(activeApplication().settings),
  getOwnPropertyDescriptor: (_target, property) => {
    const descriptor = Reflect.getOwnPropertyDescriptor(activeApplication().settings, property);
    return descriptor
      ? {
          ...descriptor,
          configurable: true,
          value: Reflect.get(activeApplication().settings, property),
        }
      : undefined;
  },
  set: (_target, property, value) => Reflect.set(activeApplication().settings, property, value),
  get: (_target, property) => {
    if (property === 'snapshot')
      return () =>
        storageScopes.snapshot().phase === 'ready' ? activeApplication().settings.snapshot() : null;
    if (property === 'subscribe')
      return (listener: () => void) => {
        let unsubscribe = () => {};
        const connect = () => {
          unsubscribe();
          unsubscribe =
            storageScopes.snapshot().phase === 'ready'
              ? activeApplication().settings.subscribe(listener)
              : () => {};
          listener();
        };
        const stop = storageScopes.subscribe(connect);
        connect();
        return () => {
          stop();
          unsubscribe();
        };
      };
    return Reflect.get(activeApplication().settings, property);
  },
});

export const application: Application = new Proxy({} as Application, {
  ownKeys: () => Reflect.ownKeys(activeApplication()),
  getOwnPropertyDescriptor: (_target, property) => {
    const descriptor = Reflect.getOwnPropertyDescriptor(activeApplication(), property);
    return descriptor
      ? { ...descriptor, configurable: true, value: Reflect.get(activeApplication(), property) }
      : undefined;
  },
  set: (_target, property, value) => Reflect.set(activeApplication(), property, value),
  get: (_target, property) =>
    property === 'settings' ? settings : Reflect.get(activeApplication(), property),
});
