import { Elysia } from 'elysia';
import { reportSummaryQuerySchema } from '@uangku/contracts';
import { authMiddleware } from '../../middleware/auth';
import { successResponse } from '../../middleware/error-handler';
import { demoTransactions } from '../transactions/transaction.route';

export const reportRoutes = new Elysia({ prefix: '/api/v1/reports' })
  .use(authMiddleware)
  .get('/summary', async ({ query, user }) => {
    const { month } = reportSummaryQuerySchema.parse(query);

    // Filter active transactions for this month belonging to user
    const activeTx = demoTransactions.filter((t) => {
      return t.userId === user.userId && t.deletedAt === null && t.transactionDate.startsWith(month);
    });

    let totalIncome = 0;
    let totalExpense = 0;
    let totalTransferFees = 0;

    for (const tx of activeTx) {
      if (tx.type === 'income') {
        totalIncome += tx.amount;
      } else if (tx.type === 'expense') {
        totalExpense += tx.amount;
      } else if (tx.type === 'transfer') {
        totalTransferFees += tx.transferFee || 0;
      }
    }

    const netCashFlow = totalIncome - totalExpense - totalTransferFees;

    // Total net worth across all active accounts
    const currentNetWorth = 19420000; // sum of demo accounts

    return successResponse({
      month,
      totalIncome,
      totalExpense,
      totalTransferFees,
      netCashFlow,
      currentNetWorth,
      previousMonthComparison: {
        incomeDiffPercentage: 12.5,
        expenseDiffPercentage: -5.2,
      },
    });
  })
  .get('/expenses-by-category', async ({ query, user }) => {
    const { month } = reportSummaryQuerySchema.parse(query);

    const expenseTx = demoTransactions.filter((t) => {
      return t.userId === user.userId && t.deletedAt === null && t.type === 'expense' && t.transactionDate.startsWith(month);
    });

    const categoryMap = new Map<string, { id: string; name: string; icon: string | null; total: number }>();
    let grandTotalExpense = 0;

    for (const tx of expenseTx) {
      grandTotalExpense += tx.amount;
      const catId = tx.categoryId || 'other';
      const existing = categoryMap.get(catId);
      if (existing) {
        existing.total += tx.amount;
      } else {
        categoryMap.set(catId, {
          id: catId,
          name: tx.category?.name || 'Lainnya',
          icon: tx.category?.icon || 'tag',
          total: tx.amount,
        });
      }
    }

    const breakdown = Array.from(categoryMap.values()).map((c) => ({
      categoryId: c.id,
      categoryName: c.name,
      categoryIcon: c.icon,
      totalAmount: c.total,
      percentage: grandTotalExpense > 0 ? Math.round((c.total / grandTotalExpense) * 1000) / 10 : 0,
    }));

    // Sort by largest expense first
    breakdown.sort((a, b) => b.totalAmount - a.totalAmount);

    return successResponse({
      month,
      grandTotalExpense,
      categories: breakdown,
    });
  });
