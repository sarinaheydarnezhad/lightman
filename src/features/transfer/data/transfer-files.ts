import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import type { TransferFormat } from '../domain/transfer';
import { xlsxAdapter } from './xlsx-adapter';

const mimeTypes: Record<TransferFormat, string> = {
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  apkg: 'application/octet-stream',
};
const extensionFor = (format: TransferFormat) => (format === 'apkg' ? 'colpkg' : format);

export async function selectTransferFile(): Promise<{
  name: string;
  format: TransferFormat;
  bytes: Uint8Array;
} | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    multiple: false,
    copyToCacheDirectory: true,
    base64: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  try {
    const extension = asset.name.split('.').pop()?.toLowerCase();
    const format: TransferFormat = extension === 'colpkg' ? 'apkg' : (extension as TransferFormat);
    if (format !== 'csv' && format !== 'xlsx' && format !== 'apkg')
      throw new Error('Select a CSV, XLSX, XLS, or Anki .apkg/.colpkg file.');
    if ((asset.size ?? 0) > 50 * 1024 * 1024) throw new Error('Files must be smaller than 50 MB.');
    const bytes = asset.file
      ? new Uint8Array(await asset.file.arrayBuffer())
      : await new File(asset.uri).bytes();
    return { name: asset.name, format, bytes };
  } finally {
    if (Platform.OS !== 'web' && asset.uri.startsWith(Paths.cache.uri)) {
      const cached = new File(asset.uri);
      if (cached.exists) cached.delete();
    }
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

export async function saveTransferFile(format: TransferFormat, bytes: Uint8Array): Promise<string> {
  const name = `lerona-${new Date().toISOString().replace(/[:.]/g, '-')}.${extensionFor(format)}`;
  if (Platform.OS === 'web') {
    const blob = new Blob([new Uint8Array(bytes).buffer], { type: mimeTypes[format] });
    const uri = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = uri;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(uri), 60_000);
    return name;
  }
  if (Platform.OS === 'android') {
    const permission =
      await LegacyFileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permission.granted) throw new Error('Choose a folder to save the export.');
    const uri = await LegacyFileSystem.StorageAccessFramework.createFileAsync(
      permission.directoryUri,
      name,
      mimeTypes[format],
    );
    await LegacyFileSystem.StorageAccessFramework.writeAsStringAsync(uri, toBase64(bytes), {
      encoding: LegacyFileSystem.EncodingType.Base64,
    });
    return uri;
  }
  const file = new File(Paths.document, name);
  file.create();
  file.write(bytes);
  return file.uri;
}

export async function shareTransferFile(format: TransferFormat, bytes: Uint8Array) {
  const name = `lerona-${new Date().toISOString().replace(/[:.]/g, '-')}.${extensionFor(format)}`;
  if (Platform.OS === 'web') return saveTransferFile(format, bytes);
  if (!(await Sharing.isAvailableAsync()))
    throw new Error('File sharing is unavailable on this device.');
  const file = new File(Paths.cache, name);
  try {
    file.create();
    file.write(bytes);
    await Sharing.shareAsync(file.uri, {
      mimeType: mimeTypes[format],
      UTI:
        format === 'csv'
          ? 'public.comma-separated-values-text'
          : format === 'xlsx'
            ? 'org.openxmlformats.spreadsheetml.sheet'
            : 'public.data',
    });
    return file.uri;
  } catch (error) {
    if (file.exists) file.delete();
    throw error;
  }
}

export async function downloadSampleFile(): Promise<string> {
  const bytes = await xlsxAdapter.serialize(
    [
      {
        deckName: 'Sample deck',
        frontText: 'Hello',
        meaning: 'A greeting',
        phonetic: "/h?'lo?/",
        category: 'phrase',
        examples: [{ sentence: 'Hello, friend.' }],
      },
    ],
    ['Sample deck'],
  );
  return saveTransferFile('xlsx', bytes);
}
