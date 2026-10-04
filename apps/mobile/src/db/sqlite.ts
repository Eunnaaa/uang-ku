import * as SQLite from 'expo-sqlite';
import { type TransactionModel, type AccountModel, type CategoryModel, type OutboxMutationModel } from '@uangku/contracts';

let dbInstance: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync('uangku_v1.db');
    await initLocalDatabase(dbInstance);
  }
  return dbInstance;
}

export async function initLocalDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS local_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'IDR',
      initial_balance INTEGER NOT NULL DEFAULT 0,
      is_default INTEGER NOT NULL DEFAULT 0,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_categories (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      icon TEXT,
      is_system INTEGER NOT NULL DEFAULT 0,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      destination_account_id TEXT,
      category_id TEXT,
      type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
      amount INTEGER NOT NULL,
      transfer_fee INTEGER DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'IDR',
      note TEXT,
      transaction_date TEXT NOT NULL,
      client_id TEXT UNIQUE NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_tx_date ON local_transactions(transaction_date DESC);
    CREATE INDEX IF NOT EXISTS idx_tx_account ON local_transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_tx_sync ON local_transactions(sync_status);

    CREATE TABLE IF NOT EXISTS mutation_outbox (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL UNIQUE,
      entity_type TEXT NOT NULL,
      operation TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await seedDefaultData(db);
}

async function seedDefaultData(db: SQLite.SQLiteDatabase): Promise<void> {
  const accountCount = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM local_accounts;');
  if (!accountCount || accountCount.count === 0) {
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO local_accounts (id, user_id, name, type, currency, initial_balance, is_default, is_archived, created_at, updated_at) VALUES
       ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Dompet Tunai', 'cash', 'IDR', 500000, 1, 0, ?, ?),
       ('a2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'BCA Utama', 'bank', 'IDR', 15000000, 0, 0, ?, ?),
       ('a3000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'GoPay', 'e_wallet', 'IDR', 250000, 0, 0, ?, ?);`,
      [now, now, now, now, now, now]
    );
  }

  const categoryCount = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM local_categories;');
  if (!categoryCount || categoryCount.count === 0) {
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO local_categories (id, user_id, name, type, icon, is_system, is_archived, created_at, updated_at) VALUES
       ('c1000000-0000-0000-0000-000000000001', NULL, 'Makanan & Minuman', 'expense', 'utensils', 1, 0, ?, ?),
       ('c1000000-0000-0000-0000-000000000002', NULL, 'Transportasi', 'expense', 'car', 1, 0, ?, ?),
       ('c1000000-0000-0000-0000-000000000003', NULL, 'Belanja & Kebutuhan', 'expense', 'shopping-bag', 1, 0, ?, ?),
       ('c1000000-0000-0000-0000-000000000004', NULL, 'Tagihan & Langganan', 'expense', 'file-text', 1, 0, ?, ?),
       ('c1000000-0000-0000-0000-000000000005', NULL, 'Hiburan & Liburan', 'expense', 'film', 1, 0, ?, ?),
       ('c1000000-0000-0000-0000-000000000006', NULL, 'Kesehatan', 'expense', 'heart', 1, 0, ?, ?),
       ('c1000000-0000-0000-0000-000000000007', NULL, 'Pendidikan', 'expense', 'book', 1, 0, ?, ?),
       ('c1000000-0000-0000-0000-000000000008', NULL, 'Lainnya', 'expense', 'more-horizontal', 1, 0, ?, ?),
       ('c2000000-0000-0000-0000-000000000001', NULL, 'Gaji Utama', 'income', 'briefcase', 1, 0, ?, ?),
       ('c2000000-0000-0000-0000-000000000002', NULL, 'Bonus & THR', 'income', 'gift', 1, 0, ?, ?),
       ('c2000000-0000-0000-0000-000000000003', NULL, 'Freelance & Proyek', 'income', 'laptop', 1, 0, ?, ?),
       ('c2000000-0000-0000-0000-000000000004', NULL, 'Hasil Bisnis', 'income', 'trending-up', 1, 0, ?, ?),
       ('c2000000-0000-0000-0000-000000000005', NULL, 'Pemberian / Hadiah', 'income', 'heart', 1, 0, ?, ?),
       ('c2000000-0000-0000-0000-000000000006', NULL, 'Lainnya', 'income', 'more-horizontal', 1, 0, ?, ?);`,
      [now, now, now, now, now, now, now, now, now, now, now, now, now, now, now, now, now, now, now, now, now, now, now, now, now, now, now, now]
    );
  }

  // Seed sample transactions if empty
  const txCount = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM local_transactions;');
  if (!txCount || txCount.count === 0) {
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO local_transactions (id, user_id, account_id, destination_account_id, category_id, type, amount, transfer_fee, currency, note, transaction_date, client_id, version, sync_status, created_at, updated_at) VALUES
       ('t1', '00000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', NULL, 'c2000000-0000-0000-0000-000000000001', 'income', 15000000, 0, 'IDR', 'Gaji Bulanan Oktober', '2026-10-01T09:00:00+07:00', 'cl-1', 1, 'synced', ?, ?),
       ('t2', '00000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-000000000003', NULL, 'transfer', 500000, 1000, 'IDR', 'Top up GoPay jajan', '2026-10-02T11:30:00+07:00', 'cl-2', 1, 'synced', ?, ?),
       ('t3', '00000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', NULL, 'c1000000-0000-0000-0000-000000000001', 'expense', 45000, 0, 'IDR', 'Makan siang Nasi Padang', '2026-10-04T12:30:00+07:00', 'cl-3', 1, 'synced', ?, ?);`,
      [now, now, now, now, now, now]
    );
  }
}

// Data Access Queries
export async function getLocalTransactions(filter?: { type?: string; accountId?: string }): Promise<TransactionModel[]> {
  const db = await getDb();
  let query = `
    SELECT 
      t.*,
      a.name as account_name, a.type as account_type,
      da.name as dest_account_name, da.type as dest_account_type,
      c.name as category_name, c.icon as category_icon
    FROM local_transactions t
    LEFT JOIN local_accounts a ON a.id = t.account_id
    LEFT JOIN local_accounts da ON da.id = t.destination_account_id
    LEFT JOIN local_categories c ON c.id = t.category_id
    WHERE t.deleted_at IS NULL
  `;
  const params: any[] = [];

  if (filter?.type && filter.type !== 'all') {
    query += ` AND t.type = ?`;
    params.push(filter.type);
  }
  if (filter?.accountId) {
    query += ` AND (t.account_id = ? OR t.destination_account_id = ?)`;
    params.push(filter.accountId, filter.accountId);
  }

  query += ` ORDER BY t.transaction_date DESC;`;

  const rows = await db.getAllAsync<any>(query, params);
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    accountId: r.account_id,
    destinationAccountId: r.destination_account_id,
    categoryId: r.category_id,
    type: r.type,
    amount: r.amount,
    transferFee: r.transfer_fee || 0,
    currency: r.currency,
    note: r.note,
    transactionDate: r.transaction_date,
    clientId: r.client_id,
    version: r.version,
    syncStatus: r.sync_status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deletedAt: r.deleted_at,
    account: r.account_name ? { id: r.account_id, name: r.account_name, type: r.account_type } : undefined,
    destinationAccount: r.dest_account_name ? { id: r.destination_account_id, name: r.dest_account_name, type: r.dest_account_type } : null,
    category: r.type === 'transfer' ? { id: 'transfer', name: 'Transfer Antar Akun', icon: 'repeat' } : (r.category_name ? { id: r.category_id, name: r.category_name, icon: r.category_icon } : null),
  }));
}

