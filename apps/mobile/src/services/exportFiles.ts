import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getActiveUserId } from '../db/sqlite';

function exportDirectory(owner: string) {
  if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(owner)) throw new Error('Pemilik ekspor tidak valid.');
  return new Directory(Paths.cache,'uangku-exports',owner);
}

export async function shareExport(owner: string, text: string, backup = false) {
  if (!await Sharing.isAvailableAsync()) throw new Error('Berbagi berkas tidak tersedia di perangkat ini.');
  if (owner !== getActiveUserId()) throw new Error('Akun aktif telah berubah.');
  const dir = exportDirectory(owner);
  dir.create({ intermediates: true,idempotent: true });
  const file = new File(dir,`UangKu_${crypto.randomUUID()}.${backup ? 'ukbak' : 'csv'}`);
  try {
    await file.write(text);
    if (owner !== getActiveUserId()) throw new Error('Akun aktif telah berubah.');
    await Sharing.shareAsync(file.uri,{mimeType: backup ? 'application/json' : 'text/csv',
      UTI: backup ? 'public.json' : 'public.comma-separated-values-text',dialogTitle: backup ? 'Simpan cadangan' : 'Ekspor CSV'});
  } finally {
    if (file.exists) file.delete();
  }
}

export function clearExportCache(owner: string) {
  const dir = exportDirectory(owner);
  if (dir.exists) dir.delete();
  // Previous versions staged these specific temporary files directly in the app cache.
  const legacy = /^UangKu_(?:Export_\d{4}-\d\d-\d\d\.csv|Laporan_\d{4}_\d\d\.csv|Backup_\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d\.ukbak)$/;
  for (const item of Paths.cache.list()) if (item instanceof File && legacy.test(item.name)) item.delete();
}
