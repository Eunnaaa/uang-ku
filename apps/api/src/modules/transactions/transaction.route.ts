import { Elysia } from 'elysia';
import { createTransactionSchema, updateTransactionSchema, queryTransactionSchema } from '@uangku/contracts';
import { authMiddleware } from '../../middleware/auth';
import { successResponse, paginatedResponse } from '../../middleware/error-handler';

// In-memory demo store for rapid testing and outbox synchronization
const demoTransactions: any[] = [
  {
    id: 't1000000-0000-0000-0000-000000000001',
    userId: '00000000-0000-0000-0000-000000000001',
    accountId: 'a2000000-0000-0000-0000-000000000002',
    destinationAccountId: null,
    categoryId: 'c2000000-0000-0000-0000-000000000001',
    type: 'income',
    amount: 15000000,
    transferFee: 0,
    currency: 'IDR',
    note: 'Gaji Bulanan Oktober',
    transactionDate: '2026-10-01T09:00:00+07:00',
    clientId: 'cl-100000-0000-0000-0000-000000000001',
    version: 1,
    createdAt: '2026-10-01T02:00:00Z',
    updatedAt: '2026-10-01T02:00:00Z',
    deletedAt: null,
    account: { id: 'a2000000-0000-0000-0000-000000000002', name: 'BCA Utama', type: 'bank' },
    category: { id: 'c2000000-0000-0000-0000-000000000001', name: 'Gaji Utama', icon: 'briefcase' },
  },
  {
    id: 't2000000-0000-0000-0000-000000000002',
    userId: '00000000-0000-0000-0000-000000000001',
    accountId: 'a2000000-0000-0000-0000-000000000002',
    destinationAccountId: 'a3000000-0000-0000-0000-000000000003',
    categoryId: null,
    type: 'transfer',
    amount: 500000,
    transferFee: 1000,
    currency: 'IDR',
    note: 'Top up GoPay jajan',
    transactionDate: '2026-10-02T11:30:00+07:00',
    clientId: 'cl-200000-0000-0000-0000-000000000002',
    version: 1,
    createdAt: '2026-10-02T04:30:00Z',
    updatedAt: '2026-10-02T04:30:00Z',
    deletedAt: null,
    account: { id: 'a2000000-0000-0000-0000-000000000002', name: 'BCA Utama', type: 'bank' },
    destinationAccount: { id: 'a3000000-0000-0000-0000-000000000003', name: 'GoPay', type: 'e_wallet' },
    category: { id: 'transfer', name: 'Transfer Antar Akun', icon: 'repeat' },
  },
  {
    id: 't3000000-0000-0000-0000-000000000003',
    userId: '00000000-0000-0000-0000-000000000001',
    accountId: 'a1000000-0000-0000-0000-000000000001',
    destinationAccountId: null,
    categoryId: 'c1000000-0000-0000-0000-000000000001',
    type: 'expense',
    amount: 45000,
    transferFee: 0,
    currency: 'IDR',
    note: 'Makan siang Nasi Kapau',
    transactionDate: '2026-10-04T12:45:00+07:00',
    clientId: 'cl-300000-0000-0000-0000-000000000003',
    version: 1,
    createdAt: '2026-10-04T05:45:00Z',
    updatedAt: '2026-10-04T05:45:00Z',
    deletedAt: null,
    account: { id: 'a1000000-0000-0000-0000-000000000001', name: 'Dompet Tunai', type: 'cash' },
    category: { id: 'c1000000-0000-0000-0000-000000000001', name: 'Makanan & Minuman', icon: 'utensils' },
  },
];

export const transactionRoutes = new Elysia({ prefix: '/api/v1/transactions' })
  .use(authMiddleware)
  .get('/', async ({ query }) => {
    const filters = queryTransactionSchema.parse(query);
    let items = demoTransactions.filter((t) => t.deletedAt === null);

    if (filters.type) {
      items = items.filter((t) => t.type === filters.type);
    }
    if (filters.accountId) {
      items = items.filter((t) => t.accountId === filters.accountId || t.destinationAccountId === filters.accountId);
    }
    if (filters.categoryId) {
      items = items.filter((t) => t.categoryId === filters.categoryId);
    }

    // Sort newest first
    items.sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());

    const limit = filters.limit || 30;
    const paginatedItems = items.slice(0, limit);
    const hasMore = items.length > limit;
    const nextCursor = hasMore ? Buffer.from(paginatedItems[paginatedItems.length - 1].transactionDate).toString('base64') : null;

    return paginatedResponse(paginatedItems, nextCursor, limit);
  })
  .post('/', async ({ body, headers, user }) => {
    const input = createTransactionSchema.parse(body);

    // Idempotency check via client_id
    const existing = demoTransactions.find((t) => t.clientId === input.clientId);
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
  .get('/:id', async ({ params }) => {
    const tx = demoTransactions.find((t) => t.id === params.id && t.deletedAt === null);
    if (!tx) {
      throw new Error('RESOURCE_NOT_FOUND');
    }
    return successResponse(tx);
  })
  .patch('/:id', async ({ params, body }) => {
    const input = updateTransactionSchema.parse(body);
    const tx = demoTransactions.find((t) => t.id === params.id && t.deletedAt === null);
    if (!tx) {
      throw new Error('RESOURCE_NOT_FOUND');
    }
    if (input.version <= tx.version) {
      throw new Error('SYNC_CONFLICT');
    }

    if (input.amount !== undefined) tx.amount = input.amount;
    if (input.transferFee !== undefined) tx.transferFee = input.transferFee;
    if (input.note !== undefined) tx.note = input.note;
    if (input.transactionDate) tx.transactionDate = input.transactionDate;
    if (input.categoryId !== undefined) tx.categoryId = input.categoryId;
    if (input.accountId) tx.accountId = input.accountId;
    if (input.destinationAccountId !== undefined) tx.destinationAccountId = input.destinationAccountId;
    tx.version = input.version;
    tx.updatedAt = new Date().toISOString();

    return successResponse(tx);
  })
  .delete('/:id', async ({ params }) => {
    const tx = demoTransactions.find((t) => t.id === params.id && t.deletedAt === null);
    if (!tx) {
      throw new Error('RESOURCE_NOT_FOUND');
    }
    tx.deletedAt = new Date().toISOString();
    tx.version += 1;
    tx.updatedAt = tx.deletedAt;
    return successResponse({ id: tx.id, deletedAt: tx.deletedAt });
  });

export { demoTransactions };
