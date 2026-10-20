import { z } from 'zod';
import { transactionTypeEnum } from './transactions';
import type { RecurringFrequency } from '../types/models';

export const recurringFrequencyEnum = z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'yearly']);

export const createRecurringRuleSchema = z.object({
  accountId: z.string().uuid({ message: 'Account ID harus berupa UUID valid' }),
  categoryId: z.string().uuid({ message: 'Category ID harus berupa UUID valid' }).optional().nullable(),
  type: transactionTypeEnum.refine((val) => val === 'income' || val === 'expense', {
    message: 'Tipe transaksi berulang harus berupa income atau expense',
  }),
  amount: z
    .number()
    .int({ message: 'Amount harus berupa bilangan bulat integer' })
    .positive({ message: 'Nominal transaksi berulang harus lebih besar dari 0' }),
  frequency: recurringFrequencyEnum,
  note: z.string().max(255).optional().nullable(),
  nextDueDate: z.string().optional(),
});

export const updateRecurringRuleSchema = z.object({
  amount: z
    .number()
    .int({ message: 'Amount harus berupa bilangan bulat integer' })
    .positive({ message: 'Nominal transaksi berulang harus lebih besar dari 0' })
    .optional(),
  frequency: recurringFrequencyEnum.optional(),
  note: z.string().max(255).optional().nullable(),
  nextDueDate: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type CreateRecurringRuleInput = z.infer<typeof createRecurringRuleSchema>;
export type UpdateRecurringRuleInput = z.infer<typeof updateRecurringRuleSchema>;
