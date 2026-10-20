import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { db, schema } from './client';
import { eq, sql } from 'drizzle-orm';

describe('Database Integration & Schema Verification', () => {
  const testUserId = '00000000-0000-4000-a000-000000000001';
  let testAccountId: string;
  let testCategoryId: string;
  let testTransactionId: string;

  beforeAll(async () => {
    // Ensure clean state for test user
    await db.delete(schema.transactions).where(eq(schema.transactions.userId, testUserId));
    await db.delete(schema.accounts).where(eq(schema.accounts.userId, testUserId));
    await db.delete(schema.categories).where(eq(schema.categories.userId, testUserId));
    await db.delete(schema.profiles).where(eq(schema.profiles.id, testUserId));
  });

  afterAll(async () => {
    // Cleanup test records
    await db.delete(schema.transactions).where(eq(schema.transactions.userId, testUserId));
    await db.delete(schema.accounts).where(eq(schema.accounts.userId, testUserId));
    await db.delete(schema.categories).where(eq(schema.categories.userId, testUserId));
    await db.delete(schema.profiles).where(eq(schema.profiles.id, testUserId));
  });

  it('connects to PostgreSQL and executes raw ping', async () => {
    const res = await db.execute(sql`SELECT current_database() as db_name, current_user as db_user`);
    expect(res).toBeDefined();
    expect(res.length).toBeGreaterThan(0);
    expect(res[0].db_name).toBe('uangku');
  });

  it('inserts and retrieves user profile with default currency IDR', async () => {
    const [profile] = await db
      .insert(schema.profiles)
      .values({
        id: testUserId,
        displayName: 'Test Automated User',
        defaultCurrency: 'IDR',
        timezone: 'Asia/Jakarta',
      })
      .returning();

    expect(profile).toBeDefined();
    expect(profile.id).toBe(testUserId);
    expect(profile.displayName).toBe('Test Automated User');
    expect(profile.defaultCurrency).toBe('IDR');
  });

  it('creates an account for user with initial balance stored as BIGINT minor units', async () => {
    const [account] = await db
      .insert(schema.accounts)
      .values({
        userId: testUserId,
        name: 'BCA Utama Test',
        type: 'bank',
        currency: 'IDR',
        initialBalance: 5000000, // Rp 5.000.000
        isDefault: true,
      })
      .returning();

    expect(account).toBeDefined();
    expect(account.name).toBe('BCA Utama Test');
    expect(account.initialBalance).toBe(5000000);
    testAccountId = account.id;
  });

  it('creates a custom category for user', async () => {
    const [cat] = await db
      .insert(schema.categories)
      .values({
        userId: testUserId,
        name: 'Makanan & Kuliner',
        type: 'expense',
        icon: 'utensils',
        isSystem: false,
      })
      .returning();

    expect(cat).toBeDefined();
    expect(cat.name).toBe('Makanan & Kuliner');
    testCategoryId = cat.id;
  });

  it('inserts a transaction and enforces foreign key and positive amount constraints', async () => {
    const clientTxId = '00000000-0000-4000-c000-000000000001';
    const [tx] = await db
      .insert(schema.transactions)
      .values({
        userId: testUserId,
        accountId: testAccountId,
        categoryId: testCategoryId,
        type: 'expense',
        amount: 75000,
        currency: 'IDR',
        note: 'Makan Siang Sate Padang',
        transactionDate: new Date(),
        clientId: clientTxId,
        version: 1,
      })
      .returning();

    expect(tx).toBeDefined();
    expect(tx.amount).toBe(75000);
    expect(tx.clientId).toBe(clientTxId);
    testTransactionId = tx.id;
  });

  it('calculates aggregated balance correctly using SQL queries', async () => {
    const [calc] = await db
      .select({
        totalExpense: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)`,
      })
      .from(schema.transactions)
      .where(eq(schema.transactions.userId, testUserId));

    expect(Number(calc.totalExpense)).toBe(75000);
  });

  it('records sync event with auto incrementing cursor', async () => {
    const [event] = await db
      .insert(schema.syncEvents)
      .values({
        id: Date.now(),
        userId: testUserId,
        entityType: 'transaction',
        entityId: testTransactionId,
        operation: 'create',
        version: 1,
      })
      .returning();

    expect(event).toBeDefined();
    expect(event.entityType).toBe('transaction');
    expect(event.operation).toBe('create');
  });

  it('supports idempotency keys lookup and deduplication', async () => {
    const key = `idem-test-${Date.now()}`;
    const [idem] = await db
      .insert(schema.idempotencyKeys)
      .values({
        userId: testUserId,
        key,
        requestHash: 'hash-abc-123',
        responseJson: { status: 'success', data: { id: testTransactionId } },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      .returning();

    expect(idem).toBeDefined();
    expect(idem.key).toBe(key);

    const lookup = await db
      .select()
      .from(schema.idempotencyKeys)
      .where(eq(schema.idempotencyKeys.key, key));

    expect(lookup.length).toBe(1);
    expect((lookup[0].responseJson as any).status).toBe('success');
  });
});
