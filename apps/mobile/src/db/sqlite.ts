import * as SQLite from 'expo-sqlite';
import {
  type TransactionModel,
  type AccountModel,
  type CategoryModel,
  type OutboxMutationModel,
  type GoalModel,
  type RecurringRuleModel,
  type RecurringFrequency,
  type TemplateModel,
  type TemplatePayload,
} from '@uangku/contracts';
export type { GoalModel, RecurringRuleModel, RecurringFrequency, TemplateModel, TemplatePayload };

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
      reserved_amount INTEGER NOT NULL DEFAULT 0,
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
      receipt_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_tx_date ON local_transactions(transaction_date DESC);
    CREATE INDEX IF NOT EXISTS idx_tx_account ON local_transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_tx_dest_account ON local_transactions(destination_account_id);
    CREATE INDEX IF NOT EXISTS idx_tx_type ON local_transactions(type);
    CREATE INDEX IF NOT EXISTS idx_tx_category ON local_transactions(category_id);
    CREATE INDEX IF NOT EXISTS idx_tx_deleted_date ON local_transactions(deleted_at, transaction_date DESC);
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

    CREATE INDEX IF NOT EXISTS idx_outbox_status_created ON mutation_outbox(status, created_at ASC);

    CREATE TABLE IF NOT EXISTS sync_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_goals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      emoji TEXT,
      target_amount INTEGER NOT NULL,
      current_amount INTEGER NOT NULL DEFAULT 0,
      target_date TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_recurring_rules (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      category_id TEXT,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      frequency TEXT NOT NULL,
      note TEXT,
      next_due_date TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_rules_active_due ON local_recurring_rules(is_active, next_due_date ASC);
 
    CREATE TABLE IF NOT EXISTS local_templates (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      template_payload TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      use_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_templates_use ON local_templates(use_count DESC, sort_order ASC);
  `);

  // Migration for reserved_amount if missing
  try {
    await db.execAsync(`ALTER TABLE local_accounts ADD COLUMN reserved_amount INTEGER NOT NULL DEFAULT 0;`);
  } catch {
    // Column already exists
  }

  // Migration for receipt_url if missing (PRD Section 63)
  try {
    await db.execAsync(`ALTER TABLE local_transactions ADD COLUMN receipt_url TEXT;`);
  } catch {
    // Column already exists
  }

  // Automatic purge of dummy records from earlier development runs
  try {
    await db.execAsync(`
      DELETE FROM local_transactions WHERE id IN ('t1', 't2', 't3');
      DELETE FROM local_goals WHERE id IN ('g1', 'g2');
      DELETE FROM local_recurring_rules WHERE id IN ('r1', 'r2');
      UPDATE local_accounts SET initial_balance = 0, reserved_amount = 0 WHERE id IN ('a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000002', 'a3000000-0000-0000-0000-000000000003');
      DELETE FROM mutation_outbox WHERE client_id IN ('cl-1', 'cl-2', 'cl-3');
    `);
  } catch {
    // Ignore cleanup error if tables not yet populated
  }

  await seedDefaultData(db);
}

async function seedDefaultData(db: SQLite.SQLiteDatabase): Promise<void> {
  const accountCount = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM local_accounts;');
  if (!accountCount || accountCount.count === 0) {
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO local_accounts (id, user_id, name, type, currency, initial_balance, reserved_amount, is_default, is_archived, created_at, updated_at) VALUES
       ('a1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Dompet Tunai', 'cash', 'IDR', 0, 0, 1, 0, ?, ?),
       ('a2000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'BCA Utama', 'bank', 'IDR', 0, 0, 0, 0, ?, ?),
       ('a3000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'GoPay', 'e_wallet', 'IDR', 0, 0, 0, 0, ?, ?);`,
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
}

export async function clearAllLocalTransactions(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM local_transactions;
    DELETE FROM mutation_outbox;
    DELETE FROM local_goals;
    DELETE FROM local_recurring_rules;
    UPDATE local_accounts SET initial_balance = 0, reserved_amount = 0;
  `);
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
    receiptUrl: r.receipt_url || null,
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
  receiptUrl?: string | null;
  transactionDate?: string;
}): Promise<TransactionModel> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const clientId = crypto.randomUUID();
  const now = new Date().toISOString();
  const txDate = tx.transactionDate || now;
  const currency = tx.currency || 'IDR';
  const fee = tx.transferFee || 0;
  const receipt = tx.receiptUrl || null;

  await db.withTransactionAsync(async () => {
    // 1. Insert local transaction with pending_sync
    await db.runAsync(
      `INSERT INTO local_transactions (id, user_id, account_id, destination_account_id, category_id, type, amount, transfer_fee, currency, note, receipt_url, transaction_date, client_id, version, sync_status, created_at, updated_at)
       VALUES (?, '00000000-0000-0000-0000-000000000001', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'pending_sync', ?, ?);`,
      [id, tx.accountId, tx.destinationAccountId || null, tx.categoryId || null, tx.type, tx.amount, fee, currency, tx.note || null, receipt, txDate, clientId, now, now]
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
      receiptUrl: receipt,
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

export async function updateLocalTransaction(
  id: string,
  updates: {
    amount?: number;
    note?: string | null;
    categoryId?: string | null;
    accountId?: string;
    destinationAccountId?: string | null;
    transferFee?: number;
    transactionDate?: string;
    receiptUrl?: string | null;
  }
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  const list = await getLocalTransactions();
  const existing = list.find((t) => t.id === id);
  if (!existing) return;

  const newVersion = (existing.version || 1) + 1;
  const newAmount = updates.amount !== undefined ? updates.amount : existing.amount;
  const newNote = updates.note !== undefined ? updates.note : existing.note;
  const newCategoryId = updates.categoryId !== undefined ? updates.categoryId : existing.categoryId;
  const newAccountId = updates.accountId !== undefined ? updates.accountId : existing.accountId;
  const newDestAccountId = updates.destinationAccountId !== undefined ? updates.destinationAccountId : existing.destinationAccountId;
  const newFee = updates.transferFee !== undefined ? updates.transferFee : existing.transferFee;
  const newDate = updates.transactionDate !== undefined ? updates.transactionDate : existing.transactionDate;
  const newReceipt = updates.receiptUrl !== undefined ? updates.receiptUrl : existing.receiptUrl;

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE local_transactions
       SET amount = ?, note = ?, category_id = ?, account_id = ?, destination_account_id = ?, transfer_fee = ?, receipt_url = ?, transaction_date = ?, version = ?, sync_status = 'pending_sync', updated_at = ?
       WHERE id = ?;`,
      [newAmount, newNote ?? null, newCategoryId ?? null, newAccountId, newDestAccountId ?? null, newFee, newReceipt ?? null, newDate, newVersion, now, id]
    );

    const payload = JSON.stringify({
      amount: newAmount,
      note: newNote,
      categoryId: newCategoryId,
      accountId: newAccountId,
      destinationAccountId: newDestAccountId,
      transferFee: newFee,
      receiptUrl: newReceipt,
      transactionDate: newDate,
      version: newVersion,
    });

    await db.runAsync(
      `INSERT INTO mutation_outbox (id, client_id, entity_type, operation, entity_id, payload, retry_count, status, created_at, updated_at)
       VALUES (?, ?, 'transaction', 'update', ?, ?, 0, 'pending', ?, ?);`,
      [crypto.randomUUID(), existing.clientId, id, payload, now, now]
    );
  });
}