export async function insertLocalTransaction(tx: {
  accountId: string;
  destinationAccountId?: string | null;
  categoryId?: string | null;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  transferFee?: number;
  currency?: string;
  note?: string | null;
  transactionDate?: string;
}): Promise<TransactionModel> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const clientId = crypto.randomUUID();
  const now = new Date().toISOString();
  const txDate = tx.transactionDate || now;
  const currency = tx.currency || 'IDR';
  const fee = tx.transferFee || 0;

  await db.withTransactionAsync(async () => {
    // 1. Insert local transaction with pending_sync
    await db.runAsync(
      `INSERT INTO local_transactions (id, user_id, account_id, destination_account_id, category_id, type, amount, transfer_fee, currency, note, transaction_date, client_id, version, sync_status, created_at, updated_at)
       VALUES (?, '00000000-0000-0000-0000-000000000001', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'pending_sync', ?, ?);`,
      [id, tx.accountId, tx.destinationAccountId || null, tx.categoryId || null, tx.type, tx.amount, fee, currency, tx.note || null, txDate, clientId, now, now]
    );

    // 2. Insert into mutation outbox
    const payload = JSON.stringify({
      accountId: tx.accountId,
      destinationAccountId: tx.destinationAccountId || null,
      categoryId: tx.categoryId || null,
      type: tx.type,
      amount: tx.amount,
      transferFee: fee,
      currency,
      note: tx.note || null,
      transactionDate: txDate,
      version: 1,
    });

    await db.runAsync(
      `INSERT INTO mutation_outbox (id, client_id, entity_type, operation, entity_id, payload, retry_count, status, created_at, updated_at)
       VALUES (?, ?, 'transaction', 'create', ?, ?, 0, 'pending', ?, ?);`,
      [crypto.randomUUID(), clientId, id, payload, now, now]
    );
  });

  const list = await getLocalTransactions();
  return list.find((t) => t.id === id)!;
}

