import { Elysia } from 'elysia';
import { and, eq, isNull, or } from 'drizzle-orm';
import { createCategorySchema, updateCategorySchema, type UpdateCategoryInput } from '@uangku/contracts';
import { db, schema } from '../../db/client';
import { authMiddleware } from '../../middleware/auth';
import { successResponse } from '../../middleware/error-handler';

const c = schema.categories;
const system = and(isNull(c.userId), eq(c.isSystem, true));
async function update(owner: string, id: string, patch: UpdateCategoryInput) {
  const [row] = await db.update(c).set({ ...patch, updatedAt: new Date() })
    .where(and(eq(c.id, id), eq(c.userId, owner), eq(c.isSystem, false))).returning();
  if (!row) {
    if ((await db.select({ id: c.id }).from(c).where(and(eq(c.id, id), system)))[0]) throw new Error('FORBIDDEN');
    throw new Error('RESOURCE_NOT_FOUND');
  }
  return row;
}
export const categoryRoutes = new Elysia({ prefix: '/api/v1/categories' })
  .use(authMiddleware)
  .get('/', async ({ query, user }) => successResponse(await db.select().from(c).where(and(
    or(eq(c.userId, user.userId), system), eq(c.isArchived, false), query.type ? eq(c.type, query.type) : undefined))))
  .post('/', async ({ body, user }) => successResponse((await db.insert(c)
    .values({ ...createCategorySchema.parse(body), userId: user.userId }).returning())[0]))
  .patch('/:id', async ({ body, params, user }) => successResponse(await update(user.userId, params.id, updateCategorySchema.parse(body))))
  .delete('/:id', async ({ params, user }) => successResponse(await update(user.userId, params.id, { isArchived: true })));
