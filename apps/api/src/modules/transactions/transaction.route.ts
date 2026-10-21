import { Elysia } from 'elysia';
import { createTransactionSchema, updateTransactionSchema, queryTransactionSchema } from '@uangku/contracts';
import { authMiddleware } from '../../middleware/auth';
import { successResponse, paginatedResponse, errorHandler } from '../../middleware/error-handler';
import { db, schema } from '../../db/client';
import { eq, and, sql, desc, isNull, gte, lte } from 'drizzle-orm';
import { demoPockets } from '../pockets/pocket.route';

// In-memory demo store fallback for rapid local testing and offline modes
const demoTransactions: any[] = [];

export const transactionRoutes = new Elysia({ prefix: '/api/v1/transactions' })
  .use(errorHandler)
  .use(authMiddleware)
  .get('/', async ({ query, user }) => {
    const filters = queryTransactionSchema.parse(query);

    // 1. Try querying real PostgreSQL with Drizzle ORM first
    try {
      const conditions: any[] = [
        eq(schema.transactions.userId, user.userId),
        isNull(schema.transactions.deletedAt),
      ];

      if (filters.type) {
        conditions.push(eq(schema.transactions.type, filters.type));
      }
      if (filters.accountId) {
        conditions.push(
          sql`(${schema.transactions.accountId} = ${filters.accountId} OR ${schema.transactions.destinationAccountId} = ${filters.accountId})`
        );
      }
      if (filters.categoryId) {
        conditions.push(eq(schema.transactions.categoryId, filters.categoryId));
      }
      if (filters.startDate) {
        conditions.push(gte(schema.transactions.transactionDate, new Date(filters.startDate)));
      }
      if (filters.endDate) {
        conditions.push(lte(schema.transactions.transactionDate, new Date(filters.endDate)));
      }

      if (filters.cursor) {
        try {
          const decodedDate = Buffer.from(filters.cursor, 'base64').toString('utf-8');
          conditions.push(sql`${schema.transactions.transactionDate} < ${new Date(decodedDate)}`);
        } catch {}
      }

      const limit = filters.limit || 30;

      const dbRows = await db
        .select({
          tx: schema.transactions,
          account: {
            id: schema.accounts.id,
            name: schema.accounts.name,
            type: schema.accounts.type,
          },
          category: {
            id: schema.categories.id,
            name: schema.categories.name,
            icon: schema.categories.icon,
          },
          pocket: {
            id: schema.pockets.id,
            name: schema.pockets.name,
            emoji: schema.pockets.emoji,
            type: schema.pockets.type,
          },
        })
        .from(schema.transactions)
        .leftJoin(schema.accounts, eq(schema.transactions.accountId, schema.accounts.id))
        .leftJoin(schema.categories, eq(schema.transactions.categoryId, schema.categories.id))
        .leftJoin(schema.pockets, eq(schema.transactions.pocketId, schema.pockets.id))
        .where(and(...conditions))
        .orderBy(desc(schema.transactions.transactionDate))
        .limit(limit + 1);

      if (dbRows && dbRows.length > 0) {
        const hasMore = dbRows.length > limit;
        const pageItems = dbRows.slice(0, limit).map((r) => ({
          ...r.tx,
          transactionDate: r.tx.transactionDate.toISOString(),
          createdAt: r.tx.createdAt.toISOString(),
          updatedAt: r.tx.updatedAt.toISOString(),
          deletedAt: r.tx.deletedAt ? r.tx.deletedAt.toISOString() : null,
          account: r.account?.id ? r.account : undefined,
          category: r.category?.id ? r.category : (r.tx.type === 'transfer' ? { id: 'transfer', name: 'Transfer Antar Akun', icon: 'repeat' } : null),
          pocket: r.pocket?.id ? r.pocket : null,
        }));

        const lastItem = pageItems[pageItems.length - 1];
        const nextCursor = hasMore && lastItem ? Buffer.from(lastItem.transactionDate).toString('base64') : null;
        return paginatedResponse(pageItems, nextCursor, limit);
      }
    } catch {
      // Fallback to in-memory store if DB is offline or empty
    }

    // 2. In-Memory fallback
    let items = demoTransactions.filter((t) => t.deletedAt === null && t.userId === user.userId);

    if (filters.type) {
      items = items.filter((t) => t.type === filters.type);
    }
    if (filters.accountId) {
      items = items.filter((t) => t.accountId === filters.accountId || t.destinationAccountId === filters.accountId);
    }
    if (filters.categoryId) {
      items = items.filter((t) => t.categoryId === filters.categoryId);
    }
    if (filters.startDate) {
      items = items.filter((t) => t.transactionDate >= filters.startDate!);
    }
    if (filters.endDate) {
      items = items.filter((t) => t.transactionDate <= filters.endDate!);
    }

    items.sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());

    if (filters.cursor) {
      try {
        const decodedDate = Buffer.from(filters.cursor, 'base64').toString('utf-8');
        items = items.filter((t) => new Date(t.transactionDate).getTime() < new Date(decodedDate).getTime());
      } catch {}
    }

    const limit = filters.limit || 30;
    const paginatedItems = items.slice(0, limit);
    const hasMore = items.length > limit;
    const nextCursor = hasMore && paginatedItems.length > 0 ? Buffer.from(paginatedItems[paginatedItems.length - 1].transactionDate).toString('base64') : null;

    return paginatedResponse(paginatedItems, nextCursor, limit);
  })
  .post('/', async ({ body, headers, user }) => {
    const input = createTransactionSchema.parse(body);

    // Idempotency check via client_id and user_id in DB first
    try {
      const [existingDbTx] = await db
        .select()
        .from(schema.transactions)
        .where(and(eq(schema.transactions.clientId, input.clientId), eq(schema.transactions.userId, user.userId)));

      if (existingDbTx) {
        return successResponse({
          ...existingDbTx,
          transactionDate: existingDbTx.transactionDate.toISOString(),
          createdAt: existingDbTx.createdAt.toISOString(),
          updatedAt: existingDbTx.updatedAt.toISOString(),
        });
      }
    } catch {}

    const existingMem = demoTransactions.find((t) => t.clientId === input.clientId && t.userId === user.userId);
    if (existingMem) {
      return successResponse(existingMem);
    }

    let attachedPocket: any = null;
    if (input.pocketId) {
      const pkt = demoPockets.find((p) => p.id === input.pocketId && p.userId === user.userId);
      if (pkt) {
        attachedPocket = { id: pkt.id, name: pkt.name, emoji: pkt.emoji, type: pkt.type };
        if (input.type === 'expense') {
          pkt.allocatedBalance = Math.max(0, pkt.allocatedBalance - input.amount);
          pkt.updatedAt = new Date().toISOString();
        }
      }
    }

    const newTxId = crypto.randomUUID();
    const newTx = {
      id: newTxId,
      userId: user.userId,
      accountId: input.accountId,
      destinationAccountId: input.destinationAccountId || null,
      categoryId: input.categoryId || null,
      pocketId: input.pocketId || null,
      type: input.type,
      amount: input.amount,
      transferFee: input.transferFee || 0,
      currency: input.currency || 'IDR',
      note: input.note || null,
      receiptUrl: input.receiptUrl || null,
      transactionDate: input.transactionDate,
      clientId: input.clientId,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
      account: { id: input.accountId, name: 'Dompet Terpilih', type: 'cash' },
      destinationAccount: input.destinationAccountId ? { id: input.destinationAccountId, name: 'Tujuan', type: 'bank' } : null,
      category: input.categoryId ? { id: input.categoryId, name: 'Kategori', icon: 'tag' } : (input.type === 'transfer' ? { id: 'transfer', name: 'Transfer Antar Akun', icon: 'repeat' } : null),
      pocket: attachedPocket,
    };

    demoTransactions.unshift(newTx);

    // Persist to PostgreSQL with Drizzle ORM
    try {
      await db.insert(schema.transactions).values({
        id: newTx.id,
        userId: user.userId,
        accountId: input.accountId,
        destinationAccountId: input.destinationAccountId || null,
        categoryId: input.categoryId || null,
        pocketId: newTx.pocketId,
        type: input.type,
        amount: input.amount,
        transferFee: input.transferFee || 0,
        currency: input.currency || 'IDR',
        note: input.note || null,
        receiptUrl: input.receiptUrl || null,
        transactionDate: new Date(input.transactionDate),
        clientId: input.clientId,
        version: 1,
      });

      // Record to sync_events
      await db.insert(schema.syncEvents).values({
        id: Date.now(),
        userId: user.userId,
        entityType: 'transaction',
        entityId: newTx.id,
        operation: 'create',
        version: 1,
      }).catch(() => {});

      if (input.pocketId && input.type === 'expense') {
        await db.update(schema.pockets).set({
          allocatedBalance: sql`GREATEST(0, allocated_balance - ${input.amount})`,
          updatedAt: new Date(),
        }).where(eq(schema.pockets.id, input.pocketId));
      }
    } catch (err: any) {
      console.warn('DB transaction insert error (gracefully continued):', err?.message);
    }

    return successResponse(newTx);
  })
  .get('/:id', async ({ params, user }) => {
    try {
      const [dbTx] = await db
        .select()
        .from(schema.transactions)
        .where(and(eq(schema.transactions.id, params.id), eq(schema.transactions.userId, user.userId), isNull(schema.transactions.deletedAt)));

      if (dbTx) {
        return successResponse({
          ...dbTx,
          transactionDate: dbTx.transactionDate.toISOString(),
          createdAt: dbTx.createdAt.toISOString(),
          updatedAt: dbTx.updatedAt.toISOString(),
        });
      }
    } catch {}

    const tx = demoTransactions.find((t) => t.id === params.id && t.userId === user.userId && t.deletedAt === null);
    if (!tx) {
      throw new Error('RESOURCE_NOT_FOUND');
    }
    return successResponse(tx);
  })
  .patch('/:id', async ({ params, body, user }) => {
    const input = updateTransactionSchema.parse(body);
    let currentVersion = 1;

    try {
      const [existingDb] = await db
        .select()
        .from(schema.transactions)
        .where(and(eq(schema.transactions.id, params.id), eq(schema.transactions.userId, user.userId)));

      if (existingDb) {
        currentVersion = existingDb.version;
        if (input.version <= existingDb.version) {
          throw new Error('SYNC_CONFLICT');
        }

        await db.update(schema.transactions).set({
          ...(input.amount !== undefined && { amount: input.amount }),
          ...(input.transferFee !== undefined && { transferFee: input.transferFee }),
          ...(input.note !== undefined && { note: input.note }),
          ...(input.receiptUrl !== undefined && { receiptUrl: input.receiptUrl }),
          ...(input.transactionDate && { transactionDate: new Date(input.transactionDate) }),
          ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
          ...(input.accountId && { accountId: input.accountId }),
          ...(input.destinationAccountId !== undefined && { destinationAccountId: input.destinationAccountId }),
          ...(input.pocketId !== undefined && { pocketId: input.pocketId }),
          version: input.version,
          updatedAt: new Date(),
        }).where(eq(schema.transactions.id, params.id));

        await db.insert(schema.syncEvents).values({
          id: Date.now(),
          userId: user.userId,
          entityType: 'transaction',
          entityId: params.id,
          operation: 'update',
          version: input.version,
        }).catch(() => {});
      }
    } catch (err: any) {
      if (err.message === 'SYNC_CONFLICT') throw err;
    }

    const tx = demoTransactions.find((t) => t.id === params.id && t.userId === user.userId && t.deletedAt === null);
    if (!tx) {
      throw new Error('RESOURCE_NOT_FOUND');
    }
    if (input.version <= tx.version) {
      throw new Error('SYNC_CONFLICT');
    }

    if (input.amount !== undefined) tx.amount = input.amount;
    if (input.transferFee !== undefined) tx.transferFee = input.transferFee;
    if (input.note !== undefined) tx.note = input.note;
    if (input.receiptUrl !== undefined) tx.receiptUrl = input.receiptUrl;
    if (input.transactionDate) tx.transactionDate = input.transactionDate;
    if (input.categoryId !== undefined) tx.categoryId = input.categoryId;
    if (input.accountId) tx.accountId = input.accountId;
    if (input.destinationAccountId !== undefined) tx.destinationAccountId = input.destinationAccountId;
    if (input.pocketId !== undefined) tx.pocketId = input.pocketId;
    tx.version = input.version;
    tx.updatedAt = new Date().toISOString();

    return successResponse(tx);
  })
  .delete('/:id', async ({ params, user }) => {
    const now = new Date();

    try {
      const [existingDb] = await db
        .select()
        .from(schema.transactions)
        .where(and(eq(schema.transactions.id, params.id), eq(schema.transactions.userId, user.userId)));

      if (existingDb) {
        const nextVersion = existingDb.version + 1;
        await db.update(schema.transactions).set({
          deletedAt: now,
          version: nextVersion,
          updatedAt: now,
        }).where(eq(schema.transactions.id, params.id));

        if (existingDb.pocketId && existingDb.type === 'expense') {
          await db.update(schema.pockets).set({
            allocatedBalance: sql`allocated_balance + ${existingDb.amount}`,
            updatedAt: now,
          }).where(eq(schema.pockets.id, existingDb.pocketId));
        }

        await db.insert(schema.syncEvents).values({
          id: Date.now(),
          userId: user.userId,
          entityType: 'transaction',
          entityId: params.id,
          operation: 'delete',
          version: nextVersion,
        }).catch(() => {});
      }
    } catch {}

    const tx = demoTransactions.find((t) => t.id === params.id && t.userId === user.userId && t.deletedAt === null);
    if (!tx) {
      throw new Error('RESOURCE_NOT_FOUND');
    }
    tx.deletedAt = now.toISOString();
    tx.version += 1;
    tx.updatedAt = tx.deletedAt;

    if (tx.pocketId && tx.type === 'expense') {
      const pkt = demoPockets.find((p) => p.id === tx.pocketId);
      if (pkt) {
        pkt.allocatedBalance += tx.amount;
        pkt.updatedAt = now.toISOString();
      }
    }

    return successResponse({ id: tx.id, deletedAt: tx.deletedAt });
  });

export { demoTransactions };
