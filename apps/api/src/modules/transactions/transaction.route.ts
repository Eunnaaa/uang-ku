import { Elysia } from 'elysia';
import { createTransactionSchema, updateTransactionSchema, queryTransactionSchema } from '@uangku/contracts';
import { authMiddleware } from '../../middleware/auth';
import { successResponse, paginatedResponse, errorHandler } from '../../middleware/error-handler';

// In-memory demo store for rapid testing and outbox synchronization (clean state)
const demoTransactions: any[] = [];

export const transactionRoutes = new Elysia({ prefix: '/api/v1/transactions' })
  .use(errorHandler)
  .use(authMiddleware)
  .get('/', async ({ query, user }) => {
    const filters = queryTransactionSchema.parse(query);
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

    // Sort newest first
    items.sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());

    // Apply cursor filtering (items with transactionDate strictly earlier than decoded cursor date)
    if (filters.cursor) {
      try {
        const decodedDate = Buffer.from(filters.cursor, 'base64').toString('utf-8');
        items = items.filter((t) => new Date(t.transactionDate).getTime() < new Date(decodedDate).getTime());
      } catch {
        // Ignore invalid cursor format and proceed from beginning
      }
    }

    const limit = filters.limit || 30;
    const paginatedItems = items.slice(0, limit);
    const hasMore = items.length > limit;
    const nextCursor = hasMore ? Buffer.from(paginatedItems[paginatedItems.length - 1].transactionDate).toString('base64') : null;

    return paginatedResponse(paginatedItems, nextCursor, limit);
  })
  .post('/', async ({ body, headers, user }) => {
    const input = createTransactionSchema.parse(body);

    // Idempotency check via client_id and user_id
    const existing = demoTransactions.find((t) => t.clientId === input.clientId && t.userId === user.userId);
    if (existing) {
      return successResponse(existing);
    }

    const newTx = {
      id: crypto.randomUUID(),
      userId: user.userId,
      accountId: input.accountId,
      destinationAccountId: input.destinationAccountId || null,
      categoryId: input.categoryId || null,
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
      category: input.categoryId ? { id: input.categoryId, name: 'Kategori', icon: 'tag' } : null,
    };

    demoTransactions.unshift(newTx);
    return successResponse(newTx);
  })
  .get('/:id', async ({ params, user }) => {
    const tx = demoTransactions.find((t) => t.id === params.id && t.userId === user.userId && t.deletedAt === null);
    if (!tx) {
      throw new Error('RESOURCE_NOT_FOUND');
    }
    return successResponse(tx);
  })
  .patch('/:id', async ({ params, body, user }) => {
    const input = updateTransactionSchema.parse(body);
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
    tx.version = input.version;
    tx.updatedAt = new Date().toISOString();

    return successResponse(tx);
  })
  .delete('/:id', async ({ params, user }) => {
    const tx = demoTransactions.find((t) => t.id === params.id && t.userId === user.userId && t.deletedAt === null);
    if (!tx) {
      throw new Error('RESOURCE_NOT_FOUND');
    }
    tx.deletedAt = new Date().toISOString();
    tx.version += 1;
    tx.updatedAt = tx.deletedAt;
    return successResponse({ id: tx.id, deletedAt: tx.deletedAt });
  });

export { demoTransactions };
