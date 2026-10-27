import { Elysia } from 'elysia';
import {
  createBudgetSchema,
  updateBudgetSchema,
  type BudgetSummaryItem,
  type BudgetStatus,
} from '@uangku/contracts';
import { authMiddleware } from '../../middleware/auth';
import { successResponse } from '../../middleware/error-handler';
import { defaultCategories } from '../categories/category.route';
import { demoTransactions } from '../transactions/transaction.route';
import { db, schema } from '../../db/client';
import { eq } from 'drizzle-orm';

export interface BudgetRecord {
  id: string;
  userId: string;
  categoryId: string;
  amount: number;
  currency: string;
  period: 'monthly' | 'weekly';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const demoBudgets: BudgetRecord[] = [];

export const budgetRoutes = new Elysia({ prefix: '/api/v1/budgets' })
  .use(authMiddleware)
  .get('/', async ({ user }) => {
    const list = demoBudgets.filter((b) => b.userId === user.userId && b.isActive);
    return successResponse(list);
  })
  .post('/', async ({ body, user, set }) => {
    const input = createBudgetSchema.parse(body);

    // Rule PRD 60.5: Satu user hanya dapat memiliki satu budget aktif per kategori per periode
    const existing = demoBudgets.find(
      (b) =>
        b.userId === user.userId &&
        b.categoryId === input.categoryId &&
        b.period === input.period &&
        b.isActive
    );
    if (existing) {
      set.status = 400;
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Budget aktif untuk kategori dan periode ini sudah ada.',
        },
      };
    }

    const newBudget: BudgetRecord = {
      id: crypto.randomUUID(),
      userId: user.userId,
      categoryId: input.categoryId,
      amount: input.amount,
      currency: input.currency ?? 'IDR',
      period: input.period ?? 'monthly',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    demoBudgets.unshift(newBudget);

    try {
      await db.insert(schema.budgets).values({
        id: newBudget.id,
        userId: user.userId,
        categoryId: newBudget.categoryId,
        amount: newBudget.amount,
        currency: newBudget.currency,
        period: newBudget.period,
        isActive: true,
      });
    } catch {}

    return successResponse(newBudget);
  })
  .patch('/:id', async ({ params, body, user }) => {
    const input = updateBudgetSchema.parse(body);
    const budget = demoBudgets.find((b) => b.id === params.id && b.userId === user.userId);
    if (!budget) {
      throw new Error('RESOURCE_NOT_FOUND');
    }

    if (input.amount !== undefined) budget.amount = input.amount;
    if (input.period !== undefined) budget.period = input.period;
    if (input.isActive !== undefined) budget.isActive = input.isActive;
    budget.updatedAt = new Date().toISOString();

    try {
      await db.update(schema.budgets).set({
        amount: budget.amount,
        period: budget.period,
        isActive: budget.isActive,
        updatedAt: new Date(budget.updatedAt),
      }).where(eq(schema.budgets.id, budget.id));
    } catch {}

    return successResponse(budget);
  })
  .delete('/:id', async ({ params, user }) => {
    const index = demoBudgets.findIndex((b) => b.id === params.id && b.userId === user.userId);
    if (index === -1) {
      throw new Error('RESOURCE_NOT_FOUND');
    }

    demoBudgets.splice(index, 1);

    try {
      await db.delete(schema.budgets).where(eq(schema.budgets.id, params.id));
    } catch {}

    return successResponse({ id: params.id, deleted: true });
  })
  // PRD 60.4: Summary endpoint
  .get('/summary', async ({ query, user }) => {
    const targetMonth = (query.month as string) || new Date().toISOString().slice(0, 7);
    const userBudgets = demoBudgets.filter((b) => b.userId === user.userId && b.isActive);

    const userTx = demoTransactions.filter(
      (t) =>
        t.userId === user.userId &&
        t.type === 'expense' &&
        !t.deletedAt &&
        t.transactionDate.startsWith(targetMonth)
    );

    const summaryList: BudgetSummaryItem[] = userBudgets.map((b) => {
      const category = defaultCategories.find((c) => c.id === b.categoryId);
      const spentAmount = userTx
        .filter((t) => t.categoryId === b.categoryId)
        .reduce((sum, t) => sum + t.amount, 0);

      const remainingAmount = Math.max(0, b.amount - spentAmount);
      const percentage = b.amount > 0 ? Math.round((spentAmount / b.amount) * 1000) / 10 : 0;

      let status: BudgetStatus = 'on_track';
      if (percentage >= 100) {
        status = 'exceeded';
      } else if (percentage >= 80) {
        status = 'warning';
      }

      return {
        budgetId: b.id,
        categoryId: b.categoryId,
        categoryName: category?.name || 'Kategori',
        budgetAmount: b.amount,
        spentAmount,
        remainingAmount,
        percentage,
        status,
      };
    });

    return successResponse(summaryList);
  });