// PRD Section 68: Duplicate Transaction Detector
export async function checkPotentialDuplicateTransaction(params: {
  amount: number;
  accountId: string;
  type: 'income' | 'expense' | 'transfer';
}): Promise<TransactionModel | null> {
  const db = await getDb();
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const query = `
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
      AND t.amount = ?
      AND t.account_id = ?
      AND t.type = ?
      AND t.created_at >= ?
    ORDER BY t.created_at DESC
    LIMIT 1;
  `;
  const row = await db.getFirstAsync<any>(query, [params.amount, params.accountId, params.type, twoMinutesAgo]);
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    accountId: row.account_id,
    destinationAccountId: row.destination_account_id,
    categoryId: row.category_id,
    type: row.type,
    amount: row.amount,
    transferFee: row.transfer_fee || 0,
    currency: row.currency,
    note: row.note,
    transactionDate: row.transaction_date,
    clientId: row.client_id,
    version: row.version,
    syncStatus: row.sync_status,
    receiptUrl: row.receipt_url || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    account: row.account_name ? { id: row.account_id, name: row.account_name, type: row.account_type } : undefined,
    destinationAccount: row.dest_account_name ? { id: row.destination_account_id, name: row.dest_account_name, type: row.dest_account_type } : null,
    category: row.type === 'transfer' ? { id: 'transfer', name: 'Transfer Antar Akun', icon: 'repeat' } : (row.category_name ? { id: row.category_id, name: row.category_name, icon: row.category_icon } : null),
  };
}

