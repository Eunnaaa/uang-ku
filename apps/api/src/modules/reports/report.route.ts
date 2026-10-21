import { Elysia } from 'elysia';
import { reportSummaryQuerySchema } from '@uangku/contracts';
import { authMiddleware } from '../../middleware/auth';
import { successResponse } from '../../middleware/error-handler';
import { demoTransactions } from '../transactions/transaction.route';
import { db, schema } from '../../db/client';
import { eq, and, isNull, gte, lt, sql, desc } from 'drizzle-orm';

export const reportRoutes = new Elysia({ prefix: '/api/v1/reports' })
  .use(authMiddleware)
  .get('/summary', async ({ query, user }) => {
    const { month } = reportSummaryQuerySchema.parse(query);

    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10);

    const startDate = new Date(Date.UTC(year, m - 1, 1));
    const endDate = new Date(Date.UTC(year, m, 1));

    const prevStartDate = new Date(Date.UTC(year, m - 2, 1));
    const prevEndDate = startDate;

    let totalIncome = 0;
    let totalExpense = 0;
    let totalTransferFees = 0;
    let currentNetWorth = 0;
    let prevIncome = 0;
    let prevExpense = 0;

    let computedFromDb = false;

    // 1. Try PostgreSQL Aggregation Queries (PRD Section 44 & 45)
    try {
      // Current month transactions aggregation
      const [currAgg] = await db
        .select({
          income: sql<number>`COALESCE(SUM(CASE WHEN ${schema.transactions.type} = 'income' THEN ${schema.transactions.amount} ELSE 0 END), 0)`,
          expense: sql<number>`COALESCE(SUM(CASE WHEN ${schema.transactions.type} = 'expense' THEN ${schema.transactions.amount} ELSE 0 END), 0)`,
          fees: sql<number>`COALESCE(SUM(CASE WHEN ${schema.transactions.type} = 'transfer' THEN ${schema.transactions.transferFee} ELSE 0 END), 0)`,
        })
        .from(schema.transactions)
        .where(
          and(
            eq(schema.transactions.userId, user.userId),
            isNull(schema.transactions.deletedAt),
            gte(schema.transactions.transactionDate, startDate),
            lt(schema.transactions.transactionDate, endDate)
          )
        );

      // Previous month transactions aggregation
      const [prevAgg] = await db
        .select({
          income: sql<number>`COALESCE(SUM(CASE WHEN ${schema.transactions.type} = 'income' THEN ${schema.transactions.amount} ELSE 0 END), 0)`,
          expense: sql<number>`COALESCE(SUM(CASE WHEN ${schema.transactions.type} = 'expense' THEN ${schema.transactions.amount} ELSE 0 END), 0)`,
        })
        .from(schema.transactions)
        .where(
          and(
            eq(schema.transactions.userId, user.userId),
            isNull(schema.transactions.deletedAt),
            gte(schema.transactions.transactionDate, prevStartDate),
            lt(schema.transactions.transactionDate, prevEndDate)
          )
        );

      // Total Net Worth across active accounts
      const [accountsInitial] = await db
        .select({
          initialTotal: sql<number>`COALESCE(SUM(${schema.accounts.initialBalance}), 0)`,
        })
        .from(schema.accounts)
        .where(and(eq(schema.accounts.userId, user.userId), eq(schema.accounts.isArchived, false)));

      const [allTxNet] = await db
        .select({
          netChange: sql<number>`COALESCE(SUM(CASE 
            WHEN ${schema.transactions.type} = 'income' THEN ${schema.transactions.amount}
            WHEN ${schema.transactions.type} = 'expense' THEN -${schema.transactions.amount}
            WHEN ${schema.transactions.type} = 'transfer' THEN -${schema.transactions.transferFee}
            ELSE 0 END), 0)`,
        })
        .from(schema.transactions)
        .where(and(eq(schema.transactions.userId, user.userId), isNull(schema.transactions.deletedAt)));

      if (currAgg) {
        totalIncome = Number(currAgg.income);
        totalExpense = Number(currAgg.expense);
        totalTransferFees = Number(currAgg.fees);
        prevIncome = Number(prevAgg?.income || 0);
        prevExpense = Number(prevAgg?.expense || 0);
        currentNetWorth = Number(accountsInitial?.initialTotal || 0) + Number(allTxNet?.netChange || 0);
        computedFromDb = true;
      }
    } catch {}

    // 2. In-Memory fallback if DB is offline or returned empty
    if (!computedFromDb) {
      const activeTx = demoTransactions.filter((t) => {
        return t.userId === user.userId && t.deletedAt === null && t.transactionDate.startsWith(month);
      });

      for (const tx of activeTx) {
        if (tx.type === 'income') {
          totalIncome += tx.amount;
        } else if (tx.type === 'expense') {
          totalExpense += tx.amount;
        } else if (tx.type === 'transfer') {
          totalTransferFees += tx.transferFee || 0;
        }
      }

      // Compute net worth from all active demo transactions
      const allActive = demoTransactions.filter((t) => t.userId === user.userId && t.deletedAt === null);
      let calculatedNet = 0;
      for (const t of allActive) {
        if (t.type === 'income') calculatedNet += t.amount;
        else if (t.type === 'expense') calculatedNet -= t.amount;
        else if (t.type === 'transfer') calculatedNet -= (t.transferFee || 0);
      }
      currentNetWorth = Math.max(0, calculatedNet);
    }

    const netCashFlow = totalIncome - totalExpense - totalTransferFees;

    const incomeDiffPercentage = prevIncome > 0
      ? Math.round(((totalIncome - prevIncome) / prevIncome) * 1000) / 10
      : (totalIncome > 0 ? 100 : 0);

    const expenseDiffPercentage = prevExpense > 0
      ? Math.round(((totalExpense - prevExpense) / prevExpense) * 1000) / 10
      : (totalExpense > 0 ? 100 : 0);

    return successResponse({
      month,
      totalIncome,
      totalExpense,
      totalTransferFees,
      netCashFlow,
      currentNetWorth,
      previousMonthComparison: {
        incomeDiffPercentage,
        expenseDiffPercentage,
      },
    });
  })
  .get('/expenses-by-category', async ({ query, user }) => {
    const { month } = reportSummaryQuerySchema.parse(query);

    const [yearStr, monthStr] = month.split('-');
    const year = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10);
    const startDate = new Date(Date.UTC(year, m - 1, 1));
    const endDate = new Date(Date.UTC(year, m, 1));

    try {
      const dbCategories = await db
        .select({
          categoryId: schema.categories.id,
          categoryName: schema.categories.name,
          categoryIcon: schema.categories.icon,
          totalAmount: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)`,
        })
        .from(schema.transactions)
        .leftJoin(schema.categories, eq(schema.transactions.categoryId, schema.categories.id))
        .where(
          and(
            eq(schema.transactions.userId, user.userId),
            eq(schema.transactions.type, 'expense'),
            isNull(schema.transactions.deletedAt),
            gte(schema.transactions.transactionDate, startDate),
            lt(schema.transactions.transactionDate, endDate)
          )
        )
        .groupBy(schema.categories.id, schema.categories.name, schema.categories.icon)
        .orderBy(desc(sql`SUM(${schema.transactions.amount})`));

      if (dbCategories && dbCategories.length > 0) {
        const grandTotalExpense = dbCategories.reduce((sum, c) => sum + Number(c.totalAmount), 0);
        const categories = dbCategories.map((c) => {
          const tot = Number(c.totalAmount);
          return {
            categoryId: c.categoryId || 'other',
            categoryName: c.categoryName || 'Lainnya',
            categoryIcon: c.categoryIcon || 'tag',
            totalAmount: tot,
            percentage: grandTotalExpense > 0 ? Math.round((tot / grandTotalExpense) * 1000) / 10 : 0,
          };
        });

        return successResponse({
          month,
          grandTotalExpense,
          categories,
        });
      }
    } catch {}

    // In-memory fallback
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

    breakdown.sort((a, b) => b.totalAmount - a.totalAmount);

    return successResponse({
      month,
      grandTotalExpense,
      categories: breakdown,
    });
  });
