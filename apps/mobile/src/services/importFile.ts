import { Directory, File, Paths } from 'expo-file-system';

export async function readPickedBackup(uri: string) {
  const file = new File(uri);
  const staging = new Directory(Paths.cache, 'DocumentPicker');
  if (file.parentDirectory.uri.replace(/\/$/, '') !== staging.uri.replace(/\/$/, '')) {
    throw new Error('Tidak dapat memastikan lokasi salinan sementara. Pilih ulang cadangan.');
  }
  try {
    if (file.size > 32 * 1024 * 1024) throw new Error('Cadangan lebih besar dari 32 MB.');
    return await file.text();
  } finally {
    if (file.exists) file.delete();
  }
}