// PRD Section 74: Bulk Actions on Transaction List
export async function bulkDeleteLocalTransactions(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    for (const id of ids) {
      await db.runAsync(`UPDATE local_transactions SET deleted_at = ?, sync_status = 'pending_sync', updated_at = ? WHERE id = ?;`, [now, now, id]);

      await db.runAsync(
        `INSERT INTO mutation_outbox (id, client_id, entity_type, operation, entity_id, payload, retry_count, status, created_at, updated_at)
         VALUES (?, ?, 'transaction', 'delete', ?, '{}', 0, 'pending', ?, ?);`,
        [crypto.randomUUID(), crypto.randomUUID(), id, now, now]
      );
    }
  });
}

export async function bulkRecategorizeTransactions(ids: string[], categoryId: string): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    for (const id of ids) {
      const existing = await db.getFirstAsync<any>(
        `SELECT client_id, version, amount, note, account_id, destination_account_id, transfer_fee, receipt_url, transaction_date FROM local_transactions WHERE id = ?;`,
        [id]
      );
      if (!existing) continue;

      const newVersion = (existing.version || 1) + 1;
      await db.runAsync(
        `UPDATE local_transactions SET category_id = ?, version = ?, sync_status = 'pending_sync', updated_at = ? WHERE id = ?;`,
        [categoryId, newVersion, now, id]
      );

      const payload = JSON.stringify({
        categoryId,
        amount: existing.amount,
        note: existing.note,
        accountId: existing.account_id,
        destinationAccountId: existing.destination_account_id,
        transferFee: existing.transfer_fee || 0,
        receiptUrl: existing.receipt_url,
        transactionDate: existing.transaction_date,
        version: newVersion,
      });

      await db.runAsync(
        `INSERT INTO mutation_outbox (id, client_id, entity_type, operation, entity_id, payload, retry_count, status, created_at, updated_at)
         VALUES (?, ?, 'transaction', 'update', ?, ?, 0, 'pending', ?, ?);`,
        [crypto.randomUUID(), existing.client_id, id, payload, now, now]
      );
    }
  });
}

export async function bulkTransferAccountTransactions(ids: string[], newAccountId: string): Promise<void> {
  if (ids.length === 0) return;
  const db = await getDb();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    for (const id of ids) {
      const existing = await db.getFirstAsync<any>(
        `SELECT client_id, version, amount, note, category_id, destination_account_id, transfer_fee, receipt_url, transaction_date FROM local_transactions WHERE id = ?;`,
        [id]
      );
      if (!existing) continue;

      const newVersion = (existing.version || 1) + 1;
      await db.runAsync(
        `UPDATE local_transactions SET account_id = ?, version = ?, sync_status = 'pending_sync', updated_at = ? WHERE id = ?;`,
        [newAccountId, newVersion, now, id]
      );

      const payload = JSON.stringify({
        accountId: newAccountId,
        categoryId: existing.category_id,
        amount: existing.amount,
        note: existing.note,
        destinationAccountId: existing.destination_account_id,
        transferFee: existing.transfer_fee || 0,
        receiptUrl: existing.receipt_url,
        transactionDate: existing.transaction_date,
        version: newVersion,
      });

      await db.runAsync(
        `INSERT INTO mutation_outbox (id, client_id, entity_type, operation, entity_id, payload, retry_count, status, created_at, updated_at)
         VALUES (?, ?, 'transaction', 'update', ?, ?, 0, 'pending', ?, ?);`,
        [crypto.randomUUID(), existing.client_id, id, payload, now, now]
      );
    }
  });
}

