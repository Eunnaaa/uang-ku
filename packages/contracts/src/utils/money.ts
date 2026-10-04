/**
 * Money utilities for exact integer minor unit representation (IDR).
 * Rp 25.000 is stored as integer 25000.
 */

export function formatRupiah(amount: number, withPrefix = true): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(Math.round(amount));
  const formattedNumber = absAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  if (withPrefix) {
    return isNegative ? `-Rp ${formattedNumber}` : `Rp ${formattedNumber}`;
  }
  return isNegative ? `-${formattedNumber}` : formattedNumber;
}

export function parseRupiah(raw: string): number {
  if (!raw) return 0;
  // Strip non-digit characters except minus sign
  const cleaned = raw.replace(/[^\d-]/g, '');
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? 0 : parsed;
}

export function formatCompactRupiah(amount: number): string {
  const abs = Math.abs(amount);
  const prefix = amount < 0 ? '-Rp ' : 'Rp ';
  if (abs >= 1_000_000_000_000) {
    return `${prefix}${(abs / 1_000_000_000_000).toFixed(1).replace('.0', '')} T`;
  }
  if (abs >= 1_000_000_000) {
    return `${prefix}${(abs / 1_000_000_000).toFixed(1).replace('.0', '')} M`;
  }
  if (abs >= 1_000_000) {
    return `${prefix}${(abs / 1_000_000).toFixed(1).replace('.0', '')} jt`;
  }
  if (abs >= 1_000) {
    return `${prefix}${(abs / 1_000).toFixed(0)} rb`;
  }
  return formatRupiah(amount);
}
