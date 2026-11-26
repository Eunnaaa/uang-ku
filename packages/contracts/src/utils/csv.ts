import { type TransactionModel } from '../types/models';

/**
 * Neutralizes CSV Formula Injection (OWASP standard).
 * Prevents execution of spreadsheet formulas if user-entered fields start with =, +, -, @, \t, or \r.
 */
export function sanitizeCsvCell(text: string | null | undefined): string {
  if (!text) return '';
  let str = String(text);
  if (/^['=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return str.replace(/"/g, '""');
}

/**
 * Generates an RFC 4180 compliant CSV string with UTF-8 BOM for transaction export.
 */
export function generateTransactionsCsv(transactions: TransactionModel[]): string {
  const header = 'Tanggal,Waktu,Tipe,Kategori,Nominal (IDR),Dari Akun,Ke Akun,Biaya Admin,Catatan,Waktu ISO\n';
  const rows = transactions.map((t) => {
    const dateObj = new Date(t.transactionDate);
    const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(dateObj.getDate()).padStart(2,'0')}`;
    const timeStr = !isNaN(dateObj.getTime()) ? dateObj.toTimeString().slice(0, 8) : '00:00:00';
    const typeLabel = t.type === 'income' ? 'Pemasukan' : t.type === 'expense' ? 'Pengeluaran' : 'Transfer';
    const catName = sanitizeCsvCell(t.category?.name || (t.type === 'transfer' ? 'Transfer Antar Akun' : 'Lainnya'));
    const fromAccount = sanitizeCsvCell(t.account?.name || 'Kas');
    const toAccount = sanitizeCsvCell(t.destinationAccount?.name || '');
    const fee = t.transferFee || 0;
    const note = sanitizeCsvCell(t.note || '');

    return `"${dateStr}","${timeStr}","${typeLabel}","${catName}",${t.amount},"${fromAccount}","${toAccount}",${fee},"${note}","${dateObj.toISOString()}"`;
  }).join('\n');

  return '\uFEFF' + header + rows;
}

export function readCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, '');
  const delimiter = input.split(/\r?\n/,1)[0].includes(';') ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false, closed = false;
  for (let i=0; i<input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch !== '"') field += ch;
      else if (input[i+1] === '"') { field += '"'; i++; }
      else { quoted = false; closed = true; }
    } else if (ch === delimiter) {
      row.push(field); field = ''; closed = false;
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i+1] === '\n') i++;
      row.push(field); if (row.some(v=>v.length)) rows.push(row);
      row = []; field = ''; closed = false;
    } else if (ch === '"' && !field && !closed) quoted = true;
    else if (closed || ch === '"') throw new Error('Tanda kutip CSV tidak valid.');
    else field += ch;
  }
  if (quoted) throw new Error('Sel CSV belum ditutup.');
  if (field || row.length || closed) { row.push(field); rows.push(row); }
  return rows;
}
