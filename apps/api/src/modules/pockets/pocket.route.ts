import { Elysia } from 'elysia';
import {
  createPocketSchema,
  updatePocketSchema,
  pocketTransferSchema,
  type PocketModel,
} from '@uangku/contracts';
import { authMiddleware } from '../../middleware/auth';
import { successResponse, errorHandler } from '../../middleware/error-handler';
import { db, schema } from '../../db/client';
import { eq, and, sql } from 'drizzle-orm';

// In-memory fallback store for rapid unit tests & offline running
export const demoPockets: PocketModel[] = [
  {
    id: 'c1000000-0000-4000-8000-000000000001',
    userId: '00000000-0000-0000-0000-000000000001',
    accountId: 'a2000000-0000-0000-0000-000000000002', // BCA Utama
    name: 'Belanja & Kuliner',
    emoji: '🍜',
    type: 'spending',
    allocatedBalance: 1500000,
    targetAmount: 3000000,
    isLocked: false,
    sortOrder: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'c2000000-0000-4000-8000-000000000002',
    userId: '00000000-0000-0000-0000-000000000001',
    accountId: 'a2000000-0000-0000-0000-000000000002', // BCA Utama
    name: 'Dana Darurat Terkunci',
    emoji: '🔒',
    type: 'locked',
    allocatedBalance: 2000000,
    targetAmount: 10000000,
    isLocked: true,
    sortOrder: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const pocketRoutes = new Elysia({ prefix: '/api/v1' })
  .use(errorHandler)
  .use(authMiddleware)
  .get('/accounts/:accountId/pockets', async ({ params, user }) => {
    const list = demoPockets.filter(
      (p) => p.accountId === params.accountId && p.userId === user.userId
    );
    const totalAllocated = list.reduce((sum, p) => sum + p.allocatedBalance, 0);

    return successResponse({
      pockets: list,
      totalAllocated,
    });
  })
  .post('/accounts/:accountId/pockets', async ({ params, body, user }) => {
    const input = createPocketSchema.parse(body);

    const newPocket: PocketModel = {
      id: crypto.randomUUID(),
      userId: user.userId,
      accountId: params.accountId,
      name: input.name,
      emoji: input.emoji ?? '💰',
      type: input.type,
      allocatedBalance: input.initialAllocation ?? 0,
      targetAmount: input.targetAmount ?? null,
      isLocked: input.type === 'locked',
      sortOrder: input.sortOrder ?? 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    demoPockets.unshift(newPocket);

    try {
      await db.insert(schema.pockets).values({
        id: newPocket.id,
        userId: user.userId,
        accountId: params.accountId,
        name: newPocket.name,
        emoji: newPocket.emoji,
        type: newPocket.type,
        allocatedBalance: newPocket.allocatedBalance,
        targetAmount: newPocket.targetAmount,
        isLocked: newPocket.isLocked,
        sortOrder: newPocket.sortOrder,
      });
    } catch {}

    return successResponse(newPocket);
  })
  .patch('/pockets/:id', async ({ params, body, user }) => {
    const input = updatePocketSchema.parse(body);
    const pocket = demoPockets.find((p) => p.id === params.id && p.userId === user.userId);
    if (!pocket) {
      throw new Error('RESOURCE_NOT_FOUND');
    }

    if (input.name !== undefined) pocket.name = input.name;
    if (input.emoji !== undefined) pocket.emoji = input.emoji;
    if (input.type !== undefined) {
      pocket.type = input.type;
      if (input.type === 'locked') pocket.isLocked = true;
    }
    if (input.targetAmount !== undefined) pocket.targetAmount = input.targetAmount;
    if (input.isLocked !== undefined) pocket.isLocked = input.isLocked;
    if (input.sortOrder !== undefined) pocket.sortOrder = input.sortOrder;
    pocket.updatedAt = new Date().toISOString();

    try {
      await db.update(schema.pockets).set({
        name: pocket.name,
        emoji: pocket.emoji,
        type: pocket.type,
        targetAmount: pocket.targetAmount,
        isLocked: pocket.isLocked,
        sortOrder: pocket.sortOrder,
        updatedAt: new Date(pocket.updatedAt),
      }).where(eq(schema.pockets.id, pocket.id));
    } catch {}

    return successResponse(pocket);
  })
  .delete('/pockets/:id', async ({ params, user }) => {
    const index = demoPockets.findIndex((p) => p.id === params.id && p.userId === user.userId);
    if (index === -1) {
      throw new Error('RESOURCE_NOT_FOUND');
    }

    const removed = demoPockets[index];
    demoPockets.splice(index, 1);

    try {
      await db.delete(schema.pockets).where(eq(schema.pockets.id, params.id));
    } catch {}

    return successResponse({ id: params.id, freedBalance: removed.allocatedBalance, deleted: true });
  })
  .post('/pockets/transfer', async ({ body, user, set }) => {
    const input = pocketTransferSchema.parse(body);

    // Intra-account reallocation
    const sourcePocket = input.sourcePocketId
      ? demoPockets.find((p) => p.id === input.sourcePocketId && p.userId === user.userId && p.accountId === input.accountId)
      : null;

    const destPocket = input.destinationPocketId
      ? demoPockets.find((p) => p.id === input.destinationPocketId && p.userId === user.userId && p.accountId === input.accountId)
      : null;

    if (input.sourcePocketId && !sourcePocket) {
      set.status = 404;
      return { success: false, error: { code: 'RESOURCE_NOT_FOUND', message: 'Kantong sumber tidak ditemukan' } };
    }
    if (input.destinationPocketId && !destPocket) {
      set.status = 404;
      return { success: false, error: { code: 'RESOURCE_NOT_FOUND', message: 'Kantong tujuan tidak ditemukan' } };
    }

    if (sourcePocket) {
      if (sourcePocket.allocatedBalance < input.amount) {
        set.status = 400;
        return {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Saldo kantong sumber tidak mencukupi untuk transfer' },
        };
      }
      sourcePocket.allocatedBalance -= input.amount;
      sourcePocket.updatedAt = new Date().toISOString();

      try {
        await db.update(schema.pockets).set({
          allocatedBalance: sourcePocket.allocatedBalance,
          updatedAt: new Date(sourcePocket.updatedAt),
        }).where(eq(schema.pockets.id, sourcePocket.id));
      } catch {}
    }

    if (destPocket) {
      destPocket.allocatedBalance += input.amount;
      destPocket.updatedAt = new Date().toISOString();

      try {
        await db.update(schema.pockets).set({
          allocatedBalance: destPocket.allocatedBalance,
          updatedAt: new Date(destPocket.updatedAt),
        }).where(eq(schema.pockets.id, destPocket.id));
      } catch {}
    }

    return successResponse({
      message: 'Transfer alokasi antar kantong berhasil',
      sourcePocket,
      destinationPocket: destPocket,
      transferredAmount: input.amount,
    });
  });
