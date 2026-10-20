import { describe, expect, it } from 'bun:test';
import { CreateGoalSchema, UpdateGoalSchema } from './goals';

describe('Financial Goals Schema Validation (PRD Section 61)', () => {
  it('validates a valid goal creation successfully', () => {
    const input = {
      name: 'Dana Darurat 6 Bulan',
      emoji: '🛡️',
      targetAmount: 30000000,
      initialAmount: 5000000,
      targetDate: '2026-12-31',
    };

    const parsed = CreateGoalSchema.parse(input);
    expect(parsed.name).toBe('Dana Darurat 6 Bulan');
    expect(parsed.emoji).toBe('🛡️');
    expect(parsed.targetAmount).toBe(30000000);
    expect(parsed.initialAmount).toBe(5000000);
  });

  it('sets default emoji and initialAmount if omitted', () => {
    const input = {
      name: 'Liburan Jepang',
      targetAmount: 25000000,
    };

    const parsed = CreateGoalSchema.parse(input);
    expect(parsed.emoji).toBe('🎯');
    expect(parsed.initialAmount).toBe(0);
  });

  it('rejects goal with empty name', () => {
    const input = {
      name: '',
      targetAmount: 1000000,
    };

    expect(() => CreateGoalSchema.parse(input)).toThrow();
  });

  it('rejects goal with non-positive or float target amount', () => {
    expect(() =>
      CreateGoalSchema.parse({
        name: 'Target Negatif',
        targetAmount: -500000,
      })
    ).toThrow();

    expect(() =>
      CreateGoalSchema.parse({
        name: 'Target Nol',
        targetAmount: 0,
      })
    ).toThrow();

    expect(() =>
      CreateGoalSchema.parse({
        name: 'Target Desimal',
        targetAmount: 15000.5,
      })
    ).toThrow();
  });

  it('validates partial goal update and status changes', () => {
    const update = {
      currentAmount: 30000000,
      status: 'achieved' as const,
    };

    const parsed = UpdateGoalSchema.parse(update);
    expect(parsed.currentAmount).toBe(30000000);
    expect(parsed.status).toBe('achieved');
  });
});
