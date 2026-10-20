import { type TransactionModel } from '../types/models';

/**
 * Neutralizes CSV Formula Injection (OWASP standard).
 * Prevents execution of spreadsheet formulas if user-entered fields start with =, +, -, @, \t, or \r.
 */
export function sanitizeCsvCell(text: string | null | undefined): string {
  if (!text) return '';
  let str = String(text);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return str.replace(/"/g, '""');
}

/**
 * Generates an RFC 4180 compliant CSV string with UTF-8 BOM for transaction export.
 */
export function generateTransactionsCsv(transactions: TransactionModel[]): string {
  const header = 'Tanggal,Waktu,Tipe,Kategori,Nominal (IDR),Dari Akun,Ke Akun,Biaya Admin,Catatan\n';
  const rows = transactions.map((t) => {
    const dateObj = new Date(t.transactionDate);
    const dateStr = !isNaN(dateObj.getTime()) ? dateObj.toISOString().slice(0, 10) : t.transactionDate;
    const timeStr = !isNaN(dateObj.getTime()) ? dateObj.toTimeString().slice(0, 8) : '00:00:00';
    const typeLabel = t.type === 'income' ? 'Pemasukan' : t.type === 'expense' ? 'Pengeluaran' : 'Transfer';
    const catName = sanitizeCsvCell(t.category?.name || (t.type === 'transfer' ? 'Transfer Antar Akun' : 'Lainnya'));
    const fromAccount = sanitizeCsvCell(t.account?.name || 'Kas');
    const toAccount = sanitizeCsvCell(t.destinationAccount?.name || '');
    const fee = t.transferFee || 0;
    const note = sanitizeCsvCell(t.note || '');

    return `"${dateStr}","${timeStr}","${typeLabel}","${catName}",${t.amount},"${fromAccount}","${toAccount}",${fee},"${note}"`;
  }).join('\n');

  return '\uFEFF' + header + rows;
}