export async function insertLocalAccount(acc: {
  name: string;
  type: string;
  initialBalance?: number;
  reservedAmount?: number;
  currency?: string;
}): Promise<AccountModel> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const initial = acc.initialBalance || 0;
  const reserved = acc.reservedAmount || 0;
  const currency = acc.currency || 'IDR';

  await db.runAsync(
    `INSERT INTO local_accounts (id, user_id, name, type, currency, initial_balance, reserved_amount, is_default, is_archived, created_at, updated_at)
     VALUES (?, '00000000-0000-0000-0000-000000000001', ?, ?, ?, ?, ?, 0, 0, ?, ?);`,
    [id, acc.name, acc.type, currency, initial, reserved, now, now]
  );

  const accounts = await getLocalAccounts();
  return accounts.find((a) => a.id === id)!;
}

export async function archiveLocalAccount(id: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE local_accounts SET is_archived = 1, updated_at = ? WHERE id = ?;`,
    [now, id]
  );
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
    reservedAmount: r.reserved_amount || 0,
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

export async function insertLocalCategory(cat: {
  name: string;
  type: 'income' | 'expense';
  icon?: string;
}): Promise<CategoryModel> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const icon = cat.icon || 'more-horizontal';

  await db.runAsync(
    `INSERT INTO local_categories (id, user_id, name, type, icon, is_system, is_archived, created_at, updated_at)
     VALUES (?, '00000000-0000-0000-0000-000000000001', ?, ?, ?, 0, 0, ?, ?);`,
    [id, cat.name, cat.type, icon, now, now]
  );

  const list = await getLocalCategories();
  return list.find((c) => c.id === id)!;
}

export async function archiveLocalCategory(id: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE local_categories SET is_archived = 1, updated_at = ? WHERE id = ?;`,
    [now, id]
  );
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
  const totalReserved = accounts.reduce((sum, a) => sum + (a.reservedAmount || 0), 0);
  const availableNetWorth = totalNetWorth - totalReserved;

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
    availableNetWorth,
    totalReserved,
  };
}

export async function getLocalBudgets(): Promise<Record<string, number>> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(`SELECT value FROM sync_metadata WHERE key = 'budgets_v1';`);
  if (!row) {
    return {};
  }
  try {
    return JSON.parse(row.value);
  } catch {
    return {};
  }
}

export async function saveLocalBudget(categoryId: string, limit: number): Promise<void> {
  const db = await getDb();
  const current = await getLocalBudgets();
  current[categoryId] = limit;
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO sync_metadata (key, value, updated_at) VALUES ('budgets_v1', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
    [JSON.stringify(current), now]
  );
}

