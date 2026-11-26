import { Elysia } from 'elysia';
import { and, desc, eq, gte, isNull, lte, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { createTransactionSchema, updateTransactionSchema, queryTransactionSchema } from '@uangku/contracts';
import { authMiddleware } from '../../middleware/auth';
import { successResponse, paginatedResponse } from '../../middleware/error-handler';
import { db, schema } from '../../db/client';
import { createEntry, changeEntry } from '../../db/ledger';

const { transactions: t, accounts: a, categories: c, pockets: p } = schema;
export const transactionRoutes = new Elysia({ prefix: '/api/v1/transactions' })
  .use(authMiddleware)
  .get('/', async ({ query, user }) => {
    const f = queryTransactionSchema.parse(query);
    let after;
    if (f.cursor) {
      const [date, id] = Buffer.from(f.cursor, 'base64').toString().split('|');
      z.string().datetime().parse(date);
      after = id ? sql`(${t.transactionDate},${t.id}) < (${date}::timestamptz,${z.guid().parse(id)}::uuid)`
        : sql`${t.transactionDate} < ${date}::timestamptz`;
    }
    const rows = await db.select({ tx: t, account: { id: a.id, name: a.name, type: a.type },
      category: { id: c.id, name: c.name, icon: c.icon }, pocket: { id: p.id, name: p.name, emoji: p.emoji, type: p.type } })
      .from(t).leftJoin(a, and(eq(a.id, t.accountId), eq(a.userId, t.userId)))
      .leftJoin(c, and(eq(c.id, t.categoryId), or(eq(c.userId, t.userId), and(isNull(c.userId), eq(c.isSystem, true)))))
      .leftJoin(p, and(eq(p.id, t.pocketId), eq(p.userId, t.userId)))
      .where(and(eq(t.userId, user.userId), isNull(t.deletedAt), after, f.type && eq(t.type, f.type),
        f.accountId ? or(eq(t.accountId, f.accountId), eq(t.destinationAccountId, f.accountId)) : undefined,
        f.categoryId ? eq(t.categoryId, f.categoryId) : undefined, f.startDate ? gte(t.transactionDate, new Date(f.startDate)) : undefined,
        f.endDate ? lte(t.transactionDate, new Date(f.endDate)) : undefined))
      .orderBy(desc(t.transactionDate), desc(t.id)).limit(f.limit + 1);
    const items = rows.slice(0, f.limit).map(({ tx, account, category, pocket }) => ({ ...tx, account, pocket,
      category: category ?? (tx.type === 'transfer' ? { id: 'transfer', name: 'Transfer Antar Akun', icon: 'repeat' } : null) }));
    const last = items.at(-1);
    return paginatedResponse(items, rows.length > f.limit && last
      ? Buffer.from(`${last.transactionDate.toISOString()}|${last.id}`).toString('base64') : null, f.limit);
  })
  .post('/', async ({ body, user }) => {
    const input = createTransactionSchema.parse(body);
    return successResponse(await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${input.clientId},0))`);
      const [existing] = await tx.select().from(t).where(and(eq(t.clientId, input.clientId), eq(t.userId, user.userId)));
      if (!existing) return createEntry(tx, user.userId, input);
      const same = !existing.deletedAt && existing.version === 1 &&
        existing.transactionDate.getTime() === new Date(input.transactionDate).getTime() &&
        existing.transferFee === (input.transferFee ?? 0) &&
        (['type','accountId','destinationAccountId','pocketId','categoryId','amount','currency','note','receiptUrl'] as const)
          .every(k => existing[k] === (input[k] ?? null));
      if (!same) throw new Error('SYNC_CONFLICT');
      return existing;
    }));
  })
  .get('/:id', async ({ params, user }) => {
    const [row] = await db.select().from(t).where(and(eq(t.id, params.id), eq(t.userId, user.userId), isNull(t.deletedAt)));
    if (!row) throw new Error('RESOURCE_NOT_FOUND');
    return successResponse(row);
  })
  .patch('/:id', async ({ params, body, user }) =>
    successResponse(await db.transaction(tx => changeEntry(tx, user.userId, params.id, updateTransactionSchema.parse(body)))))
  .delete('/:id', async ({ params, user }) => {
    const row = await db.transaction(tx => changeEntry(tx, user.userId, params.id, null));
    return successResponse({ id: row.id, deletedAt: row.deletedAt });
  });
