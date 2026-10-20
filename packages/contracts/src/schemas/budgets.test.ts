import { describe, expect, it } from 'bun:test';
import { createBudgetSchema, updateBudgetSchema } from './budgets';

describe('Budget Schema Validation (PRD Section 60)', () => {
  it('validates a valid budget creation payload', () => {
    const valid = {
      categoryId: 'c1000000-0000-0000-0000-000000000001',
      amount: 1500000,
      currency: 'IDR',
      period: 'monthly',
    };
    const result = createBudgetSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(1500000);
      expect(result.data.period).toBe('monthly');
    }
  });

  it('rejects budget with negative or non-integer amount', () => {
    const invalidAmount = {
      categoryId: 'c1000000-0000-0000-0000-000000000001',
      amount: -50000,
    };
    const res = createBudgetSchema.safeParse(invalidAmount);
    expect(res.success).toBe(false);

    const floatAmount = {
      categoryId: 'c1000000-0000-0000-0000-000000000001',
      amount: 1500.5,
    };
    const resFloat = createBudgetSchema.safeParse(floatAmount);
    expect(resFloat.success).toBe(false);
  });

  it('validates partial update of budget', () => {
    const update = {
      amount: 2000000,
      isActive: false,
    };
    const result = updateBudgetSchema.safeParse(update);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(2000000);
      expect(result.data.isActive).toBe(false);
    }
  });
});
