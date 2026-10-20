import { Elysia } from 'elysia';
import { syncPushRequestSchema, syncPullQuerySchema } from '@uangku/contracts';
import { authMiddleware } from '../../middleware/auth';
import { successResponse } from '../../middleware/error-handler';
import { demoTransactions } from '../transactions/transaction.route';

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
            const existing = demoTransactions.find((t) => t.clientId === mutation.clientId);
            if (existing) {
              processed.push({
                id: mutation.id,
                clientId: mutation.clientId,
                status: 'applied',
                serverEntityId: existing.id,
                version: existing.version,
              });
              continue;
            }

            const newTx = {
              id: mutation.entityId || crypto.randomUUID(),
              userId: user.userId,
              accountId: payload.accountId,
              destinationAccountId: payload.destinationAccountId || null,
              categoryId: payload.categoryId || null,
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
            processed.push({
              id: mutation.id,
              clientId: mutation.clientId,
              status: 'applied',
              serverEntityId: newTx.id,
              version: newTx.version,
            });
          } else if (mutation.operation === 'update') {
            const payload = mutation.payload as any;
            const existing = demoTransactions.find((t) => t.id === mutation.entityId && t.userId === user.userId);
            if (!existing) {
              rejected.push({ id: mutation.id, error: 'Entity not found or unauthorized' });
              continue;
            }
            if (mutation.version <= existing.version) {
              conflicts.push({
                id: mutation.id,
                clientId: mutation.clientId,
                currentServerVersion: existing.version,
                serverRecord: existing,
              });
              continue;
            }
            Object.assign(existing, payload, { version: mutation.version, updatedAt: new Date().toISOString() });
            processed.push({ id: mutation.id, clientId: mutation.clientId, status: 'applied', version: existing.version });
          } else if (mutation.operation === 'delete') {
            const existing = demoTransactions.find((t) => t.id === mutation.entityId && t.userId === user.userId);
            if (existing) {
              existing.deletedAt = new Date().toISOString();
              existing.version += 1;
              processed.push({ id: mutation.id, clientId: mutation.clientId, status: 'applied', version: existing.version });
            } else {
              processed.push({ id: mutation.id, clientId: mutation.clientId, status: 'applied' });
            }
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
    const { cursor, limit } = syncPullQuerySchema.parse(query);

    // Filter changes belonging to the authenticated user
    const userChanges = demoTransactions.filter((t) => t.userId === user.userId);
    const changes = userChanges.slice(0, limit);
    const nextCursor = changes.length > 0 ? Buffer.from(new Date().toISOString()).toString('base64') : null;

    return successResponse({
      changes,
      nextCursor,
    });
  });
