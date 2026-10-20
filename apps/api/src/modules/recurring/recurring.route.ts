import { Elysia } from 'elysia';
import {
  createRecurringRuleSchema,
  updateRecurringRuleSchema,
  type RecurringRuleModel,
} from '@uangku/contracts';
import { authMiddleware } from '../../middleware/auth';
import { successResponse } from '../../middleware/error-handler';
import { demoTransactions } from '../transactions/transaction.route';

export const demoRecurringRules: RecurringRuleModel[] = [
  {
    id: 'r1000000-0000-0000-0000-000000000001',
    userId: '00000000-0000-0000-0000-000000000001',
    accountId: 'a1000000-0000-0000-0000-000000000001',
    categoryId: 'c1000000-0000-0000-0000-000000000004', // Tagihan
    type: 'expense',
    amount: 54900,
    frequency: 'monthly',
    note: 'Langganan Spotify Premium',
    nextDueDate: '2026-11-01',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    accountName: 'Dompet Tunai',
    categoryName: 'Tagihan & Langganan',
  },
];

export const recurringRoutes = new Elysia({ prefix: '/api/v1/recurring-rules' })
  .use(authMiddleware)
  .get('/', async ({ user }) => {
    const list = demoRecurringRules.filter((r) => r.userId === user.userId);
    return successResponse(list);
  })
  .post('/', async ({ body, user }) => {
    const input = createRecurringRuleSchema.parse(body);

    const now = new Date();
    const newRule: RecurringRuleModel = {
      id: crypto.randomUUID(),
      userId: user.userId,
      accountId: input.accountId,
      categoryId: input.categoryId ?? null,
      type: input.type,
      amount: input.amount,
      frequency: input.frequency,
      note: input.note ?? null,
      nextDueDate: input.nextDueDate ?? now.toISOString().slice(0, 10),
      isActive: true,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    demoRecurringRules.unshift(newRule);
    return successResponse(newRule);
  })
  .patch('/:id', async ({ params, body, user }) => {
    const input = updateRecurringRuleSchema.parse(body);
    const rule = demoRecurringRules.find((r) => r.id === params.id && r.userId === user.userId);
    if (!rule) {
      throw new Error('RESOURCE_NOT_FOUND');
    }

    if (input.amount !== undefined) rule.amount = input.amount;
    if (input.frequency !== undefined) rule.frequency = input.frequency;
    if (input.note !== undefined) rule.note = input.note;
    if (input.nextDueDate !== undefined) rule.nextDueDate = input.nextDueDate;
    if (input.isActive !== undefined) rule.isActive = input.isActive;
    rule.updatedAt = new Date().toISOString();

    return successResponse(rule);
  })
  .delete('/:id', async ({ params, user }) => {
    const index = demoRecurringRules.findIndex((r) => r.id === params.id && r.userId === user.userId);
    if (index === -1) {
      throw new Error('RESOURCE_NOT_FOUND');
    }

    demoRecurringRules.splice(index, 1);
    return successResponse({ id: params.id, deleted: true });
  })
  .post('/:id/trigger', async ({ params, user }) => {
    const rule = demoRecurringRules.find((r) => r.id === params.id && r.userId === user.userId);
    if (!rule) {
      throw new Error('RESOURCE_NOT_FOUND');
    }

    // Generate normal transaction
    const now = new Date();
    const newTx = {
      id: crypto.randomUUID(),
      userId: user.userId,
      accountId: rule.accountId,
      destinationAccountId: null,
      categoryId: rule.categoryId || null,
      type: rule.type,
      amount: rule.amount,
      transferFee: 0,
      currency: 'IDR',
      note: rule.note ? `${rule.note} (Otomatis)` : `Transaksi Berulang (${rule.frequency})`,
      transactionDate: now.toISOString(),
      clientId: crypto.randomUUID(),
      version: 1,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      deletedAt: null,
    };
    demoTransactions.unshift(newTx);

    // Advance nextDueDate
    const due = new Date(rule.nextDueDate);
    if (rule.frequency === 'daily') due.setDate(due.getDate() + 1);
    else if (rule.frequency === 'weekly') due.setDate(due.getDate() + 7);
    else if (rule.frequency === 'biweekly') due.setDate(due.getDate() + 14);
    else if (rule.frequency === 'monthly') due.setMonth(due.getMonth() + 1);
    else if (rule.frequency === 'yearly') due.setFullYear(due.getFullYear() + 1);

    rule.nextDueDate = due.toISOString().slice(0, 10);
    rule.updatedAt = now.toISOString();

    return successResponse({ transaction: newTx, nextDueDate: rule.nextDueDate });
  });
