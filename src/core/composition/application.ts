import { createApplication, type Application } from '@/core/application/create-application';
import { clock, idGenerator } from '@/core/infrastructure/platform';
import { storageScopes } from './repositories';
import { expoNotificationService } from '@/core/infrastructure/expo-notification-service';
import type { LocalScope } from '@/core/storage/local-storage-scopes';
import type { Repositories } from '@/core/ports/repositories';

const applications = new WeakMap<Repositories, Application>();
let cachedRepositories: Repositories | null = null;
let observingScopes = false;

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
            return result.then((next: unknown) => {
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
    });
    observingScopes = true;
  }
  const scope = storageScopes.current();
  cachedRepositories = scope.value;
  let current = applications.get(scope.value);
  if (!current) {
    const created = createApplication(scope.value, clock, idGenerator, expoNotificationService);
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
