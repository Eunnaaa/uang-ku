import { describe, expect, it } from 'bun:test';
import { createTransactionSchema } from './transactions';

describe('Transaction Schema Validation', () => {
  it('validates a normal expense transaction successfully', () => {
    const validExpense = {
      accountId: '00000000-0000-0000-0000-000000000001',
      categoryId: '00000000-0000-0000-0000-000000000002',
      type: 'expense' as const,
      amount: 45000,
      currency: 'IDR',
      note: 'Lunch meeting',
      transactionDate: '2026-10-04T12:00:00.000Z',
      clientId: '00000000-0000-0000-0000-000000000003',
    };
    const result = createTransactionSchema.safeParse(validExpense);
    expect(result.success).toBe(true);
  });

  it('validates a transfer between two distinct accounts', () => {
    const validTransfer = {
      accountId: '00000000-0000-0000-0000-000000000001',
      destinationAccountId: '00000000-0000-0000-0000-000000000002',
      type: 'transfer' as const,
      amount: 500000,
      transferFee: 2500,
      currency: 'IDR',
      note: 'Transfer BCA ke GoPay',
      transactionDate: '2026-10-04T12:00:00.000Z',
      clientId: '00000000-0000-0000-0000-000000000003',
    };
    const result = createTransactionSchema.safeParse(validTransfer);
    expect(result.success).toBe(true);
  });

  it('rejects a transfer if destination account is the same as source account', () => {
    const invalidTransfer = {
      accountId: '00000000-0000-0000-0000-000000000001',
      destinationAccountId: '00000000-0000-0000-0000-000000000001', // Same account!
      type: 'transfer' as const,
      amount: 100000,
      transactionDate: '2026-10-04T12:00:00.000Z',
      clientId: '00000000-0000-0000-0000-000000000003',
    };
    const result = createTransactionSchema.safeParse(invalidTransfer);
    expect(result.success).toBe(false);
  });

  it('rejects an expense if category is missing', () => {
    const missingCategory = {
      accountId: '00000000-0000-0000-0000-000000000001',
      type: 'expense' as const,
      amount: 50000,
      transactionDate: '2026-10-04T12:00:00.000Z',
      clientId: '00000000-0000-0000-0000-000000000003',
    };
    const result = createTransactionSchema.safeParse(missingCategory);
    expect(result.success).toBe(false);
  });

  it('rejects non-positive and float amounts', () => {
    const zeroAmount = {
      accountId: '00000000-0000-0000-0000-000000000001',
      categoryId: '00000000-0000-0000-0000-000000000002',
      type: 'expense' as const,
      amount: 0,
      transactionDate: '2026-10-04T12:00:00.000Z',
      clientId: '00000000-0000-0000-0000-000000000003',
    };
    expect(createTransactionSchema.safeParse(zeroAmount).success).toBe(false);

    const floatAmount = { ...zeroAmount, amount: 25000.5 };
    expect(createTransactionSchema.safeParse(floatAmount).success).toBe(false);
  });
});
