import { Elysia } from 'elysia';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createRecurringRuleSchema, updateRecurringRuleSchema, transactionTypeEnum } from '@uangku/contracts';
import { authMiddleware } from '../../middleware/auth';
import { successResponse } from '../../middleware/error-handler';
import { db, schema } from '../../db/client';
import { checkReferences, createEntry } from '../../db/ledger';
import { requireRow } from '../../db/require-row';

const r = schema.recurringRules;
const owned = (id: string, owner: string) => and(eq(r.id, id), eq(r.userId, owner));
function nextDue(date: string, frequency: string) {
  const due = new Date(`${date}T00:00:00Z`);
  if (frequency === 'monthly' || frequency === 'yearly') {
    const day = due.getUTCDate();
    due.setUTCDate(1);
    due.setUTCMonth(due.getUTCMonth() + (frequency === 'monthly' ? 1 : 12));
    const lastDay = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + 1, 0)).getUTCDate();
    due.setUTCDate(Math.min(day, lastDay));
  } else {
    due.setUTCDate(due.getUTCDate() + (frequency === 'daily' ? 1 : frequency === 'weekly' ? 7 : 14));
  }
  return due.toISOString().slice(0, 10);
}
export const recurringRoutes = new Elysia({ prefix: '/api/v1/recurring-rules' }).use(authMiddleware)
  .get('/', async ({ user }) => successResponse(await db.select().from(r).where(eq(r.userId, user.userId))))
  .post('/', async ({ body, user }) => {
    const input = createRecurringRuleSchema.parse(body);
    return successResponse(await db.transaction(async tx => {
      await checkReferences(tx, user.userId, input);
      const nextDueDate = z.string().date().parse(input.nextDueDate ?? new Date().toISOString().slice(0, 10));
      return requireRow(await tx.insert(r).values({ ...input, nextDueDate, userId: user.userId }).returning());
    }));
  })
  .patch('/:id', async ({ params, body, user }) => {
    const input = updateRecurringRuleSchema.parse(body);
    if (input.nextDueDate !== undefined) z.string().date().parse(input.nextDueDate);
    return successResponse(requireRow(await db.update(r).set({ ...input, updatedAt: new Date() })
      .where(owned(params.id, user.userId)).returning()));
  })
  .delete('/:id', async ({ params, user }) => {
    const row = requireRow(await db.delete(r).where(owned(params.id, user.userId)).returning());
    return successResponse({ id: row.id, deleted: true });
  })
  .post('/:id/trigger', async ({ params, user }) => successResponse(await db.transaction(async tx => {
    const where = owned(params.id, user.userId);
    const rule = requireRow(await tx.select().from(r).where(and(where, eq(r.isActive, true))).for('update'));
    const nextDueDate = nextDue(rule.nextDueDate, rule.frequency);
    const type = transactionTypeEnum.extract(['income','expense']).parse(rule.type);
    const categoryId = rule.categoryId ?? (type === 'income' ? 'c2000000-0000-0000-0000-000000000006' : 'c1000000-0000-0000-0000-000000000008');
    const transaction = await createEntry(tx, user.userId, { accountId: rule.accountId, categoryId,
      type, amount: rule.amount, currency: 'IDR', note: rule.note || `Transaksi Berulang (${rule.frequency})`,
      transactionDate: new Date().toISOString(), clientId: crypto.randomUUID() });
    await tx.update(r).set({ nextDueDate, updatedAt: new Date() }).where(where);
    return { transaction, nextDueDate };
  })));
