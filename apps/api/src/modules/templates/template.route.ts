import { Elysia } from 'elysia';
import { and, asc, count, desc, eq, sql } from 'drizzle-orm';
import { createTemplateSchema, updateTemplateSchema } from '@uangku/contracts';
import { authMiddleware } from '../../middleware/auth';
import { successResponse } from '../../middleware/error-handler';
import { db, schema } from '../../db/client';
import { checkReferences } from '../../db/ledger';
import { requireRow } from '../../db/require-row';

const t = schema.transactionTemplates;
const owned = (id: string, owner: string) => and(eq(t.id,id), eq(t.userId,owner));
export const templateRoutes = new Elysia({ prefix: '/api/v1/templates' }).use(authMiddleware)
  .get('/', async ({ user }) => successResponse(await db.select().from(t).where(eq(t.userId,user.userId))
    .orderBy(desc(t.useCount), asc(t.sortOrder))))
  .post('/', async ({ body, user, set }) => {
    const input = createTemplateSchema.parse(body);
    const row = await db.transaction(async tx => {
      await tx.select({id:schema.profiles.id}).from(schema.profiles).where(eq(schema.profiles.id,user.userId)).for('update');
      const [usage] = await tx.select({ n: count() }).from(t).where(eq(t.userId,user.userId));
      if (usage.n >= 20) return null;
      await checkReferences(tx, user.userId, input.templatePayload);
      return requireRow(await tx.insert(t).values({ ...input, userId:user.userId }).returning());
    });
    if (!row) {
      set.status = 400;
      return { error:{ code:'VALIDATION_ERROR', message:'Maksimum 20 template per pengguna.' } };
    }
    return successResponse(row);
  })
  .patch('/:id', async ({ body, params, user }) => {
    const { useCount: _ignored, ...patch } = updateTemplateSchema.parse(body);
    return successResponse(await db.transaction(async tx => {
      if (patch.templatePayload) await checkReferences(tx, user.userId, patch.templatePayload);
      return requireRow(await tx.update(t).set({ ...patch, updatedAt:new Date() }).where(owned(params.id,user.userId)).returning());
    }));
  })
  .delete('/:id', async ({ params, user }) => {
    const row = requireRow(await db.delete(t).where(owned(params.id,user.userId)).returning());
    return successResponse({ id:row.id, deleted:true });
  })
  .post('/:id/use', async ({ params, user }) => successResponse(requireRow(await db.update(t)
    .set({ useCount:sql`${t.useCount} + 1`, updatedAt:new Date() }).where(owned(params.id,user.userId)).returning())));
