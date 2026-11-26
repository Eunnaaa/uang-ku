import { Elysia } from 'elysia';
import { and, eq, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { createGoalSchema, updateGoalSchema } from '@uangku/contracts';
import { authMiddleware } from '../../middleware/auth';
import { successResponse } from '../../middleware/error-handler';
import { db, schema } from '../../db/client';
import { requireRow } from '../../db/require-row';

const g = schema.financialGoals;
const owned = (id: string, owner: string) => and(eq(g.id,id),eq(g.userId,owner));
const deposit = z.object({ amount:z.number().int().safe().positive() });
export const goalRoutes = new Elysia({ prefix:'/api/v1/goals' }).use(authMiddleware)
  .get('/', async ({ user }) => successResponse(await db.select().from(g).where(and(eq(g.userId,user.userId),ne(g.status,'archived')))))
  .post('/', async ({ body, user }) => {
    const { initialAmount, ...input } = createGoalSchema.parse(body);
    return successResponse(requireRow(await db.insert(g).values({ ...input, userId:user.userId,
      currentAmount:initialAmount, status:initialAmount >= input.targetAmount ? 'achieved' : 'active' }).returning()));
  })
  .patch('/:id', async ({ params, body, user }) => {
    const patch = updateGoalSchema.parse(body);
    return successResponse(await db.transaction(async tx => {
      const where = owned(params.id,user.userId);
      const row = requireRow(await tx.select().from(g).where(where).for('update'));
      const reached = (patch.currentAmount ?? row.currentAmount) >= (patch.targetAmount ?? row.targetAmount);
      return requireRow(await tx.update(g).set({ ...patch, updatedAt:new Date(),
        status: patch.status ?? (row.status === 'archived' ? 'archived' : reached ? 'achieved' : 'active') }).where(where).returning());
    }));
  })
  .delete('/:id', async ({ params, user }) => {
    const row = requireRow(await db.update(g).set({ status:'archived', updatedAt:new Date() }).where(owned(params.id,user.userId)).returning());
    return successResponse({ id:row.id, archived:true });
  })
  .post('/:id/deposit', async ({ params, body, user }) => {
    const { amount } = deposit.parse(body);
    const total = sql`${g.currentAmount} + ${amount}`;
    return successResponse(requireRow(await db.update(g).set({ currentAmount:total, updatedAt:new Date(),
      status:sql`case when ${total} >= ${g.targetAmount} then 'achieved' else 'active' end` })
      .where(and(owned(params.id,user.userId),ne(g.status,'archived'))).returning()));
  });
