import { z } from 'zod';

export const budgetPeriodEnum = z.enum(['monthly', 'weekly']);
export type BudgetPeriod = z.infer<typeof budgetPeriodEnum>;

export const budgetStatusEnum = z.enum(['on_track', 'warning', 'exceeded']);
export type BudgetStatus = z.infer<typeof budgetStatusEnum>;

export const createBudgetSchema = z.object({
  categoryId: z.string().uuid({ message: 'Category ID harus berupa UUID valid' }),
  amount: z
    .number()
    .int({ message: 'Amount harus berupa bilangan bulat integer' })
    .positive({ message: 'Batas budget harus lebih besar dari 0' }),
  currency: z.string().length(3).default('IDR'),
  period: budgetPeriodEnum.default('monthly'),
});

export const updateBudgetSchema = z.object({
  amount: z
    .number()
    .int({ message: 'Amount harus berupa bilangan bulat integer' })
    .positive({ message: 'Batas budget harus lebih besar dari 0' })
    .optional(),
  period: budgetPeriodEnum.optional(),
  isActive: z.boolean().optional(),
});

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;

export interface BudgetSummaryItem {
  budgetId: string;
  categoryId: string;
  categoryName: string;
  budgetAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentage: number;
  status: BudgetStatus;
}
