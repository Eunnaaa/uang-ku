import { describe, expect, it } from 'bun:test';
import { createTemplateSchema, updateTemplateSchema } from './templates';

describe('Transaction Templates Schema Validation (PRD Section 59)', () => {
  it('validates a valid template creation successfully', () => {
    const valid = {
      name: 'Kopi Kenangan Pagi',
      templatePayload: {
        amount: 25000,
        categoryId: 'c1000000-0000-0000-0000-000000000001',
        accountId: 'a1000000-0000-0000-0000-000000000001',
        type: 'expense' as const,
        note: 'Kopi Kenangan Mantan Large',
        currency: 'IDR',
      },
    };
    const parsed = createTemplateSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe('Kopi Kenangan Pagi');
      expect(parsed.data.sortOrder).toBe(0);
      expect(parsed.data.templatePayload.amount).toBe(25000);
    }
  });

  it('rejects template with empty name or name exceeding 50 chars', () => {
    const emptyName = {
      name: '',
      templatePayload: {
        amount: 25000,
        accountId: 'a1000000-0000-0000-0000-000000000001',
        type: 'expense' as const,
      },
    };
    expect(createTemplateSchema.safeParse(emptyName).success).toBe(false);

    const longName = {
      name: 'a'.repeat(51),
      templatePayload: {
        amount: 25000,
        accountId: 'a1000000-0000-0000-0000-000000000001',
        type: 'expense' as const,
      },
    };
    expect(createTemplateSchema.safeParse(longName).success).toBe(false);
  });

  it('rejects non-positive amount in template payload', () => {
    const zeroAmount = {
      name: 'Gratis',
      templatePayload: {
        amount: 0,
        accountId: 'a1000000-0000-0000-0000-000000000001',
        type: 'expense' as const,
      },
    };
    expect(createTemplateSchema.safeParse(zeroAmount).success).toBe(false);
  });

  it('validates partial update of template', () => {
    const update = {
      name: 'Kopi Sore',
      sortOrder: 2,
      useCount: 15,
    };
    expect(updateTemplateSchema.safeParse(update).success).toBe(true);
  });
});