export async function deleteLocalTransaction(id: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync(`UPDATE local_transactions SET deleted_at = ?, sync_status = 'pending_sync', updated_at = ? WHERE id = ?;`, [now, now, id]);

    await db.runAsync(
      `INSERT INTO mutation_outbox (id, client_id, entity_type, operation, entity_id, payload, retry_count, status, created_at, updated_at)
       VALUES (?, ?, 'transaction', 'delete', ?, '{}', 0, 'pending', ?, ?);`,
      [crypto.randomUUID(), crypto.randomUUID(), id, now, now]
    );
  });
}

export async function getLocalAccounts(): Promise<AccountModel[]> {
  const db = await getDb();
  const query = `
    SELECT 
      a.*,
      (
        a.initial_balance
        + COALESCE((SELECT SUM(amount) FROM local_transactions WHERE account_id = a.id AND type = 'income' AND deleted_at IS NULL), 0)
        - COALESCE((SELECT SUM(amount) FROM local_transactions WHERE account_id = a.id AND type = 'expense' AND deleted_at IS NULL), 0)
        + COALESCE((SELECT SUM(amount) FROM local_transactions WHERE destination_account_id = a.id AND type = 'transfer' AND deleted_at IS NULL), 0)
        - COALESCE((SELECT SUM(amount + transfer_fee) FROM local_transactions WHERE account_id = a.id AND type = 'transfer' AND deleted_at IS NULL), 0)
      ) as current_balance
    FROM local_accounts a
    WHERE a.is_archived = 0
    ORDER BY a.is_default DESC, a.created_at ASC;
  `;

  const rows = await db.getAllAsync<any>(query);
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    name: r.name,
    type: r.type,
    currency: r.currency,
    initialBalance: r.initial_balance,
    currentBalance: r.current_balance,
    isDefault: Boolean(r.is_default),
    isArchived: Boolean(r.is_archived),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function getLocalCategories(type?: 'income' | 'expense'): Promise<CategoryModel[]> {
  const db = await getDb();
  let query = `SELECT * FROM local_categories WHERE is_archived = 0`;
  const params: any[] = [];
  if (type) {
    query += ` AND type = ?`;
    params.push(type);
  }
  query += ` ORDER BY is_system DESC, name ASC;`;
  const rows = await db.getAllAsync<any>(query, params);
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    name: r.name,
    type: r.type,
    icon: r.icon,
    isSystem: Boolean(r.is_system),
    isArchived: Boolean(r.is_archived),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function getLocalDashboardSummary(month: string) {
  const db = await getDb();
  const summaryRow = await db.getFirstAsync<{
    total_income: number;
    total_expense: number;
    total_fees: number;
  }>(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
      COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense,
      COALESCE(SUM(CASE WHEN type = 'transfer' THEN transfer_fee ELSE 0 END), 0) as total_fees
    FROM local_transactions
    WHERE deleted_at IS NULL AND transaction_date LIKE ?;
  `, [`${month}%`]);

  const accounts = await getLocalAccounts();
  const totalNetWorth = accounts.reduce((sum, a) => sum + (a.currentBalance || 0), 0);

  const totalIncome = summaryRow?.total_income || 0;
  const totalExpense = summaryRow?.total_expense || 0;
  const totalTransferFees = summaryRow?.total_fees || 0;
  const netCashFlow = totalIncome - totalExpense - totalTransferFees;

  return {
    month,
    totalIncome,
    totalExpense,
    totalTransferFees,
    netCashFlow,
    totalNetWorth,
  };
}
