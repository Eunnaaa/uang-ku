import { describe, expect, it } from 'bun:test';
import { createAccountSchema, updateAccountSchema } from './accounts';

describe('Accounts Schema Validation', () => {
  it('validates a valid account creation payload', () => {
    const valid = {
      name: 'Rekening Jenius',
      type: 'bank' as const,
      currency: 'IDR',
      initialBalance: 1000000,
    };
    const parsed = createAccountSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('sets default currency IDR and initialBalance 0 when omitted', () => {
    const minimal = {
      name: 'Dompet Saku',
      type: 'cash' as const,
    };
    const parsed = createAccountSchema.safeParse(minimal);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.currency).toBe('IDR');
      expect(parsed.data.initialBalance).toBe(0);
    }
  });

  it('rejects account with empty name', () => {
    const invalid = {
      name: '',
      type: 'cash' as const,
    };
    const parsed = createAccountSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it('rejects negative initial balance or float balance', () => {
    const negative = {
      name: 'Hutang',
      type: 'other' as const,
      initialBalance: -5000,
    };
    expect(createAccountSchema.safeParse(negative).success).toBe(false);

    const floatBal = {
      name: 'Koin',
      type: 'cash' as const,
      initialBalance: 12500.5,
    };
    expect(createAccountSchema.safeParse(floatBal).success).toBe(false);
  });

  it('rejects invalid account types', () => {
    const invalidType = {
      name: 'Crypto Wallet',
      type: 'crypto',
    };
    expect(createAccountSchema.safeParse(invalidType).success).toBe(false);
  });

  it('validates partial account update schema', () => {
    const update = {
      name: 'BCA Prioritas',
      isArchived: true,
    };
    const parsed = updateAccountSchema.safeParse(update);
    expect(parsed.success).toBe(true);
  });
});
