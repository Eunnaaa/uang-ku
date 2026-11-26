import { createHash } from 'node:crypto';
import { and, asc, eq, getTableColumns, inArray, isNull, or, sql } from 'drizzle-orm';
import { Elysia } from 'elysia';
import { z } from 'zod';
import { createTransactionSchema, syncPushRequestSchema, syncPullQuerySchema, updateTransactionSchema,
  type SyncMutation, type SyncPushRequest } from '@uangku/contracts';
import { authMiddleware } from '../../middleware/auth';
import { successResponse } from '../../middleware/error-handler';
import { db, schema } from '../../db/client';
import { createEntry, changeEntry } from '../../db/ledger';

const { accounts, categories, pockets, transactions, idempotencyKeys } = schema;
class InvalidMutation extends Error {}
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function saveWallet(tx: Tx, owner: string, data: SyncPushRequest['accounts'][number]) {
  const values = { ...data, updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined };
  const insert = tx.insert(accounts).values({ ...values, userId: owner });
  if (values.updatedAt) await insert.onConflictDoUpdate({ target: accounts.id, set: values,
    setWhere: and(eq(accounts.userId,owner),sql`${accounts.updatedAt} < excluded.updated_at`) });
  else await insert.onConflictDoNothing();
}
async function saveCategory(tx: Tx, owner: string, data: SyncPushRequest['categories'][number]) {
  const values = { ...data, updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined };
  const insert = tx.insert(categories).values({ ...values, userId: owner });
  if (values.updatedAt) await insert.onConflictDoUpdate({ target: categories.id, set: values,
    setWhere: and(eq(categories.userId,owner),sql`${categories.updatedAt} < excluded.updated_at`) });
  else await insert.onConflictDoNothing();
}

async function ensureReferences(tx: Tx, owner: string, input: SyncPushRequest,
  record: { accountId: string; destinationAccountId?: string | null; categoryId?: string | null; pocketId?: string | null }) {
  for (const id of new Set([record.accountId, record.destinationAccountId].filter((x): x is string => !!x))) {
    const data = input.accounts.find(a => a.id === id);
    if (data) await saveWallet(tx,owner,data);
    const [ref] = await tx.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.id, id), eq(accounts.userId, owner)));
    if (!ref) throw new InvalidMutation('Dompet tidak tersedia.');
  }
  if (record.categoryId) {
    const data = input.categories.find(c => c.id === record.categoryId);
    if (data) await saveCategory(tx,owner,data);
    const [ref] = await tx.select({ id: categories.id }).from(categories).where(and(eq(categories.id, record.categoryId),
      or(eq(categories.userId, owner), and(isNull(categories.userId), eq(categories.isSystem, true)))));
    if (!ref) throw new InvalidMutation('Kategori tidak tersedia.');
  }
  if (record.pocketId) {
    const data = input.pockets.find(p => p.id === record.pocketId && p.accountId === record.accountId);
    if (data) {
      if (data.openingAllocation === undefined) throw new InvalidMutation('Perbarui aplikasi untuk menyinkronkan alokasi kantong.');
      await tx.insert(pockets).values({ ...data, allocatedBalance: data.openingAllocation, userId: owner }).onConflictDoNothing();
    }
    const [ref] = await tx.select({ id: pockets.id }).from(pockets).where(and(eq(pockets.id, record.pocketId),
      eq(pockets.userId, owner), eq(pockets.accountId, record.accountId)));
    if (!ref) throw new InvalidMutation('Kantong tidak tersedia.');
  }
}