export async function getLocalGoals(): Promise<GoalModel[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM local_goals WHERE status != 'archived' ORDER BY created_at DESC;`
  );
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    name: r.name,
    emoji: r.emoji,
    targetAmount: r.target_amount,
    currentAmount: r.current_amount,
    targetDate: r.target_date,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function insertLocalGoal(goal: {
  name: string;
  emoji?: string;
  targetAmount: number;
  targetDate?: string;
  initialAmount?: number;
}): Promise<GoalModel> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const currentAmount = goal.initialAmount || 0;
  const status = currentAmount >= goal.targetAmount ? 'achieved' : 'active';

  await db.runAsync(
    `INSERT INTO local_goals (id, user_id, name, emoji, target_amount, current_amount, target_date, status, created_at, updated_at)
     VALUES (?, '00000000-0000-0000-0000-000000000001', ?, ?, ?, ?, ?, ?, ?, ?);`,
    [id, goal.name, goal.emoji || '🎯', goal.targetAmount, currentAmount, goal.targetDate || null, status, now, now]
  );

  const goals = await getLocalGoals();
  return goals.find((g) => g.id === id)!;
}

export async function addSavingsToGoal(goalId: string, amount: number): Promise<{ goal: GoalModel; isJustAchieved: boolean }> {
  const db = await getDb();
  const existing = await db.getFirstAsync<any>(`SELECT * FROM local_goals WHERE id = ?;`, [goalId]);
  if (!existing) {
    throw new Error('Goal tidak ditemukan');
  }

  const newAmount = existing.current_amount + amount;
  const isJustAchieved = newAmount >= existing.target_amount && existing.status !== 'achieved';
  const newStatus = newAmount >= existing.target_amount ? 'achieved' : 'active';
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE local_goals SET current_amount = ?, status = ?, updated_at = ? WHERE id = ?;`,
      [newAmount, newStatus, now, goalId]
    );

    // Otomatis kunci saldo di akun utama sebagai reserved_amount
    await db.runAsync(
      `UPDATE local_accounts 
       SET reserved_amount = reserved_amount + ?, updated_at = ?
       WHERE id = (SELECT id FROM local_accounts WHERE is_archived = 0 ORDER BY is_default DESC, created_at ASC LIMIT 1);`,
      [amount, now]
    );
  });

  const goals = await getLocalGoals();
  const updated = goals.find((g) => g.id === goalId)!;
  return { goal: updated, isJustAchieved };
}

