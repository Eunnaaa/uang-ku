import { describe, expect, it } from 'bun:test';
import { formatRupiah, parseRupiah, formatCompactRupiah } from './money';

describe('Money Utilities (Exact Integer Representation)', () => {
  it('formats integer minor units to IDR currency correctly', () => {
    expect(formatRupiah(25000)).toBe('Rp 25.000');
    expect(formatRupiah(15000000)).toBe('Rp 15.000.000');
    expect(formatRupiah(0)).toBe('Rp 0');
    expect(formatRupiah(-45000)).toBe('-Rp 45.000');
  });

  it('formats without prefix when requested', () => {
    expect(formatRupiah(50000, false)).toBe('50.000');
    expect(formatRupiah(-50000, false)).toBe('-50.000');
  });

  it('parses formatted string back into exact integer minor units', () => {
    expect(parseRupiah('Rp 25.000')).toBe(25000);
    expect(parseRupiah('15.000.000')).toBe(15000000);
    expect(parseRupiah('-Rp 45.000')).toBe(-45000);
    expect(parseRupiah('')).toBe(0);
  });

  it('formats compact representation for badges & widgets', () => {
    expect(formatCompactRupiah(15000000)).toBe('Rp 15 jt'); // 15 Juta
    expect(formatCompactRupiah(15000000000)).toBe('Rp 15 M'); // 15 Milyar
    expect(formatCompactRupiah(500000)).toBe('Rp 500 rb'); // 500 Ribu
  });
});
