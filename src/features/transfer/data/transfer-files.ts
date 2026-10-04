import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { TransferFormat } from '../domain/transfer';

const mimeTypes: Record<TransferFormat, string> = {
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  apkg: 'application/octet-stream',
};

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
    if (extension !== 'csv' && extension !== 'xlsx' && extension !== 'apkg') {
      throw new Error('Select a CSV, XLSX, or Anki APKG file.');
    }
    if ((asset.size ?? 0) > 50 * 1024 * 1024) throw new Error('Files must be smaller than 50 MB.');
    const bytes = asset.file
      ? new Uint8Array(await asset.file.arrayBuffer())
      : await new File(asset.uri).bytes();
    return { name: asset.name, format: extension, bytes };
  } finally {
    if (Platform.OS !== 'web' && asset.uri.startsWith(Paths.cache.uri)) {
      const cached = new File(asset.uri);
      if (cached.exists) cached.delete();
    }
  }
}

export async function shareTransferFile(format: TransferFormat, bytes: Uint8Array) {
  const name = `lightman-${new Date().toISOString().replace(/[:.]/g, '-')}.${format}`;
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
    return;
  }
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
  } catch (error) {
    if (file.exists) file.delete();
    throw error;
  }
}