export async function deleteLocalGoal(goalId: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  const existing = await db.getFirstAsync<any>(`SELECT * FROM local_goals WHERE id = ?;`, [goalId]);

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE local_goals SET status = 'archived', updated_at = ? WHERE id = ?;`,
      [now, goalId]
    );

    if (existing && existing.current_amount > 0) {
      await db.runAsync(
        `UPDATE local_accounts
         SET reserved_amount = MAX(0, reserved_amount - ?), updated_at = ?
         WHERE id = (SELECT id FROM local_accounts WHERE is_archived = 0 ORDER BY is_default DESC, created_at ASC LIMIT 1);`,
        [existing.current_amount, now]
      );
    }
  });
}

export async function updateLocalAccount(
  id: string,
  data: { name?: string; type?: 'bank' | 'cash' | 'e_wallet'; initialBalance?: number; reservedAmount?: number }
): Promise<void> {
  const db = await getDb();
  const updates: string[] = [];
  const params: any[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    params.push(data.name);
  }
  if (data.type !== undefined) {
    updates.push('type = ?');
    params.push(data.type);
  }
  if (data.initialBalance !== undefined) {
    updates.push('initial_balance = ?');
    params.push(data.initialBalance);
  }
  if (data.reservedAmount !== undefined) {
    updates.push('reserved_amount = ?');
    params.push(data.reservedAmount);
  }

  if (updates.length === 0) return;

  updates.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);

  await db.runAsync(`UPDATE local_accounts SET ${updates.join(', ')} WHERE id = ?;`, params);
}

export async function updateLocalCategory(
  id: string,
  data: { name?: string; icon?: string }
): Promise<void> {
  const db = await getDb();
  const updates: string[] = [];
  const params: any[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    params.push(data.name);
  }
  if (data.icon !== undefined) {
    updates.push('icon = ?');
    params.push(data.icon);
  }

  if (updates.length === 0) return;

  updates.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);

  await db.runAsync(`UPDATE local_categories SET ${updates.join(', ')} WHERE id = ?;`, params);
}

export async function importTransactionsFromCsv(csvText: string): Promise<{ success: number; failed: number }> {
  const accounts = await getLocalAccounts();
  const defaultAccount = accounts.find((a) => a.isDefault) || accounts[0];
  if (!defaultAccount) {
    throw new Error('Tidak ada akun tersedia untuk import');
  }

  const categories = await getLocalCategories();
  const defaultExpenseCategory = categories.find((c) => c.type === 'expense') || categories[0];
  const defaultIncomeCategory = categories.find((c) => c.type === 'income') || categories[0];

  // Strip BOM
  const cleanCsv = csvText.replace(/^\uFEFF/, '').trim();
  const lines = cleanCsv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { success: 0, failed: 0 };
  }

  const headerLine = lines[0];
  const delimiter = headerLine.includes(';') ? ';' : ',';
  const headers = headerLine.split(delimiter).map((h) => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));

  let dateIdx = headers.findIndex((h) => h.includes('tanggal') || h.includes('date') || h.includes('tgl'));
  let amountIdx = headers.findIndex((h) => h.includes('nominal') || h.includes('jumlah') || h.includes('amount') || h.includes('nilai'));
  let typeIdx = headers.findIndex((h) => h.includes('tipe') || h.includes('type') || h.includes('jenis'));
  let catIdx = headers.findIndex((h) => h.includes('kategori') || h.includes('category'));
  let noteIdx = headers.findIndex((h) => h.includes('catatan') || h.includes('note') || h.includes('keterangan') || h.includes('deskripsi'));

  // Default fallback if indices not matched
  if (dateIdx === -1) dateIdx = 0;
  if (amountIdx === -1) amountIdx = 1;

  let successCount = 0;
  let failedCount = 0;

  // Max 1000 lines per PRD 71.4
  const dataLines = lines.slice(1, 1001);

  for (const line of dataLines) {
    try {
      // Simple split handling quotes
      const cols = line.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, ''));
      if (cols.length < 2) {
        failedCount++;
        continue;
      }

      const rawDate = cols[dateIdx] || '';
      const rawAmount = cols[amountIdx] || '';
      const rawType = typeIdx !== -1 ? (cols[typeIdx] || '').toLowerCase() : '';
      const rawCat = catIdx !== -1 ? cols[catIdx] : '';
      const rawNote = noteIdx !== -1 ? cols[noteIdx] : '';

      // Clean amount: remove non-digits
      const numericStr = rawAmount.replace(/[^0-9]/g, '');
      const parsedAmount = parseInt(numericStr, 10);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        failedCount++;
        continue;
      }

      // Parse type
      let txType: 'income' | 'expense' = 'expense';
      if (rawType.includes('in') || rawType.includes('masuk') || rawType.includes('pendapatan')) {
        txType = 'income';
      }

      // Match category
      let matchedCategory = categories.find(
        (c) => c.type === txType && rawCat && c.name.toLowerCase().includes(rawCat.toLowerCase())
      );
      if (!matchedCategory) {
        matchedCategory = txType === 'income' ? defaultIncomeCategory : defaultExpenseCategory;
      }

      // Parse date to ISO
      let validDate = new Date().toISOString();
      if (rawDate) {
        const parsedD = new Date(rawDate);
        if (!isNaN(parsedD.getTime())) {
          validDate = parsedD.toISOString();
        }
      }

      await insertLocalTransaction({
        accountId: defaultAccount.id,
        categoryId: matchedCategory ? matchedCategory.id : null,
        type: txType,
        amount: parsedAmount,
        currency: 'IDR',
        note: rawNote ? `${rawNote} (CSV)` : 'Impor CSV',
        transactionDate: validDate,
      });

      successCount++;
    } catch {
      failedCount++;
    }
  }

  return { success: successCount, failed: failedCount };
}

export async function getLocalRecurringRules(): Promise<RecurringRuleModel[]> {
  const db = await getDb();
  const query = `
    SELECT 
      r.*,
      a.name as account_name,
      c.name as category_name
    FROM local_recurring_rules r
    LEFT JOIN local_accounts a ON a.id = r.account_id
    LEFT JOIN local_categories c ON c.id = r.category_id
    ORDER BY r.created_at DESC;
  `;
  const rows = await db.getAllAsync<any>(query);
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    accountId: r.account_id,
    categoryId: r.category_id,
    type: r.type,
    amount: r.amount,
    frequency: r.frequency,
    note: r.note,
    nextDueDate: r.next_due_date,
    isActive: Boolean(r.is_active),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    accountName: r.account_name,
    categoryName: r.category_name,
  }));
}

export async function insertLocalRecurringRule(rule: {
  accountId: string;
  categoryId?: string | null;
  type: 'income' | 'expense';
  amount: number;
  frequency: RecurringFrequency;
  note?: string | null;
  nextDueDate?: string;
}): Promise<RecurringRuleModel> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const dueDate = rule.nextDueDate || now.slice(0, 10);

  await db.runAsync(
    `INSERT INTO local_recurring_rules (id, user_id, account_id, category_id, type, amount, frequency, note, next_due_date, is_active, created_at, updated_at)
     VALUES (?, '00000000-0000-0000-0000-000000000001', ?, ?, ?, ?, ?, ?, ?, 1, ?, ?);`,
    [id, rule.accountId, rule.categoryId || null, rule.type, rule.amount, rule.frequency, rule.note || null, dueDate, now, now]
  );

  const list = await getLocalRecurringRules();
  return list.find((r) => r.id === id)!;
}

export async function toggleLocalRecurringRule(id: string, isActive: boolean): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE local_recurring_rules SET is_active = ?, updated_at = ? WHERE id = ?;`,
    [isActive ? 1 : 0, now, id]
  );
}

