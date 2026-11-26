import { Elysia } from 'elysia';
import { and, eq, getTableColumns } from 'drizzle-orm';
import { createAccountSchema, updateAccountSchema } from '@uangku/contracts';
import { authMiddleware } from '../../middleware/auth';
import { successResponse } from '../../middleware/error-handler';
import { db, schema } from '../../db/client';
import { walletBalance } from '../../db/ledger';

const a = schema.accounts;
export const accountRoutes = new Elysia({ prefix: '/api/v1/accounts' })
  .use(authMiddleware)
  .get('/', async ({ user }) => successResponse(await db.select({ ...getTableColumns(a), currentBalance: walletBalance })
    .from(a).where(and(eq(a.userId, user.userId), eq(a.isArchived, false)))))
  .post('/', async ({ body, user }) => {
    const [row] = await db.insert(a).values({ ...createAccountSchema.parse(body), userId: user.userId }).returning();
    return successResponse({ ...row, currentBalance: row.initialBalance });
  })
  .patch('/:id', async ({ params, body, user }) => {
    const [row] = await db.update(a).set({ ...updateAccountSchema.parse(body), updatedAt: new Date() })
      .where(and(eq(a.id, params.id), eq(a.userId, user.userId))).returning();
    if (!row) throw new Error('RESOURCE_NOT_FOUND');
    return successResponse(row);
  })
  .delete('/:id', async ({ params, user }) => {
    const [row] = await db.update(a).set({ isArchived: true, updatedAt: new Date() })
      .where(and(eq(a.id, params.id), eq(a.userId, user.userId))).returning();
    if (!row) throw new Error('RESOURCE_NOT_FOUND');
    return successResponse({ id: row.id, isArchived: true });
  });
