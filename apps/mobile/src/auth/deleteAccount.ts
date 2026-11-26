import { clearAllLocalTransactions } from '../db/sqlite';

export async function deleteAccountData(base: string, user: { id: string; isGuest?: boolean }, token: string | null, password?: string) {
  if (!user.isGuest) {
    if (!token) throw new Error('Masuk kembali untuk menghapus akun.');
    if (!password) throw new Error('Masukkan kata sandi untuk mengonfirmasi penghapusan.');
    const res = await fetch(`${base}/api/v1/auth/me`, { method: 'DELETE', headers: {
      Authorization: `Bearer ${token}`, 'Content-Type':'application/json' }, body: JSON.stringify({ password }) });
    if (res.status === 401) throw new Error('Kata sandi atau sesi tidak valid. Masuk kembali sebelum mencoba lagi.');
    if (!res.ok || (await res.json()).data?.userId !== user.id) {
      throw new Error('Server belum mengonfirmasi penghapusan. Data lokal tetap tersimpan.');
    }
  }
  (await import('../services/receiptFiles')).deleteReceiptFiles(user.id);
  (await import('../services/exportFiles')).clearExportCache(user.id);
  await clearAllLocalTransactions(user.id, true);
}
