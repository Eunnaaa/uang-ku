import { Elysia } from 'elysia';
import { createAccountSchema, updateAccountSchema, type AccountModel } from '@uangku/contracts';
import { authMiddleware } from '../../middleware/auth';
import { successResponse } from '../../middleware/error-handler';
import { db, schema } from '../../db/client';
import { eq } from 'drizzle-orm';

// In-memory demo store fallback for rapid MVP testing when DB is booting (clean state)
const defaultDemoAccounts: AccountModel[] = [
  {
    id: 'a1000000-0000-0000-0000-000000000001',
    userId: '00000000-0000-0000-0000-000000000001',
    name: 'Dompet Tunai',
    type: 'cash',
    currency: 'IDR',
    initialBalance: 0,
    currentBalance: 0,
    isDefault: true,
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'a2000000-0000-0000-0000-000000000002',
    userId: '00000000-0000-0000-0000-000000000001',
    name: 'BCA Utama',
    type: 'bank',
    currency: 'IDR',
    initialBalance: 0,
    currentBalance: 0,
    isDefault: false,
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'a3000000-0000-0000-0000-000000000003',
    userId: '00000000-0000-0000-0000-000000000001',
    name: 'GoPay',
    type: 'e_wallet',
    currency: 'IDR',
    initialBalance: 0,
    currentBalance: 0,
    isDefault: false,
    isArchived: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const accountRoutes = new Elysia({ prefix: '/api/v1/accounts' })
  .use(authMiddleware)
  .get('/', async ({ user }) => {
    // 1. Try querying PostgreSQL first
    try {
      const dbAccounts = await db
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.userId, user.userId));

      const activeAccounts = dbAccounts.filter((a) => !a.isArchived);
      if (activeAccounts.length > 0) {
        return successResponse(
          activeAccounts.map((a) => ({
            ...a,
            currentBalance: a.initialBalance,
            createdAt: a.createdAt.toISOString(),
            updatedAt: a.updatedAt.toISOString(),
          }))
        );
      }
    } catch {}

    // 2. Return user accounts from in-memory fallback
    const userAccounts = defaultDemoAccounts.filter((a) => !a.isArchived && a.userId === user.userId);
    return successResponse(userAccounts);
  })
  .post('/', async ({ body, user }) => {
    const input = createAccountSchema.parse(body);
    const newId = crypto.randomUUID();
    const now = new Date();

    const newAccount: AccountModel = {
      id: newId,
      userId: user.userId,
      name: input.name,
      type: input.type,
      currency: input.currency || 'IDR',
      initialBalance: input.initialBalance,
      currentBalance: input.initialBalance,
      isDefault: false,
      isArchived: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    defaultDemoAccounts.push(newAccount);

    try {
      await db.insert(schema.accounts).values({
        id: newAccount.id,
        userId: user.userId,
        name: newAccount.name,
        type: newAccount.type,
        currency: newAccount.currency,
        initialBalance: newAccount.initialBalance,
        isDefault: false,
        isArchived: false,
      });
    } catch {}

    return successResponse(newAccount);
  })
  .patch('/:id', async ({ params, body, user }) => {
    const input = updateAccountSchema.parse(body);

    try {
      await db.update(schema.accounts).set({
        ...(input.name && { name: input.name }),
        ...(input.type && { type: input.type }),
        ...(input.isArchived !== undefined && { isArchived: input.isArchived }),
        updatedAt: new Date(),
      }).where(eq(schema.accounts.id, params.id));
    } catch {}

    const account = defaultDemoAccounts.find((a) => a.id === params.id && a.userId === user.userId);
    if (!account) {
      throw new Error('RESOURCE_NOT_FOUND');
    }
    if (input.name) account.name = input.name;
    if (input.type) account.type = input.type;
    if (input.isArchived !== undefined) account.isArchived = input.isArchived;
    account.updatedAt = new Date().toISOString();

    return successResponse(account);
  })
  .delete('/:id', async ({ params, user }) => {
    try {
      await db.update(schema.accounts).set({
        isArchived: true,
        updatedAt: new Date(),
      }).where(eq(schema.accounts.id, params.id));
    } catch {}

    const account = defaultDemoAccounts.find((a) => a.id === params.id && a.userId === user.userId);
    if (!account) {
      throw new Error('RESOURCE_NOT_FOUND');
    }
    account.isArchived = true;
    account.updatedAt = new Date().toISOString();

    return successResponse({ id: account.id, isArchived: true });
  });
