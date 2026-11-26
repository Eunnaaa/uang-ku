import { Elysia } from 'elysia';
import {
  createBudgetSchema,
  updateBudgetSchema,
  reportSummaryQuerySchema,
  type BudgetSummaryItem,
  type BudgetStatus,
} from '@uangku/contracts';
import { authMiddleware } from '../../middleware/auth';
import { successResponse } from '../../middleware/error-handler';
import { db, schema } from '../../db/client';
import { monthBounds } from '../../db/month';
import { checkReferences, type Tx } from '../../db/ledger';
import { requireRow } from '../../db/require-row';
import { and, eq, gte, isNull, lt, ne, or } from 'drizzle-orm';

const b = schema.budgets;
const owned = (id: string, owner: string) => and(eq(b.id,id), eq(b.userId,owner));
const active = (owner: string) => and(eq(b.userId,owner),eq(b.isActive,true));
async function lockBudgets(tx: Tx, owner: string) {
  await tx.select({id:schema.profiles.id}).from(schema.profiles).where(eq(schema.profiles.id,owner)).for('update');
}
export const budgetRoutes = new Elysia({ prefix: '/api/v1/budgets' }).use(authMiddleware)
  .get('/', async ({ user }) => successResponse(await db.select().from(b).where(active(user.userId))))
  .post('/', async ({ body, user, set }) => {
    const input = createBudgetSchema.parse(body);
    const row = await db.transaction(async tx => {
      await lockBudgets(tx,user.userId);
      await checkReferences(tx,user.userId,input);
      if ((await tx.select({id:b.id}).from(b).where(and(active(user.userId),eq(b.categoryId,input.categoryId),eq(b.period,input.period))))[0]) return null;
      return requireRow(await tx.insert(b).values({ ...input, userId:user.userId }).returning());
    });
    if (!row) {
      set.status = 400;
      return { error:{ code:'VALIDATION_ERROR', message:'Budget aktif untuk kategori dan periode ini sudah ada.' } };
    }
    return successResponse(row);
  })
  .patch('/:id', async ({ params, body, user }) => {
    const patch = updateBudgetSchema.parse(body);
    return successResponse(await db.transaction(async tx => {
      await lockBudgets(tx,user.userId);
      const where = owned(params.id,user.userId);
      const row = requireRow(await tx.select().from(b).where(where));
      if (patch.isActive ?? row.isActive) {
        const [other] = await tx.select({id:b.id}).from(b).where(and(active(user.userId), ne(b.id,row.id),
          eq(b.categoryId,row.categoryId), eq(b.period,patch.period ?? row.period)));
        if (other) throw new Error('SYNC_CONFLICT');
      }
      return requireRow(await tx.update(b).set({ ...patch,updatedAt:new Date() }).where(where).returning());
    }));
  })
  .delete('/:id', async ({ params, user }) => {
    const row = requireRow(await db.delete(b).where(owned(params.id,user.userId)).returning());
    return successResponse({id:row.id,deleted:true});
  })
  // PRD 60.4: Summary endpoint
  .get('/summary', async ({ query, user }) => {
    const { startDate, endDate } = await monthBounds(user.userId, query.month ? reportSummaryQuerySchema.parse(query).month : undefined);
    const userBudgets = await db.select().from(b).where(active(user.userId));

    const t = schema.transactions;
    const userTx = await db.select({ categoryId: t.categoryId, amount: t.amount }).from(t).where(and(
      eq(t.userId, user.userId), eq(t.type, 'expense'), isNull(t.deletedAt), gte(t.transactionDate, startDate), lt(t.transactionDate, endDate)));

    const accessible = await db.select().from(schema.categories).where(or(eq(schema.categories.userId,user.userId),
      and(isNull(schema.categories.userId),eq(schema.categories.isSystem,true))));
    const summaryList: BudgetSummaryItem[] = userBudgets.map((b) => {
      const category = accessible.find((c) => c.id === b.categoryId);
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
