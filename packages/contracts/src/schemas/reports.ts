import { z } from 'zod';

export const reportSummaryQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Format bulan harus YYYY-MM (contoh: 2026-10)'),
});

export const cashFlowQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
});

export interface MonthlySummaryResponse {
  month: string;
  totalIncome: number;
  totalExpense: number;
  totalTransferFees: number;
  netCashFlow: number;
  currentNetWorth: number;
  previousMonthComparison?: {
    incomeDiffPercentage: number;
    expenseDiffPercentage: number;
  };
}

export interface CategoryExpenseBreakdown {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  totalAmount: number;
  percentage: number;
}