async function apply(tx: Tx, owner: string, m: SyncMutation, input: SyncPushRequest) {
  if (m.entityType !== 'transaction') throw new InvalidMutation('Jenis mutasi tidak didukung.');
  const key = `sync:${owner}:${m.id}`;
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${m.entityId},0))`);
  const hash = createHash('sha256').update(JSON.stringify(m)).digest('hex');
  const [prior] = await tx.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, key));
  if (prior) {
    if (prior.requestHash !== hash) throw new InvalidMutation('ID mutasi sudah digunakan.');
    return { processed: prior.responseJson };
  }
  const where = and(eq(transactions.id, m.entityId), eq(transactions.userId, owner));
  const [current] = await tx.select().from(transactions).where(where).for('update');
  if (m.version !== (current?.version ?? 0) + 1 || (current && m.operation === 'create')) {
    return { conflict: { id: m.id, clientId: m.clientId, currentServerVersion: current?.version ?? 0 } };
  }
  let stored;
  if (m.operation === 'create') {
    const data = createTransactionSchema.parse({ ...m.payload, clientId: m.clientId });
    await ensureReferences(tx, owner, input, data);
    stored = await createEntry(tx,owner,data,m.entityId);
  } else {
    if (!current || current.deletedAt || current.clientId !== m.clientId) throw new InvalidMutation('Transaksi tidak tersedia.');
    if (m.operation === 'delete') {
      stored = await changeEntry(tx,owner,m.entityId,null);
    } else {
      const patch = updateTransactionSchema.parse({ ...m.payload, version: m.version });
      const data = createTransactionSchema.parse({ ...current, transactionDate: current.transactionDate.toISOString(), ...patch });
      await ensureReferences(tx, owner, input, data);
      stored = await changeEntry(tx,owner,m.entityId,patch);
    }
  }
  if (!stored) throw new Error('Sync write did not return a row');
  const ack = { id: m.id, clientId: stored.clientId, serverEntityId: stored.id, version: stored.version, status: 'applied' };
  await tx.insert(idempotencyKeys).values({ key, userId: owner, requestHash: hash, responseJson: ack,
    expiresAt: new Date('9999-12-31') });
  return { processed: ack };
}

export const syncRoutes = new Elysia({ prefix: '/api/v1/sync' })
  .use(authMiddleware)
  .post('/catalog', async ({ body, user }) => {
    const input = syncPushRequestSchema.pick({ ownerId: true, accounts: true, categories: true }).parse(body);
    if (input.ownerId !== user.userId) throw new Error('FORBIDDEN');
    await db.transaction(async tx => {
      for (const a of input.accounts) await saveWallet(tx,user.userId,a);
      for (const c of input.categories) await saveCategory(tx,user.userId,c);
      const owned = await tx.select({ id: accounts.id }).from(accounts).where(and(eq(accounts.userId,user.userId),inArray(accounts.id,input.accounts.map(a=>a.id))));
      const cats = await tx.select({ id: categories.id }).from(categories).where(and(eq(categories.userId,user.userId),inArray(categories.id,input.categories.map(c=>c.id))));
      if (owned.length !== input.accounts.length || cats.length !== input.categories.length) throw new Error('SYNC_CONFLICT');
    });
    return successResponse({ protocol: 3 });
  })
  .post('/push', async ({ body, user }) => {
    const input = syncPushRequestSchema.parse(body);
    if (input.ownerId && input.ownerId !== user.userId) throw new Error('FORBIDDEN');
    const processed = [], conflicts = [], rejected = [];
    for (const m of input.mutations) {
      try {
        const result = await db.transaction(tx => apply(tx, user.userId, m, input));
        if (result.conflict) conflicts.push(result.conflict);
        else processed.push(result.processed);
      } catch (err) {
        if (!(err instanceof InvalidMutation || err instanceof z.ZodError || (err instanceof Error && ['RESOURCE_NOT_FOUND','SYNC_CONFLICT'].includes(err.message)))) throw err;
        rejected.push({ id: m.id, error: err.message });
      }
    }
    return successResponse({ protocol: 2, processed, conflicts, rejected });
  })
  .get('/pull', async ({ query, user }) => {
    const { cursor, limit } = syncPullQuerySchema.parse(query);
    let after;
    if (cursor) {
      const decoded = Buffer.from(cursor, 'base64url').toString();
      // Old newest-first cursors cannot prove coverage. Replay once from the beginning.
      if (!/^\d{4}-\d\d-\d\dT.*Z$/.test(decoded)) {
        const [stamp, id] = z.tuple([z.string().datetime(), z.guid()]).parse(decoded.split('|'));
        after = sql`(${transactions.updatedAt}, ${transactions.id}) > (${stamp}::timestamptz, ${id}::uuid)`;
      }
    }
    const rows = await db.select({ ...getTableColumns(transactions),
      stamp: sql<string>`to_char(${transactions.updatedAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')` })
      .from(transactions).where(and(eq(transactions.userId, user.userId), after))
      .orderBy(asc(transactions.updatedAt), asc(transactions.id)).limit(limit + 1);
    const page = rows.slice(0, limit);
    const last = page.at(-1);
    const walletIds = page.flatMap(t => t.destinationAccountId ? [t.accountId, t.destinationAccountId] : [t.accountId]);
    const catIds = page.flatMap(t => t.categoryId ? [t.categoryId] : []);
    const pocketIds = page.flatMap(t => t.pocketId ? [t.pocketId] : []);
    return successResponse({
      changes: page.map(({ stamp, ...t }) => t),
      accounts: await db.select().from(accounts).where(and(eq(accounts.userId, user.userId), query.catalog === '1' ? undefined : inArray(accounts.id, walletIds))),
      categories: await db.select().from(categories).where(and(or(eq(categories.userId, user.userId), and(isNull(categories.userId),eq(categories.isSystem,true))), query.catalog === '1' ? undefined : inArray(categories.id, catIds))),
      pockets: await db.select({ ...getTableColumns(pockets), openingAllocation: sql`allocated_balance +
        coalesce((select sum(t.pocket_debit) from transactions t where t.pocket_id=pockets.id
        and t.user_id=pockets.user_id and t.deleted_at is null),0)`.mapWith(Number) })
        .from(pockets).where(and(eq(pockets.userId, user.userId), inArray(pockets.id, pocketIds))),
      nextCursor: last ? Buffer.from(`${last.stamp}|${last.id}`).toString('base64url') : null,
      hasMore: rows.length > limit,
    });
  });
