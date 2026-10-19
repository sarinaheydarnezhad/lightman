import { createTransferService } from '@/features/transfer/application/transfer-service';
import { csvAdapter } from '@/features/transfer/data/csv-adapter';
import { xlsxAdapter } from '@/features/transfer/data/xlsx-adapter';
import { apkgAdapter } from '@/features/transfer/data/apkg-adapter';
import { activeApplication } from './application';
import { storageScopes } from './repositories';

export {
  selectTransferFile,
  shareTransferFile,
  saveTransferFile,
  downloadSampleFile,
} from '@/features/transfer/data/transfer-files';

const services = new WeakMap<
  object,
  { revision: number; service: ReturnType<typeof createTransferService> }
>();
export const transferService = new Proxy({} as ReturnType<typeof createTransferService>, {
  get: (_target, property) => {
    const scope = storageScopes.current();
    const revision = storageScopes.snapshot().revision;
    let entry = services.get(scope.value);
    if (!entry || entry.revision !== revision) {
      const service = createTransferService(activeApplication(), scope.value, {
        csv: csvAdapter,
        xlsx: xlsxAdapter,
        apkg: apkgAdapter,
      });
      entry = { revision, service };
      services.set(scope.value, entry);
    }
    const { service } = entry;
    const value = Reflect.get(service, property);
    if (typeof value !== 'function') return value;
    return (...args: unknown[]) => {
      storageScopes.assertCurrent(scope, revision);
      const result: unknown = value(...args);
      if (result instanceof Promise)
        return result.then((next: unknown) => {
          storageScopes.assertCurrent(scope, revision);
          return next;
        });
      return result;
    };
  },
});
