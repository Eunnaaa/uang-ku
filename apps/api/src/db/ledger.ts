import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { createTransactionSchema, type CreateTransactionInput, type UpdateTransactionInput } from '@uangku/contracts';
import { db, schema } from './client';

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const { accounts, categories, transactions, pockets } = schema;

type References = Partial<Pick<CreateTransactionInput,'accountId' | 'destinationAccountId' | 'categoryId' | 'pocketId'>>;

export async function checkReferences(tx: Tx, owner: string, data: References) {
  for (const id of new Set([data.accountId, data.destinationAccountId].filter((v): v is string => !!v))) {
    if (!(await tx.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.id, id), eq(accounts.userId, owner))))[0]) {
      throw new Error('RESOURCE_NOT_FOUND');
    }
  }
  if (data.categoryId && !(await tx.select({ id: categories.id }).from(categories).where(and(
    eq(categories.id, data.categoryId), or(eq(categories.userId, owner), and(isNull(categories.userId), eq(categories.isSystem, true))))))[0]) {
    throw new Error('RESOURCE_NOT_FOUND');
  }
  if (data.pocketId && (!data.accountId || !(await tx.select({ id: pockets.id }).from(pockets).where(and(
    eq(pockets.id, data.pocketId), eq(pockets.accountId, data.accountId), eq(pockets.userId, owner))))[0])) {
    throw new Error('RESOURCE_NOT_FOUND');
  }
}

async function debit(tx: Tx, owner: string, data: CreateTransactionInput) {
  if (!data.pocketId || data.type !== 'expense') return 0;
  const where = and(eq(pockets.id, data.pocketId), eq(pockets.userId, owner), eq(pockets.accountId, data.accountId));
  const [p] = await tx.select().from(pockets).where(where).for('update');
  if (!p) throw new Error('RESOURCE_NOT_FOUND');
  const amount = Math.min(data.amount, p.allocatedBalance);
  await tx.update(pockets).set({ allocatedBalance: p.allocatedBalance - amount, updatedAt: new Date() }).where(where);
  return amount;
}

async function refund(tx: Tx, row: typeof transactions.$inferSelect) {
  if (!row.pocketId || row.type !== 'expense') return;
  // Legacy expenses do not record their actual split between pocket and wallet.
  if (row.pocketDebit === null) throw new Error('SYNC_CONFLICT');
  await tx.update(pockets).set({ allocatedBalance: sql`${pockets.allocatedBalance} + ${row.pocketDebit}`,
    updatedAt: new Date() }).where(and(eq(pockets.id, row.pocketId), eq(pockets.userId, row.userId), eq(pockets.accountId, row.accountId)));
}

export async function createEntry(tx: Tx, owner: string, input: CreateTransactionInput, id?: string) {
  const data = createTransactionSchema.parse(input);
  await checkReferences(tx, owner, data);
  const pocketDebit = await debit(tx, owner, data);
  const [row] = await tx.insert(transactions).values({ ...data, id, userId: owner, pocketDebit,
    transactionDate: new Date(data.transactionDate), updatedAt: sql`clock_timestamp()` }).returning();
  return row;
}

export async function changeEntry(tx: Tx, owner: string, id: string, patch: UpdateTransactionInput | null) {
  const where = and(eq(transactions.id, id), eq(transactions.userId, owner), isNull(transactions.deletedAt));
  const [row] = await tx.select().from(transactions).where(where).for('update');
  if (!row) throw new Error('RESOURCE_NOT_FOUND');
  const version = row.version + 1;
  if (!patch) {
    await refund(tx, row);
    return (await tx.update(transactions).set({ deletedAt: new Date(), version, updatedAt: sql`clock_timestamp()` })
      .where(where).returning())[0];
  }
  if (patch.version !== version) throw new Error('SYNC_CONFLICT');
  const data = createTransactionSchema.parse({ ...row, transactionDate: row.transactionDate.toISOString(), ...patch });
  await checkReferences(tx, owner, data);
  let pocketDebit = row.pocketDebit;
  if (row.pocketId !== (data.pocketId ?? null) || row.amount !== data.amount || row.type !== data.type) {
    await refund(tx, row);
    pocketDebit = await debit(tx, owner, data);
  }
  return (await tx.update(transactions).set({ ...data, transactionDate: new Date(data.transactionDate), pocketDebit,
    version, updatedAt: sql`clock_timestamp()` }).where(where).returning())[0];
}

export const walletBalance = sql<number>`(${accounts.initialBalance} + coalesce((select sum(case
  when t.account_id = accounts.id and t.type = 'income' then t.amount
  when t.account_id = accounts.id and t.type = 'expense' then -t.amount
  when t.account_id = accounts.id and t.type = 'transfer' then -t.amount-t.transfer_fee
  when t.destination_account_id = accounts.id and t.type = 'transfer' then t.amount else 0 end)
  from transactions t where t.user_id=accounts.user_id and t.deleted_at is null
  and (t.account_id=accounts.id or t.destination_account_id=accounts.id)),0))`.mapWith(Number);
