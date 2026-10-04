import { createTransferService } from '@/features/transfer/application/transfer-service';
import { csvAdapter } from '@/features/transfer/data/csv-adapter';
import { xlsxAdapter } from '@/features/transfer/data/xlsx-adapter';
import { apkgAdapter } from '@/features/transfer/data/apkg-adapter';
import { application } from './application';
import { repositories } from './repositories';

export { selectTransferFile, shareTransferFile } from '@/features/transfer/data/transfer-files';

export const transferService = createTransferService(application, repositories, {
  csv: csvAdapter,
  xlsx: xlsxAdapter,
  apkg: apkgAdapter,
});
