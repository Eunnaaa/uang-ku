import { describe, expect, it } from 'bun:test';
import { createRecurringRuleSchema, updateRecurringRuleSchema } from './recurring';

describe('Recurring Rules Schema Validation (PRD Section 58)', () => {
  it('validates a valid recurring rule payload', () => {
    const valid = {
      accountId: 'a1000000-0000-0000-0000-000000000001',
      categoryId: 'c1000000-0000-0000-0000-000000000001',
      type: 'expense',
      amount: 45000,
      frequency: 'monthly',
      note: 'Spotify Family Subscription',
    };
    const res = createRecurringRuleSchema.safeParse(valid);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.amount).toBe(45000);
      expect(res.data.frequency).toBe('monthly');
    }
  });

  it('rejects recurring rule with transfer type (only income or expense permitted)', () => {
    const transferRule = {
      accountId: 'a1000000-0000-0000-0000-000000000001',
      type: 'transfer',
      amount: 100000,
      frequency: 'monthly',
    };
    const res = createRecurringRuleSchema.safeParse(transferRule);
    expect(res.success).toBe(false);
  });

  it('validates partial update of recurring rule', () => {
    const update = {
      amount: 55000,
      isActive: false,
    };
    const res = updateRecurringRuleSchema.safeParse(update);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.amount).toBe(55000);
      expect(res.data.isActive).toBe(false);
    }
  });
});
