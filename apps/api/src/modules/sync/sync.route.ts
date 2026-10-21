import { Elysia } from 'elysia';
import { syncPushRequestSchema, syncPullQuerySchema } from '@uangku/contracts';
import { authMiddleware } from '../../middleware/auth';
import { successResponse } from '../../middleware/error-handler';
import { demoTransactions } from '../transactions/transaction.route';
import { db, schema } from '../../db/client';
import { eq, and, gt, desc } from 'drizzle-orm';

export const syncRoutes = new Elysia({ prefix: '/api/v1/sync' })
  .use(authMiddleware)
  .post('/push', async ({ body, user }) => {
    const { mutations } = syncPushRequestSchema.parse(body);

    const processed: any[] = [];
    const conflicts: any[] = [];
    const rejected: any[] = [];

    for (const mutation of mutations) {
      try {
        if (mutation.entityType === 'transaction') {
          if (mutation.operation === 'create') {
            const payload = mutation.payload as any;

            // Idempotency check via DB
            let existingInDb = false;
            let existingDbId: string | null = null;
            let existingDbVersion = 1;
            try {
              const [dbTx] = await db
                .select()
                .from(schema.transactions)
                .where(and(eq(schema.transactions.clientId, mutation.clientId), eq(schema.transactions.userId, user.userId)));
              if (dbTx) {
                existingInDb = true;
                existingDbId = dbTx.id;
                existingDbVersion = dbTx.version;
              }
            } catch {}

            const existingMem = demoTransactions.find((t) => t.clientId === mutation.clientId);
            if (existingInDb || existingMem) {
              processed.push({
                id: mutation.id,
                clientId: mutation.clientId,
                status: 'applied',
                serverEntityId: existingDbId || existingMem?.id,
                version: existingDbVersion || existingMem?.version || 1,
              });
              continue;
            }

            const newTx = {
              id: mutation.entityId || crypto.randomUUID(),
              userId: user.userId,
              accountId: payload.accountId,
              destinationAccountId: payload.destinationAccountId || null,
              categoryId: payload.categoryId || null,
              pocketId: payload.pocketId || null,
              type: payload.type,
              amount: payload.amount,
              transferFee: payload.transferFee || 0,
              currency: payload.currency || 'IDR',
              note: payload.note || null,
              receiptUrl: payload.receiptUrl || null,
              transactionDate: payload.transactionDate || new Date().toISOString(),
              clientId: mutation.clientId,
              version: mutation.version || 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              deletedAt: null,
            };
            demoTransactions.unshift(newTx);

            try {
              await db.insert(schema.transactions).values({
                id: newTx.id,
                userId: user.userId,
                accountId: payload.accountId,
                destinationAccountId: payload.destinationAccountId || null,
                categoryId: payload.categoryId || null,
                pocketId: newTx.pocketId,
                type: payload.type,
                amount: payload.amount,
                transferFee: payload.transferFee || 0,
                currency: payload.currency || 'IDR',
                note: payload.note || null,
                receiptUrl: payload.receiptUrl || null,
                transactionDate: new Date(newTx.transactionDate),
                clientId: mutation.clientId,
                version: newTx.version,
              });

              await db.insert(schema.syncEvents).values({
                id: Date.now(),
                userId: user.userId,
                entityType: 'transaction',
                entityId: newTx.id,
                operation: 'create',
                version: newTx.version,
              }).catch(() => {});
            } catch {}

            processed.push({
              id: mutation.id,
              clientId: mutation.clientId,
              status: 'applied',
              serverEntityId: newTx.id,
              version: newTx.version,
            });
          } else if (mutation.operation === 'update') {
            const payload = mutation.payload as any;
            let currentServerVersion = 1;
            let isFound = false;

            try {
              const [dbTx] = await db
                .select()
                .from(schema.transactions)
                .where(and(eq(schema.transactions.id, mutation.entityId), eq(schema.transactions.userId, user.userId)));
              if (dbTx) {
                isFound = true;
                currentServerVersion = dbTx.version;
              }
            } catch {}

            const existingMem = demoTransactions.find((t) => t.id === mutation.entityId && t.userId === user.userId);
            if (existingMem) {
              isFound = true;
              currentServerVersion = Math.max(currentServerVersion, existingMem.version);
            }

            if (!isFound) {
              rejected.push({ id: mutation.id, error: 'Entity not found or unauthorized' });
              continue;
            }

            if (mutation.version <= currentServerVersion) {
              conflicts.push({
                id: mutation.id,
                clientId: mutation.clientId,
                currentServerVersion,
                serverRecord: existingMem || null,
              });
              continue;
            }

            if (existingMem) {
              Object.assign(existingMem, payload, { version: mutation.version, updatedAt: new Date().toISOString() });
            }

            try {
              await db.update(schema.transactions).set({
                ...(payload.amount !== undefined && { amount: payload.amount }),
                ...(payload.transferFee !== undefined && { transferFee: payload.transferFee }),
                ...(payload.note !== undefined && { note: payload.note }),
                ...(payload.receiptUrl !== undefined && { receiptUrl: payload.receiptUrl }),
                ...(payload.transactionDate && { transactionDate: new Date(payload.transactionDate) }),
                ...(payload.categoryId !== undefined && { categoryId: payload.categoryId }),
                ...(payload.accountId && { accountId: payload.accountId }),
                ...(payload.destinationAccountId !== undefined && { destinationAccountId: payload.destinationAccountId }),
                version: mutation.version,
                updatedAt: new Date(),
              }).where(eq(schema.transactions.id, mutation.entityId));

              await db.insert(schema.syncEvents).values({
                id: Date.now(),
                userId: user.userId,
                entityType: 'transaction',
                entityId: mutation.entityId,
                operation: 'update',
                version: mutation.version,
              }).catch(() => {});
            } catch {}

            processed.push({ id: mutation.id, clientId: mutation.clientId, status: 'applied', version: mutation.version });
          } else if (mutation.operation === 'delete') {
            const now = new Date();
            let nextVersion = 2;

            try {
              const [dbTx] = await db
                .select()
                .from(schema.transactions)
                .where(and(eq(schema.transactions.id, mutation.entityId), eq(schema.transactions.userId, user.userId)));
              if (dbTx) {
                nextVersion = dbTx.version + 1;
                await db.update(schema.transactions).set({
                  deletedAt: now,
                  version: nextVersion,
                  updatedAt: now,
                }).where(eq(schema.transactions.id, mutation.entityId));

                await db.insert(schema.syncEvents).values({
                  id: Date.now(),
                  userId: user.userId,
                  entityType: 'transaction',
                  entityId: mutation.entityId,
                  operation: 'delete',
                  version: nextVersion,
                }).catch(() => {});
              }
            } catch {}

            const existingMem = demoTransactions.find((t) => t.id === mutation.entityId && t.userId === user.userId);
            if (existingMem) {
              existingMem.deletedAt = now.toISOString();
              existingMem.version += 1;
              nextVersion = existingMem.version;
            }

            processed.push({ id: mutation.id, clientId: mutation.clientId, status: 'applied', version: nextVersion });
          }
        }
      } catch (err: any) {
        rejected.push({ id: mutation.id, error: err.message });
      }
    }

    return successResponse({
      processed,
      conflicts,
      rejected,
    });
  })
  .get('/pull', async ({ query, user }) => {
    const { cursor, limit = 50 } = syncPullQuerySchema.parse(query);

    // 1. Try querying PostgreSQL for delta changes
    try {
      let cursorDate: Date | null = null;
      if (cursor) {
        try {
          const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
          const d = new Date(decoded);
          if (!isNaN(d.getTime())) {
            cursorDate = d;
          }
        } catch {}
      }

      const conditions: any[] = [eq(schema.transactions.userId, user.userId)];
      if (cursorDate) {
        conditions.push(gt(schema.transactions.updatedAt, cursorDate));
      }

      const dbChanges = await db
        .select()
        .from(schema.transactions)
        .where(and(...conditions))
        .orderBy(desc(schema.transactions.updatedAt))
        .limit(limit);

      if (dbChanges && dbChanges.length > 0) {
        const changes = dbChanges.map((tx) => ({
          ...tx,
          transactionDate: tx.transactionDate.toISOString(),
          createdAt: tx.createdAt.toISOString(),
          updatedAt: tx.updatedAt.toISOString(),
          deletedAt: tx.deletedAt ? tx.deletedAt.toISOString() : null,
        }));

        const latestUpdated = dbChanges[0].updatedAt;
        const nextCursor = Buffer.from(latestUpdated.toISOString()).toString('base64');

        return successResponse({
          changes,
          nextCursor,
        });
      }
    } catch {}

    // 2. In-Memory fallback
    const userChanges = demoTransactions.filter((t) => t.userId === user.userId);
    const changes = userChanges.slice(0, limit);
    const nextCursor = changes.length > 0 ? Buffer.from(new Date().toISOString()).toString('base64') : null;

    return successResponse({
      changes,
      nextCursor,
    });
  });