export async function deleteLocalRecurringRule(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM local_recurring_rules WHERE id = ?;`, [id]);
}

export async function executeRecurringRule(id: string): Promise<TransactionModel> {
  const db = await getDb();
  const rule = await db.getFirstAsync<any>(`SELECT * FROM local_recurring_rules WHERE id = ?;`, [id]);
  if (!rule) {
    throw new Error('Aturan berulang tidak ditemukan');
  }

  // Record actual transaction
  const noteText = rule.note ? `${rule.note} (Otomatis)` : `Transaksi Berulang (${rule.frequency})`;
  const tx = await insertLocalTransaction({
    accountId: rule.account_id,
    categoryId: rule.category_id,
    type: rule.type,
    amount: rule.amount,
    currency: 'IDR',
    note: noteText,
    transactionDate: new Date().toISOString(),
  });

  // Advance next due date forward
  const currentDue = new Date(rule.next_due_date || new Date());
  if (rule.frequency === 'daily') currentDue.setDate(currentDue.getDate() + 1);
  else if (rule.frequency === 'weekly') currentDue.setDate(currentDue.getDate() + 7);
  else if (rule.frequency === 'biweekly') currentDue.setDate(currentDue.getDate() + 14);
  else if (rule.frequency === 'monthly') currentDue.setMonth(currentDue.getMonth() + 1);
  else if (rule.frequency === 'yearly') currentDue.setFullYear(currentDue.getFullYear() + 1);

  const nextDueStr = currentDue.toISOString().slice(0, 10);
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE local_recurring_rules SET next_due_date = ?, updated_at = ? WHERE id = ?;`,
    [nextDueStr, now, id]
  );

  return tx;
}

export async function getLocalTemplates(): Promise<TemplateModel[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM local_templates ORDER BY use_count DESC, sort_order ASC, created_at DESC;`
  );
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    name: r.name,
    templatePayload: JSON.parse(r.template_payload),
    sortOrder: r.sort_order,
    useCount: r.use_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function insertLocalTemplate(t: {
  name: string;
  templatePayload: TemplatePayload;
  sortOrder?: number;
}): Promise<TemplateModel> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const payloadStr = JSON.stringify(t.templatePayload);
  const sort = t.sortOrder || 0;

  await db.runAsync(
    `INSERT INTO local_templates (id, user_id, name, template_payload, sort_order, use_count, created_at, updated_at)
     VALUES (?, '00000000-0000-0000-0000-000000000001', ?, ?, ?, 0, ?, ?);`,
    [id, t.name.trim(), payloadStr, sort, now, now]
  );

  return {
    id,
    userId: '00000000-0000-0000-0000-000000000001',
    name: t.name.trim(),
    templatePayload: t.templatePayload,
    sortOrder: sort,
    useCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export async function incrementLocalTemplateUseCount(id: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE local_templates SET use_count = use_count + 1, updated_at = ? WHERE id = ?;`,
    [now, id]
  );
}

export async function deleteLocalTemplate(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM local_templates WHERE id = ?;`, [id]);
}

