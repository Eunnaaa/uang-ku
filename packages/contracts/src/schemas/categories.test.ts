import { describe, expect, it } from 'bun:test';
import { createCategorySchema, updateCategorySchema } from './categories';

describe('Categories Schema Validation', () => {
  it('validates a valid expense category', () => {
    const valid = {
      name: 'Ngopi & Kafe',
      type: 'expense' as const,
      icon: 'coffee',
    };
    const parsed = createCategorySchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('validates a valid income category', () => {
    const valid = {
      name: 'Dividen Saham',
      type: 'income' as const,
      icon: 'trending-up',
    };
    const parsed = createCategorySchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it('rejects invalid category type', () => {
    const invalid = {
      name: 'Investasi',
      type: 'investment',
    };
    expect(createCategorySchema.safeParse(invalid).success).toBe(false);
  });

  it('rejects category with empty name', () => {
    const invalid = {
      name: '',
      type: 'expense' as const,
    };
    expect(createCategorySchema.safeParse(invalid).success).toBe(false);
  });

  it('validates category update', () => {
    const update = {
      name: 'Makan Enak',
      icon: 'utensils',
      isArchived: false,
    };
    expect(updateCategorySchema.safeParse(update).success).toBe(true);
  });
});
