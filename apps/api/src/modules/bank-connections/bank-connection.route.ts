import { createHash } from 'node:crypto';
import { Elysia } from 'elysia';
import { and, desc, eq, getTableColumns, inArray, isNull, or, sql } from 'drizzle-orm';
import { createBankConnectionSchema, importStatementSchema, parseBankStatement, reconcileMutationSchema } from '@uangku/contracts';
import { authMiddleware } from '../../middleware/auth';
import { successResponse } from '../../middleware/error-handler';
import { db, schema } from '../../db/client';
import { createEntry } from '../../db/ledger';

const { accounts, categories, pockets, profiles, bankConnections: connections, bankMutations: mutations, transactions } = schema;

export const bankConnectionRoutes = new Elysia({ prefix: '/api/v1' })
  .use(authMiddleware)
  .get('/bank-connections', async ({ user }) =>
    successResponse(await db.select().from(connections).where(eq(connections.userId, user.userId))))
  .post('/bank-connections', async ({ body, user }) => {
    const input = createBankConnectionSchema.parse(body);
    const [account] = await db.select({ id: accounts.id }).from(accounts)
      .where(and(eq(accounts.userId, user.userId), eq(accounts.id, input.accountId)));
    if (!account) throw new Error('RESOURCE_NOT_FOUND');
    const [row] = await db.insert(connections).values({ ...input, userId: user.userId,
      institutionCode: input.institutionCode.toUpperCase() }).returning();
    return successResponse(row);
  })
  .delete('/bank-connections/:id', async ({ params, user }) => {
    const [row] = await db.delete(connections).where(and(eq(connections.id, params.id), eq(connections.userId, user.userId))).returning();
    if (!row) throw new Error('RESOURCE_NOT_FOUND');
    return successResponse({ id: row.id, deleted: true });
  })
  .get('/bank-mutations', async ({ query, user }) => successResponse(await db.select(getTableColumns(mutations))
    .from(mutations).innerJoin(connections, eq(connections.id, mutations.connectionId))
    .where(and(eq(connections.userId, user.userId), query.status ? eq(mutations.reconciliationStatus, query.status) : undefined,
      query.connectionId ? eq(connections.id, query.connectionId) : undefined)).orderBy(desc(mutations.transactionTime))))
  .post('/bank-connections/:id/import-statement', async ({ params, body, user }) => {
    const input = importStatementSchema.parse(body);
    const [conn] = await db.select({ id: connections.id, accountId: connections.accountId, zone: profiles.timezone })
      .from(connections).innerJoin(profiles, eq(profiles.id, connections.userId))
      .where(and(eq(connections.id, params.id), eq(connections.userId, user.userId)));
    if (!conn || conn.id !== input.connectionId) throw new Error('RESOURCE_NOT_FOUND');
    const imported = await db.transaction(async tx => {
      await tx.select({ id: profiles.id }).from(profiles).where(eq(profiles.id,user.userId)).for('update');
      const rows = [];
      for (const r of parseBankStatement(conn.id, input.statementText)) {
        const candidates = r.ambiguous ? [] : await tx.select({ id: transactions.id }).from(transactions).where(and(
          eq(transactions.userId, user.userId), eq(transactions.accountId, conn.accountId), isNull(transactions.deletedAt),
          eq(transactions.amount, r.amount), eq(transactions.type, r.type === 'credit' ? 'income' : 'expense'),
          sql`not exists (select 1 from bank_mutations bm where bm.matched_transaction_id=${transactions.id} and bm.reconciliation_status in ('matched','created_as_new'))`,
          sql`(${transactions.transactionDate} AT TIME ZONE ${conn.zone})::date = ${r.date}::date`)).limit(2);
        const match = candidates.length === 1 ? candidates[0] : null;
        const [row] = await tx.insert(mutations).values({ connectionId: conn.id, description: r.description, type: r.type,
          externalId: createHash('sha256').update(r.externalId).digest('hex'), amount: r.amount,
          transactionTime: sql`${r.date}::date::timestamp AT TIME ZONE ${conn.zone}`,
          reconciliationStatus: match ? 'matched' : 'pending', matchedTransactionId: match?.id })
          .onConflictDoNothing({ target: mutations.externalId }).returning();
        if (row) rows.push(row);
      }
      await tx.update(connections).set({ lastSyncedAt: new Date() }).where(eq(connections.id, conn.id));
      return rows;
    });
    const matched = imported.filter(r => r.matchedTransactionId).length;
    return successResponse({ connectionId: conn.id, totalImported: imported.length, autoMatchedCount: matched,
      inboxPendingCount: imported.length - matched, mutations: imported });
  })
  .post('/bank-mutations/:id/reconcile', async ({ params, body, user }) => {
    const input = reconcileMutationSchema.parse(body);
    return successResponse(await db.transaction(async tx => {
      await tx.select({ id: profiles.id }).from(profiles).where(eq(profiles.id,user.userId)).for('update');
      const [row] = await tx.select({ m: mutations, accountId: connections.accountId }).from(mutations)
        .innerJoin(connections, eq(connections.id, mutations.connectionId)).where(and(eq(mutations.id, params.id),
          eq(connections.userId, user.userId))).for('update');
      if (!row) throw new Error('RESOURCE_NOT_FOUND');
      const { m, accountId } = row;
      if (m.reconciliationStatus !== 'pending') {
        if ((input.action === 'match' && m.reconciliationStatus === 'matched' && m.matchedTransactionId === input.matchedTransactionId) ||
          (m.reconciliationStatus === 'ignored' && input.action === 'ignore') ||
          (m.reconciliationStatus === 'created_as_new' && input.action === 'create_new')) return m;
        throw new Error('SYNC_CONFLICT');
      }
      let matchedTransactionId: string | null = null;
      if (input.action === 'match') {
        const [match] = await tx.select({ id: transactions.id }).from(transactions).where(and(eq(transactions.id, input.matchedTransactionId),
          eq(transactions.accountId, accountId), eq(transactions.userId, user.userId), isNull(transactions.deletedAt)));
        if (!match) throw new Error('RESOURCE_NOT_FOUND');
        const [existing] = await tx.select({id: mutations.id}).from(mutations)
          .innerJoin(connections, eq(mutations.connectionId, connections.id))
          .where(and(eq(connections.userId, user.userId), eq(mutations.matchedTransactionId, match.id),
            inArray(mutations.reconciliationStatus, ['matched','created_as_new'])));
        if (existing) throw new Error('SYNC_CONFLICT');
        matchedTransactionId = match.id;
      } else if (input.action === 'create_new') {
        const categoryId = input.categoryId || (m.type === 'debit' ? 'c1000000-0000-0000-0000-000000000008' : 'c2000000-0000-0000-0000-000000000006');
        const [category] = await tx.select({ id: categories.id }).from(categories).where(and(eq(categories.id, categoryId),
          or(eq(categories.userId, user.userId), isNull(categories.userId))));
        if (!category) throw new Error('RESOURCE_NOT_FOUND');
        if (input.pocketId) {
          const [p] = await tx.select({ id: pockets.id }).from(pockets).where(and(eq(pockets.id, input.pocketId),
            eq(pockets.accountId, accountId), eq(pockets.userId, user.userId)));
          if (!p) throw new Error('RESOURCE_NOT_FOUND');
        }
        const created = await createEntry(tx,user.userId,{ accountId, categoryId, currency: 'IDR',
          pocketId: input.pocketId, type: m.type === 'debit' ? 'expense' : 'income', amount: m.amount,
          transactionDate: m.transactionTime.toISOString(), note: input.note || m.description, clientId: crypto.randomUUID() });
        matchedTransactionId = created.id;
      }
      const [updated] = await tx.update(mutations).set({ matchedTransactionId,
        reconciliationStatus: input.action === 'ignore' ? 'ignored' : input.action === 'match' ? 'matched' : 'created_as_new' })
        .where(eq(mutations.id, m.id)).returning();
      return updated;
    }));
  });
