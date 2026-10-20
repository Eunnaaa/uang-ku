import { describe, expect, it } from 'bun:test';
import { sanitizeCsvCell, generateTransactionsCsv } from './csv';
import { type TransactionModel } from '../types/models';

describe('CSV Utilities & OWASP Formula Injection Defense', () => {
  it('sanitizes cells starting with formula triggers (=, +, -, @, \\t, \\r)', () => {
    expect(sanitizeCsvCell('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
    expect(sanitizeCsvCell('+123456')).toBe("'+123456");
    expect(sanitizeCsvCell('-cmd|/C calc')).toBe("'-cmd|/C calc");
    expect(sanitizeCsvCell('@attacker.com')).toBe("'@attacker.com");
    expect(sanitizeCsvCell('\tmaliciousTab')).toBe("'\tmaliciousTab");
    expect(sanitizeCsvCell('\rmaliciousReturn')).toBe("'\rmaliciousReturn");
  });

  it('preserves normal text without prepending single quote', () => {
    expect(sanitizeCsvCell('Makan siang di warteg')).toBe('Makan siang di warteg');
    expect(sanitizeCsvCell('Belanja bulanan')).toBe('Belanja bulanan');
    expect(sanitizeCsvCell('')).toBe('');
    expect(sanitizeCsvCell(null)).toBe('');
    expect(sanitizeCsvCell(undefined)).toBe('');
  });

  it('escapes double quotes according to RFC 4180', () => {
    expect(sanitizeCsvCell('Kopi "Kenangan" Mantan')).toBe('Kopi ""Kenangan"" Mantan');
  });

  it('generates a valid CSV file with UTF-8 BOM, headers, and rows', () => {
    const mockTx: TransactionModel[] = [
      {
        id: 'tx-1',
        userId: 'u-1',
        accountId: 'acc-1',
        destinationAccountId: null,
        categoryId: 'cat-1',
        type: 'expense',
        amount: 25000,
        transferFee: 0,
        currency: 'IDR',
        note: '=1+1',
        transactionDate: '2026-10-01T12:00:00.000Z',
        clientId: 'cl-1',
        version: 1,
        createdAt: '2026-10-01T12:00:00.000Z',
        updatedAt: '2026-10-01T12:00:00.000Z',
        deletedAt: null,
        account: { id: 'acc-1', name: 'BCA Utama', type: 'bank' },
        category: { id: 'cat-1', name: 'Makanan & Minuman', icon: 'utensils' },
      },
      {
        id: 'tx-2',
        userId: 'u-1',
        accountId: 'acc-1',
        destinationAccountId: 'acc-2',
        categoryId: null,
        type: 'transfer',
        amount: 50000,
        transferFee: 2500,
        currency: 'IDR',
        note: 'Top up GoPay',
        transactionDate: '2026-10-02T15:30:00.000Z',
        clientId: 'cl-2',
        version: 1,
        createdAt: '2026-10-02T15:30:00.000Z',
        updatedAt: '2026-10-02T15:30:00.000Z',
        deletedAt: null,
        account: { id: 'acc-1', name: 'BCA Utama', type: 'bank' },
        destinationAccount: { id: 'acc-2', name: 'GoPay', type: 'e_wallet' },
      },
    ];

    const csv = generateTransactionsCsv(mockTx);

    // Verify UTF-8 BOM
    expect(csv.startsWith('\uFEFF')).toBe(true);

    // Verify Header
    expect(csv).toContain('Tanggal,Waktu,Tipe,Kategori,Nominal (IDR),Dari Akun,Ke Akun,Biaya Admin,Catatan');

    // Verify Formula neutralization in note
    expect(csv).toContain("\"'=1+1\"");

    // Verify Transfer row
    expect(csv).toContain('"Transfer"');
    expect(csv).toContain('"Transfer Antar Akun"');
    expect(csv).toContain('"BCA Utama"');
    expect(csv).toContain('"GoPay"');
    expect(csv).toContain('2500');
  });
});
