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
  type PocketModel,
  type PocketType,
  type PocketMemberModel,
  type PocketContributionModel,
  type PocketMemberRole,
  type BankConnectionModel,
  type BankMutationModel,
  type TransactionHistoryModel,
} from '@uangku/contracts';
export type {
  GoalModel,
  RecurringRuleModel,
  RecurringFrequency,
  TemplateModel,
  TemplatePayload,
  PocketModel,
  PocketType,
  PocketMemberModel,
  PocketContributionModel,
  PocketMemberRole,
  BankConnectionModel,
  BankMutationModel,
  TransactionHistoryModel,
};

let dbInstance: SQLite.SQLiteDatabase | null = null;
let dbInitPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let currentActiveUserId = '00000000-0000-0000-0000-000000000001';
let hasAppliedCleanReset2026 = false;

export const AUTO_RESET_METADATA_KEY = 'auto_clean_reset_v20261026_zero_state';

export async function ensureAutomaticWipe(db: SQLite.SQLiteDatabase): Promise<void> {
  try {
    const isCleaned = await db.getFirstAsync<{ value: string }>(
      `SELECT value FROM sync_metadata WHERE key = ?;`,
      [AUTO_RESET_METADATA_KEY]
    );
    if (!isCleaned) {
      await db.execAsync(`
        DELETE FROM local_transactions;
        DELETE FROM mutation_outbox;
        DELETE FROM local_goals;
        DELETE FROM local_recurring_rules;
        DELETE FROM local_templates;
        DELETE FROM local_budgets;
        DELETE FROM local_pockets;
        DELETE FROM local_pocket_members;
        DELETE FROM local_pocket_contributions;
        DELETE FROM local_bank_connections;
        DELETE FROM local_bank_mutations;
        DELETE FROM local_transaction_history;
        DELETE FROM local_accounts WHERE id NOT IN (
          'a1000000-0000-0000-0000-000000000001',
          'a2000000-0000-0000-0000-000000000002',
          'a3000000-0000-0000-0000-000000000003'
        );
        UPDATE local_accounts SET initial_balance = 0, reserved_amount = 0;
        INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES ('${AUTO_RESET_METADATA_KEY}', '1', datetime('now'));
      `);
    }
  } catch (err) {
    console.warn('ensureAutomaticWipe error:', err);
  }
}

export function getActiveUserId(): string {
  return currentActiveUserId;
}

export function setActiveUserId(userId: string): void {
  if (userId && typeof userId === 'string') {
    currentActiveUserId = userId;
  }
}

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    if (!hasAppliedCleanReset2026) {
      hasAppliedCleanReset2026 = true;
      await ensureAutomaticWipe(dbInstance);
    }
    return dbInstance;
  }
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      try {
        const db = await SQLite.openDatabaseAsync('uangku_v1.db');
        await initLocalDatabase(db);
        await ensureAutomaticWipe(db);
        hasAppliedCleanReset2026 = true;
        dbInstance = db;
        return db;
      } catch (err) {
        dbInitPromise = null;
        throw err;
      }
    })();
  }
  return dbInitPromise;
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

    CREATE TABLE IF NOT EXISTS local_budgets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      category_id TEXT NOT NULL UNIQUE,
      amount INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'IDR',
      period TEXT NOT NULL DEFAULT 'monthly',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_budgets_user_cat ON local_budgets(user_id, category_id, is_active);

    CREATE TABLE IF NOT EXISTS local_pockets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      name TEXT NOT NULL,
      emoji TEXT,
      type TEXT NOT NULL CHECK (type IN ('spending', 'saving', 'locked', 'bills')),
      allocated_balance INTEGER NOT NULL DEFAULT 0,
      target_amount INTEGER,
      is_locked INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_pockets_acc ON local_pockets(account_id);

    CREATE TABLE IF NOT EXISTS local_bank_connections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      institution_code TEXT NOT NULL,
      masked_account_number TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      last_synced_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_bank_mutations (
      id TEXT PRIMARY KEY,
      connection_id TEXT NOT NULL,
      external_id TEXT UNIQUE NOT NULL,
      amount INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      transaction_time TEXT NOT NULL,
      reconciliation_status TEXT NOT NULL DEFAULT 'pending',
      matched_transaction_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_bank_mut_conn ON local_bank_mutations(connection_id, reconciliation_status);

    CREATE TABLE IF NOT EXISTS local_pocket_members (
      id TEXT PRIMARY KEY,
      pocket_id TEXT NOT NULL,
      user_id TEXT,
      name TEXT NOT NULL,
      avatar_emoji TEXT DEFAULT 'user',
      role TEXT NOT NULL DEFAULT 'contributor',
      total_contributed INTEGER NOT NULL DEFAULT 0,
      joined_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_pocket_members ON local_pocket_members(pocket_id);

    CREATE TABLE IF NOT EXISTS local_pocket_contributions (
      id TEXT PRIMARY KEY,
      pocket_id TEXT NOT NULL,
      member_id TEXT,
      member_name TEXT NOT NULL,
      member_avatar TEXT DEFAULT 'user',
      amount INTEGER NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_pocket_contribs ON local_pocket_contributions(pocket_id);

    CREATE TABLE IF NOT EXISTS local_transaction_history (
      id TEXT PRIMARY KEY,
      transaction_id TEXT NOT NULL,
      changed_by TEXT NOT NULL DEFAULT 'user',
      snapshot_before TEXT NOT NULL,
      snapshot_after TEXT NOT NULL,
      summary TEXT NOT NULL,
      changed_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tx_hist_id ON local_transaction_history(transaction_id, changed_at DESC);
  `);

  // Migration for color, is_hidden, and sort_order on local_accounts (PRD Section 73)
  try {
    await db.execAsync(`ALTER TABLE local_accounts ADD COLUMN color TEXT DEFAULT '#D4AF37';`);
  } catch {}
  try {
    await db.execAsync(`ALTER TABLE local_accounts ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0;`);
  } catch {}
  try {
    await db.execAsync(`ALTER TABLE local_accounts ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;`);
  } catch {}

  // Migration for is_shared and invite_code on local_pockets
  try {
    await db.execAsync(`ALTER TABLE local_pockets ADD COLUMN is_shared INTEGER NOT NULL DEFAULT 0;`);
  } catch {}
  try {
    await db.execAsync(`ALTER TABLE local_pockets ADD COLUMN invite_code TEXT;`);
  } catch {}

  // Migration for pocket_id on local_transactions (PRD Section 79.3)
  try {
    await db.execAsync(`ALTER TABLE local_transactions ADD COLUMN pocket_id TEXT;`);
  } catch {
    // Column already exists
  }

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

  // Automatic purge of dummy/test records and clean reset to zero
  await ensureAutomaticWipe(db);

  await seedDefaultData(db);
}

async function seedDefaultData(db: SQLite.SQLiteDatabase): Promise<void> {
  const accountCount = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM local_accounts;');
  if (!accountCount || accountCount.count === 0) {
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT OR IGNORE INTO local_accounts (id, user_id, name, type, currency, initial_balance, reserved_amount, is_default, is_archived, created_at, updated_at) VALUES
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
      `INSERT OR IGNORE INTO local_categories (id, user_id, name, type, icon, is_system, is_archived, created_at, updated_at) VALUES
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
    DELETE FROM local_templates;
    DELETE FROM local_budgets;
    DELETE FROM local_pockets;
    DELETE FROM local_pocket_members;
    DELETE FROM local_pocket_contributions;
    DELETE FROM local_bank_connections;
    DELETE FROM local_bank_mutations;
    DELETE FROM sync_metadata;
    UPDATE local_accounts SET initial_balance = 0, reserved_amount = 0;
    INSERT OR REPLACE INTO sync_metadata (key, value, updated_at) VALUES ('${AUTO_RESET_METADATA_KEY}', '1', datetime('now'));
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
      c.name as category_name, c.icon as category_icon,
      p.name as pocket_name, p.emoji as pocket_emoji, p.type as pocket_type,
      CASE WHEN bm.matched_transaction_id IS NOT NULL THEN 1 ELSE 0 END as is_bank_verified
    FROM local_transactions t
    LEFT JOIN local_accounts a ON a.id = t.account_id
    LEFT JOIN local_accounts da ON da.id = t.destination_account_id
    LEFT JOIN local_categories c ON c.id = t.category_id
    LEFT JOIN local_pockets p ON p.id = t.pocket_id
    LEFT JOIN (
      SELECT DISTINCT matched_transaction_id 
      FROM local_bank_mutations 
      WHERE reconciliation_status IN ('matched', 'created_as_new') AND matched_transaction_id IS NOT NULL
    ) bm ON bm.matched_transaction_id = t.id
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
    pocketId: r.pocket_id || null,
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
    pocket: r.pocket_name ? { id: r.pocket_id, name: r.pocket_name, emoji: r.pocket_emoji, type: r.pocket_type } : null,
    isBankVerified: Boolean(r.is_bank_verified),
  }));
}

export async function getLocalTransactionById(id: string): Promise<TransactionModel | null> {
  const db = await getDb();
  const query = `
    SELECT 
      t.*,
      a.name as account_name, a.type as account_type,
      da.name as dest_account_name, da.type as dest_account_type,
      c.name as category_name, c.icon as category_icon,
      p.name as pocket_name, p.emoji as pocket_emoji, p.type as pocket_type,
      CASE WHEN bm.matched_transaction_id IS NOT NULL THEN 1 ELSE 0 END as is_bank_verified
    FROM local_transactions t
    LEFT JOIN local_accounts a ON a.id = t.account_id
    LEFT JOIN local_accounts da ON da.id = t.destination_account_id
    LEFT JOIN local_categories c ON c.id = t.category_id
    LEFT JOIN local_pockets p ON p.id = t.pocket_id
    LEFT JOIN (
      SELECT DISTINCT matched_transaction_id 
      FROM local_bank_mutations 
      WHERE reconciliation_status IN ('matched', 'created_as_new') AND matched_transaction_id IS NOT NULL
    ) bm ON bm.matched_transaction_id = t.id
    WHERE t.id = ? AND t.deleted_at IS NULL
    LIMIT 1;
  `;
  const r = await db.getFirstAsync<any>(query, [id]);
  if (!r) return null;
  return {
    id: r.id,
    userId: r.user_id,
    accountId: r.account_id,
    destinationAccountId: r.destination_account_id,
    categoryId: r.category_id,
    pocketId: r.pocket_id || null,
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
    pocket: r.pocket_name ? { id: r.pocket_id, name: r.pocket_name, emoji: r.pocket_emoji, type: r.pocket_type } : null,
    isBankVerified: Boolean(r.is_bank_verified),
  };
}

export async function insertLocalTransaction(tx: {
  accountId: string;
  destinationAccountId?: string | null;
  categoryId?: string | null;
  pocketId?: string | null;
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
  const pocketId = tx.pocketId || null;

  await db.withTransactionAsync(async () => {
    // 1. Insert local transaction with pending_sync
    await db.runAsync(
      `INSERT INTO local_transactions (id, user_id, account_id, destination_account_id, category_id, pocket_id, type, amount, transfer_fee, currency, note, receipt_url, transaction_date, client_id, version, sync_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'pending_sync', ?, ?);`,
      [id, currentActiveUserId, tx.accountId, tx.destinationAccountId || null, tx.categoryId || null, pocketId, tx.type, tx.amount, fee, currency, tx.note || null, receipt, txDate, clientId, now, now]
    );

    // 2. If pocket specified and type is expense, deduct from pocket allocated balance
    if (pocketId && tx.type === 'expense') {
      await db.runAsync(
        `UPDATE local_pockets SET allocated_balance = MAX(0, allocated_balance - ?), updated_at = ? WHERE id = ?;`,
        [tx.amount, now, pocketId]
      );
    }

    // 3. Insert into mutation outbox
    const payload = JSON.stringify({
      accountId: tx.accountId,
      destinationAccountId: tx.destinationAccountId || null,
      categoryId: tx.categoryId || null,
      pocketId,
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

  const created = await getLocalTransactionById(id);
  if (!created) {
    throw new Error('Gagal memuat transaksi baru.');
  }
  return created;
}

export async function deleteLocalTransaction(id: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    // If transaction had a pocket and was an expense, restore the allocated balance
    const existingTx = await db.getFirstAsync<{ pocket_id: string | null; type: string; amount: number }>(
      `SELECT pocket_id, type, amount FROM local_transactions WHERE id = ?;`,
      [id]
    );
    if (existingTx?.pocket_id && existingTx.type === 'expense') {
      await db.runAsync(
        `UPDATE local_pockets SET allocated_balance = allocated_balance + ?, updated_at = ? WHERE id = ?;`,
        [existingTx.amount, now, existingTx.pocket_id]
      );
    }

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
  const existing = await getLocalTransactionById(id);
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

    // Adjust pocket balance if transaction is tied to a pocket
    if (existing.pocketId && existing.type === 'expense' && updates.amount !== undefined && updates.amount !== existing.amount) {
      const amountDiff = newAmount - existing.amount;
      await db.runAsync(
        `UPDATE local_pockets SET allocated_balance = MAX(0, allocated_balance - ?), updated_at = ? WHERE id = ?;`,
        [amountDiff, now, existing.pocketId]
      );
    }

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

    // PRD Section 69: Audit Log / Riwayat Perubahan Transaksi
    const changeItems: string[] = [];
    if (updates.amount !== undefined && updates.amount !== existing.amount) {
      changeItems.push(`Nominal: Rp ${existing.amount.toLocaleString('id-ID')} → Rp ${updates.amount.toLocaleString('id-ID')}`);
    }
    if (updates.note !== undefined && updates.note !== existing.note) {
      changeItems.push(`Catatan: "${existing.note || '-'}" → "${updates.note || '-'}"`);
    }
    if (updates.categoryId !== undefined && updates.categoryId !== existing.categoryId) {
      changeItems.push('Kategori diperbarui');
    }
    if (updates.accountId !== undefined && updates.accountId !== existing.accountId) {
      changeItems.push('Akun sumber dipindahkan');
    }
    if (updates.receiptUrl !== undefined && updates.receiptUrl !== existing.receiptUrl) {
      changeItems.push(updates.receiptUrl ? 'Foto bukti dilampirkan' : 'Foto bukti dihapus');
    }

    if (changeItems.length > 0) {
      const summaryText = changeItems.join('; ');
      await db.runAsync(
        `INSERT INTO local_transaction_history (id, transaction_id, changed_by, snapshot_before, snapshot_after, summary, changed_at)
         VALUES (?, ?, 'user', ?, ?, ?, ?);`,
        [
          crypto.randomUUID(),
          id,
          JSON.stringify(existing),
          JSON.stringify({ ...existing, ...updates, version: newVersion }),
          summaryText,
          now,
        ]
      );
    }
  });
}

export async function getLocalTransactionHistory(transactionId: string): Promise<TransactionHistoryModel[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM local_transaction_history WHERE transaction_id = ? ORDER BY changed_at DESC;`,
    [transactionId]
  );
  return rows.map((r) => ({
    id: r.id,
    transactionId: r.transaction_id,
    changedBy: r.changed_by,
    snapshotBefore: JSON.parse(r.snapshot_before || '{}'),
    snapshotAfter: JSON.parse(r.snapshot_after || '{}'),
    summary: r.summary,
    changedAt: r.changed_at,
  }));
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
      const row = await db.getFirstAsync<{ pocket_id: string | null; type: string; amount: number }>(
        `SELECT pocket_id, type, amount FROM local_transactions WHERE id = ?;`,
        [id]
      );
      if (row?.pocket_id && row.type === 'expense') {
        await db.runAsync(
          `UPDATE local_pockets SET allocated_balance = allocated_balance + ?, updated_at = ? WHERE id = ?;`,
          [row.amount, now, row.pocket_id]
        );
      }

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
  color?: string;
  isHidden?: boolean;
  sortOrder?: number;
  currency?: string;
}): Promise<AccountModel> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const initial = acc.initialBalance || 0;
  const reserved = acc.reservedAmount || 0;
  const color = acc.color || '#D4AF37';
  const isHidden = acc.isHidden ? 1 : 0;
  const sortOrder = acc.sortOrder || 0;
  const currency = acc.currency || 'IDR';

  await db.runAsync(
    `INSERT INTO local_accounts (id, user_id, name, type, currency, initial_balance, reserved_amount, color, is_hidden, sort_order, is_default, is_archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?);`,
    [id, currentActiveUserId, acc.name, acc.type, currency, initial, reserved, color, isHidden, sortOrder, now, now]
  );

  const accounts = await getLocalAccounts();
  return accounts.find((a) => a.id === id)!;
}

export async function archiveLocalAccount(id: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    const target = await db.getFirstAsync<{ is_default: number }>(
      `SELECT is_default FROM local_accounts WHERE id = ?;`,
      [id]
    );

    await db.runAsync(
      `UPDATE local_accounts SET is_archived = 1, is_default = 0, updated_at = ? WHERE id = ?;`,
      [now, id]
    );

    if (target?.is_default) {
      await db.runAsync(
        `UPDATE local_accounts SET is_default = 1, updated_at = ?
         WHERE id = (SELECT id FROM local_accounts WHERE is_archived = 0 ORDER BY sort_order ASC, created_at ASC LIMIT 1);`,
        [now]
      );
    }
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
      ) as current_balance,
      COALESCE((SELECT SUM(allocated_balance) FROM local_pockets WHERE account_id = a.id), 0) as allocated_amount
    FROM local_accounts a
    WHERE a.is_archived = 0
    ORDER BY a.sort_order ASC, a.is_default DESC, a.created_at ASC;
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
    reservedAmount: (r.allocated_amount || 0) + (r.reserved_amount || 0),
    allocatedAmount: r.allocated_amount || 0,
    color: r.color || '#D4AF37',
    isHidden: Boolean(r.is_hidden),
    sortOrder: r.sort_order || 0,
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
     VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?);`,
    [id, currentActiveUserId, cat.name, cat.type, icon, now, now]
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
  const availableNetWorth = Math.max(0, totalNetWorth - totalReserved);

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
  const rows = await db.getAllAsync<{ category_id: string; amount: number }>(
    `SELECT category_id, amount FROM local_budgets WHERE is_active = 1;`
  );
  const result: Record<string, number> = {};
  for (const r of rows) {
    result[r.category_id] = r.amount;
  }
  return result;
}

export async function saveLocalBudget(categoryId: string, limit: number): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO local_budgets (id, user_id, category_id, amount, currency, period, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'IDR', 'monthly', 1, ?, ?)
     ON CONFLICT(category_id) DO UPDATE SET 
       amount = excluded.amount, 
       is_active = 1,
       updated_at = excluded.updated_at;`,
    [crypto.randomUUID(), currentActiveUserId, categoryId, limit, now, now]
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
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [id, currentActiveUserId, goal.name, goal.emoji || 'target', goal.targetAmount, currentAmount, goal.targetDate || null, status, now, now]
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
  data: {
    name?: string;
    type?: 'bank' | 'cash' | 'e_wallet';
    initialBalance?: number;
    reservedAmount?: number;
    color?: string;
    isHidden?: boolean;
    sortOrder?: number;
  }
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
  if (data.color !== undefined) {
    updates.push('color = ?');
    params.push(data.color);
  }
  if (data.isHidden !== undefined) {
    updates.push('is_hidden = ?');
    params.push(data.isHidden ? 1 : 0);
  }
  if (data.sortOrder !== undefined) {
    updates.push('sort_order = ?');
    params.push(data.sortOrder);
  }

  if (updates.length === 0) return;

  updates.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);

  await db.runAsync(`UPDATE local_accounts SET ${updates.join(', ')} WHERE id = ?;`, params);
}

export async function setDefaultLocalAccount(id: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE local_accounts SET is_default = 0, updated_at = ?;', [now]);
    await db.runAsync('UPDATE local_accounts SET is_default = 1, updated_at = ? WHERE id = ?;', [now, id]);
  });
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
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?);`,
    [id, currentActiveUserId, rule.accountId, rule.categoryId || null, rule.type, rule.amount, rule.frequency, rule.note || null, dueDate, now, now]
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

  // Advance next due date forward safely avoiding end-of-month rollovers
  const currentDue = new Date(rule.next_due_date || new Date());
  if (rule.frequency === 'daily') {
    currentDue.setDate(currentDue.getDate() + 1);
  } else if (rule.frequency === 'weekly') {
    currentDue.setDate(currentDue.getDate() + 7);
  } else if (rule.frequency === 'biweekly') {
    currentDue.setDate(currentDue.getDate() + 14);
  } else if (rule.frequency === 'monthly') {
    const origDay = currentDue.getDate();
    const targetMonth = currentDue.getMonth() + 1;
    currentDue.setDate(1);
    currentDue.setMonth(targetMonth);
    const maxDays = new Date(currentDue.getFullYear(), currentDue.getMonth() + 1, 0).getDate();
    currentDue.setDate(Math.min(origDay, maxDays));
  } else if (rule.frequency === 'yearly') {
    const origDay = currentDue.getDate();
    const origMonth = currentDue.getMonth();
    const targetYear = currentDue.getFullYear() + 1;
    currentDue.setDate(1);
    currentDue.setFullYear(targetYear);
    currentDue.setMonth(origMonth);
    const maxDays = new Date(targetYear, origMonth + 1, 0).getDate();
    currentDue.setDate(Math.min(origDay, maxDays));
  }

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
     VALUES (?, ?, ?, ?, ?, 0, ?, ?);`,
    [id, currentActiveUserId, t.name.trim(), payloadStr, sort, now, now]
  );

  return {
    id,
    userId: currentActiveUserId,
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

// ==========================================
// POCKETS (KANTONG KEUANGAN) - PRD Section 79 & SHARED POCKETS
// ==========================================

function generateLocalInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'PKT-';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function getLocalPockets(accountId?: string): Promise<PocketModel[]> {
  const db = await getDb();
  let query = `
    SELECT 
      p.*, 
      a.name as account_name,
      (SELECT COUNT(*) FROM local_pocket_members WHERE pocket_id = p.id) as members_count
    FROM local_pockets p
    LEFT JOIN local_accounts a ON a.id = p.account_id
  `;
  const params: any[] = [];
  if (accountId) {
    query += ` WHERE p.account_id = ?`;
    params.push(accountId);
  }
  query += ` ORDER BY p.sort_order ASC, p.created_at ASC;`;

  const rows = await db.getAllAsync<any>(query, params);
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    accountId: r.account_id,
    name: r.name,
    emoji: r.emoji,
    type: r.type,
    allocatedBalance: r.allocated_balance,
    targetAmount: r.target_amount,
    isLocked: Boolean(r.is_locked),
    sortOrder: r.sort_order,
    isShared: Boolean(r.is_shared),
    inviteCode: r.invite_code || null,
    membersCount: Number(r.members_count || 0),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    accountName: r.account_name,
  }));
}

export async function insertLocalPocket(data: {
  accountId: string;
  name: string;
  emoji?: string;
  type: PocketType;
  initialAllocation?: number;
  targetAmount?: number;
  isShared?: boolean;
  inviteCode?: string;
}): Promise<PocketModel> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const alloc = data.initialAllocation || 0;
  const isLocked = data.type === 'locked' ? 1 : 0;
  const isShared = data.isShared || data.type === 'shared';
  const inviteCode = isShared ? (data.inviteCode || generateLocalInviteCode()) : null;

  await db.runAsync(
    `INSERT INTO local_pockets (id, user_id, account_id, name, emoji, type, allocated_balance, target_amount, is_locked, sort_order, is_shared, invite_code, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?);`,
    [
      id,
      currentActiveUserId,
      data.accountId,
      data.name.trim(),
      data.emoji || (isShared ? 'users' : 'wallet'),
      data.type,
      alloc,
      data.targetAmount || null,
      isLocked,
      isShared ? 1 : 0,
      inviteCode,
      now,
      now,
    ]
  );

  // If shared pocket, create owner member automatically
  if (isShared) {
    const memberId = crypto.randomUUID();
    await db.runAsync(
      `INSERT INTO local_pocket_members (id, pocket_id, user_id, name, avatar_emoji, role, total_contributed, joined_at)
       VALUES (?, ?, ?, 'Saya (Pembuat)', 'crown', 'owner', ?, ?);`,
      [memberId, id, currentActiveUserId, alloc, now]
    );

    if (alloc > 0) {
      await db.runAsync(
        `INSERT INTO local_pocket_contributions (id, pocket_id, member_id, member_name, member_avatar, amount, note, created_at)
         VALUES (?, ?, ?, 'Saya (Pembuat)', 'crown', ?, 'Alokasi awal modal kas', ?);`,
        [crypto.randomUUID(), id, memberId, alloc, now]
      );
    }
  }

  const list = await getLocalPockets(data.accountId);
  return list.find((p) => p.id === id)!;
}

export async function updateLocalPocket(
  id: string,
  updates: Partial<Pick<PocketModel, 'name' | 'emoji' | 'type' | 'targetAmount' | 'isLocked' | 'sortOrder' | 'isShared' | 'inviteCode'>>
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  const clauses: string[] = ['updated_at = ?'];
  const params: any[] = [now];

  if (updates.name !== undefined) {
    clauses.push('name = ?');
    params.push(updates.name.trim());
  }
  if (updates.emoji !== undefined) {
    clauses.push('emoji = ?');
    params.push(updates.emoji);
  }
  if (updates.type !== undefined) {
    clauses.push('type = ?');
    params.push(updates.type);
    if (updates.type === 'locked') {
      clauses.push('is_locked = 1');
    }
  }
  if (updates.targetAmount !== undefined) {
    clauses.push('target_amount = ?');
    params.push(updates.targetAmount);
  }
  if (updates.isLocked !== undefined) {
    clauses.push('is_locked = ?');
    params.push(updates.isLocked ? 1 : 0);
  }
  if (updates.sortOrder !== undefined) {
    clauses.push('sort_order = ?');
    params.push(updates.sortOrder);
  }
  if (updates.isShared !== undefined) {
    clauses.push('is_shared = ?');
    params.push(updates.isShared ? 1 : 0);
    if (updates.isShared) {
      const code = updates.inviteCode || generateLocalInviteCode();
      clauses.push('invite_code = COALESCE(invite_code, ?)');
      params.push(code);
    }
  }

  params.push(id);
  await db.runAsync(`UPDATE local_pockets SET ${clauses.join(', ')} WHERE id = ?;`, params);
}

export async function deleteLocalPocket(id: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM local_pocket_contributions WHERE pocket_id = ?;`, [id]);
    await db.runAsync(`DELETE FROM local_pocket_members WHERE pocket_id = ?;`, [id]);
    await db.runAsync(`DELETE FROM local_pockets WHERE id = ?;`, [id]);
  });
}

export async function getLocalPocketMembers(pocketId: string): Promise<PocketMemberModel[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM local_pocket_members WHERE pocket_id = ? ORDER BY (CASE WHEN role = 'owner' THEN 0 ELSE 1 END), total_contributed DESC, joined_at ASC;`,
    [pocketId]
  );
  return rows.map((r) => ({
    id: r.id,
    pocketId: r.pocket_id,
    userId: r.user_id,
    name: r.name,
    avatarEmoji: r.avatar_emoji || 'user',
    role: r.role,
    totalContributed: r.total_contributed || 0,
    joinedAt: r.joined_at,
  }));
}

export async function getLocalPocketContributions(pocketId: string): Promise<PocketContributionModel[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM local_pocket_contributions WHERE pocket_id = ? ORDER BY created_at DESC LIMIT 50;`,
    [pocketId]
  );
  return rows.map((r) => ({
    id: r.id,
    pocketId: r.pocket_id,
    memberId: r.member_id,
    memberName: r.member_name,
    memberAvatar: r.member_avatar || 'user',
    amount: r.amount,
    note: r.note,
    createdAt: r.created_at,
  }));
}

export async function addLocalPocketMember(
  pocketId: string,
  member: { name: string; avatarEmoji?: string; role?: PocketMemberRole }
): Promise<PocketMemberModel> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO local_pocket_members (id, pocket_id, user_id, name, avatar_emoji, role, total_contributed, joined_at)
     VALUES (?, ?, NULL, ?, ?, ?, 0, ?);`,
    [id, pocketId, member.name.trim(), member.avatarEmoji || 'user', member.role || 'contributor', now]
  );
  return {
    id,
    pocketId,
    name: member.name.trim(),
    avatarEmoji: member.avatarEmoji || 'user',
    role: member.role || 'contributor',
    totalContributed: 0,
    joinedAt: now,
  };
}

export async function deleteLocalPocketMember(pocketId: string, memberId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM local_pocket_members WHERE pocket_id = ? AND id = ? AND role != 'owner';`, [pocketId, memberId]);
}

export async function addLocalPocketContribution(data: {
  pocketId: string;
  memberId?: string;
  memberName: string;
  memberAvatar?: string;
  amount: number;
  note?: string;
}): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  const contribId = crypto.randomUUID();

  await db.withTransactionAsync(async () => {
    // 1. Find or create member
    let memId: string = data.memberId || '';
    if (!memId) {
      const existing = await db.getFirstAsync<any>(
        `SELECT id FROM local_pocket_members WHERE pocket_id = ? AND LOWER(name) = LOWER(?);`,
        [data.pocketId, data.memberName.trim()]
      );
      if (existing) {
        memId = existing.id;
      } else {
        memId = crypto.randomUUID();
        await db.runAsync(
          `INSERT INTO local_pocket_members (id, pocket_id, user_id, name, avatar_emoji, role, total_contributed, joined_at)
           VALUES (?, ?, NULL, ?, ?, 'contributor', 0, ?);`,
          [memId, data.pocketId, data.memberName.trim(), data.memberAvatar || 'user', now]
        );
      }
    }

    // 2. Update member total_contributed
    await db.runAsync(
      `UPDATE local_pocket_members SET total_contributed = total_contributed + ? WHERE id = ?;`,
      [data.amount, memId]
    );

    // 3. Insert into contributions feed
    await db.runAsync(
      `INSERT INTO local_pocket_contributions (id, pocket_id, member_id, member_name, member_avatar, amount, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      [contribId, data.pocketId, memId, data.memberName.trim(), data.memberAvatar || 'user', data.amount, data.note || null, now]
    );

    // 4. Increase pocket allocated balance
    await db.runAsync(
      `UPDATE local_pockets SET allocated_balance = allocated_balance + ?, updated_at = ? WHERE id = ?;`,
      [data.amount, now, data.pocketId]
    );
  });
}

export async function toggleLocalPocketShared(id: string, isShared: boolean): Promise<string | null> {
  const db = await getDb();
  const now = new Date().toISOString();
  let code: string | null = null;
  if (isShared) {
    const existing = await db.getFirstAsync<any>(`SELECT invite_code FROM local_pockets WHERE id = ?;`, [id]);
    code = existing?.invite_code || generateLocalInviteCode();
    await db.runAsync(
      `UPDATE local_pockets SET is_shared = 1, invite_code = ?, updated_at = ? WHERE id = ?;`,
      [code, now, id]
    );

    // Ensure owner member exists
    const hasOwner = await db.getFirstAsync<any>(`SELECT id FROM local_pocket_members WHERE pocket_id = ? AND role = 'owner';`, [id]);
    if (!hasOwner) {
      await db.runAsync(
        `INSERT INTO local_pocket_members (id, pocket_id, user_id, name, avatar_emoji, role, total_contributed, joined_at)
         VALUES (?, ?, ?, 'Saya (Pembuat)', 'crown', 'owner', (SELECT allocated_balance FROM local_pockets WHERE id = ?), ?);`,
        [crypto.randomUUID(), id, currentActiveUserId, id, now]
      );
    }
  } else {
    await db.runAsync(`UPDATE local_pockets SET is_shared = 0, updated_at = ? WHERE id = ?;`, [now, id]);
  }
  return code;
}

export async function joinLocalSharedPocket(
  inviteCode: string,
  memberName: string,
  avatarEmoji?: string
): Promise<{ success: boolean; pocket?: PocketModel; message: string }> {
  const db = await getDb();
  const trimmedCode = inviteCode.trim().toUpperCase();
  const pocket = await db.getFirstAsync<any>(
    `SELECT * FROM local_pockets WHERE is_shared = 1 AND UPPER(invite_code) = ?;`,
    [trimmedCode]
  );

  if (!pocket) {
    return {
      success: false,
      message: 'Kode undangan tidak ditemukan atau kantong bersama tidak aktif.',
    };
  }

  const now = new Date().toISOString();
  const memberId = crypto.randomUUID();

  // Check if member already exists
  const existingMember = await db.getFirstAsync<any>(
    `SELECT id FROM local_pocket_members WHERE pocket_id = ? AND LOWER(name) = LOWER(?);`,
    [pocket.id, memberName.trim()]
  );

  if (existingMember) {
    return {
      success: true,
      message: `Anda sudah terdaftar sebagai anggota di "${pocket.name}".`,
    };
  }

  await db.runAsync(
    `INSERT INTO local_pocket_members (id, pocket_id, user_id, name, avatar_emoji, role, total_contributed, joined_at)
     VALUES (?, ?, NULL, ?, ?, 'contributor', 0, ?);`,
    [memberId, pocket.id, memberName.trim(), avatarEmoji || 'user', now]
  );

  return {
    success: true,
    message: `Selamat! Anda berhasil bergabung ke Kantong Bersama "${pocket.name}".`,
  };
}

export async function transferLocalPocketFunds(
  accountId: string,
  sourcePocketId: string | null,
  destinationPocketId: string | null,
  amount: number
): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    if (sourcePocketId) {
      await db.runAsync(
        `UPDATE local_pockets SET allocated_balance = MAX(0, allocated_balance - ?), updated_at = ? WHERE id = ? AND account_id = ?;`,
        [amount, now, sourcePocketId, accountId]
      );
    }
    if (destinationPocketId) {
      await db.runAsync(
        `UPDATE local_pockets SET allocated_balance = allocated_balance + ?, updated_at = ? WHERE id = ? AND account_id = ?;`,
        [amount, now, destinationPocketId, accountId]
      );
    }
  });
}

// ===============================================================
// BANK CONNECTIONS & RECONCILIATION - PRD Section 80
// ===============================================================

export async function getLocalBankConnections(): Promise<BankConnectionModel[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT c.*, a.name as account_name
     FROM local_bank_connections c
     LEFT JOIN local_accounts a ON a.id = c.account_id
     ORDER BY c.created_at DESC;`
  );
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    accountId: r.account_id,
    provider: r.provider,
    institutionCode: r.institution_code,
    maskedAccountNumber: r.masked_account_number,
    status: r.status,
    lastSyncedAt: r.last_synced_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    accountName: r.account_name,
  }));
}

export async function insertLocalBankConnection(data: {
  accountId: string;
  provider: string;
  institutionCode: string;
  maskedAccountNumber?: string;
}): Promise<BankConnectionModel> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO local_bank_connections (id, user_id, account_id, provider, institution_code, masked_account_number, status, last_synced_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?);`,
    [id, currentActiveUserId, data.accountId, data.provider, data.institutionCode.toUpperCase(), data.maskedAccountNumber || null, now, now, now]
  );

  const list = await getLocalBankConnections();
  return list.find((c) => c.id === id)!;
}

export async function getLocalBankMutations(status?: string): Promise<BankMutationModel[]> {
  const db = await getDb();
  let query = `SELECT * FROM local_bank_mutations`;
  const params: any[] = [];
  if (status) {
    query += ` WHERE reconciliation_status = ?`;
    params.push(status);
  }
  query += ` ORDER BY transaction_time DESC;`;

  const rows = await db.getAllAsync<any>(query, params);
  return rows.map((r) => ({
    id: r.id,
    connectionId: r.connection_id,
    externalId: r.external_id,
    amount: r.amount,
    type: r.type,
    description: r.description,
    transactionTime: r.transaction_time,
    reconciliationStatus: r.reconciliation_status,
    matchedTransactionId: r.matched_transaction_id,
    createdAt: r.created_at,
  }));
}

export async function importLocalBankStatement(
  connectionId: string,
  statementCsvText: string
): Promise<{ importedCount: number; autoMatchedCount: number }> {
  const db = await getDb();
  const now = new Date().toISOString();

  const lines = statementCsvText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('Tanggal') && !l.startsWith('#'));

  let importedCount = 0;
  let autoMatchedCount = 0;

  const connection = (await getLocalBankConnections()).find((c) => c.id === connectionId);
  const existingTx = await getLocalTransactions();

  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(',').map((p) => p.trim().replace(/^["']|["']$/g, ''));
    if (parts.length < 3) continue;

    const desc = parts[1];
    const amount = parseInt(parts[2].replace(/\D/g, ''), 10);
    if (!amount || amount <= 0) continue;

    const lineUpper = lines[i].toUpperCase();
    const isCredit = lineUpper.includes('CR') || parts[3]?.toUpperCase() === 'CREDIT';
    const type: 'debit' | 'credit' = isCredit ? 'credit' : 'debit';
    const extId = `LOC-${connection?.institutionCode || 'BANK'}-${Date.now()}-${i}`;

    // Smart heuristic search
    const targetType = type === 'debit' ? 'expense' : 'income';
    const potentialMatch = existingTx.find(
      (tx) => tx.accountId === connection?.accountId && tx.type === targetType && tx.amount === amount
    );

    const recStatus = potentialMatch ? 'matched' : 'pending';
    const matchedTxId = potentialMatch?.id || null;

    try {
      await db.runAsync(
        `INSERT OR IGNORE INTO local_bank_mutations (id, connection_id, external_id, amount, type, description, transaction_time, reconciliation_status, matched_transaction_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [crypto.randomUUID(), connectionId, extId, amount, type, desc, now, recStatus, matchedTxId, now]
      );
      importedCount++;
      if (potentialMatch) autoMatchedCount++;
    } catch {}
  }

  return { importedCount, autoMatchedCount };
}

export async function reconcileLocalBankMutation(
  mutationId: string,
  action: 'match' | 'create_new' | 'ignore',
  matchedTransactionId?: string,
  categoryId?: string,
  note?: string
): Promise<void> {
  const db = await getDb();
  const mutation = (await getLocalBankMutations()).find((m) => m.id === mutationId);
  if (!mutation) return;

  if (action === 'match') {
    await db.runAsync(
      `UPDATE local_bank_mutations SET reconciliation_status = 'matched', matched_transaction_id = ? WHERE id = ?;`,
      [matchedTransactionId || null, mutationId]
    );
  } else if (action === 'ignore') {
    await db.runAsync(
      `UPDATE local_bank_mutations SET reconciliation_status = 'ignored' WHERE id = ?;`,
      [mutationId]
    );
  } else if (action === 'create_new') {
    const connections = await getLocalBankConnections();
    const conn = connections.find((c) => c.id === mutation.connectionId);
    const accountId = conn?.accountId || (await getLocalAccounts())[0]?.id;
    const catId = categoryId || (await getLocalCategories(mutation.type === 'debit' ? 'expense' : 'income'))[0]?.id;

    const newTx = await insertLocalTransaction({
      accountId,
      categoryId: catId,
      type: mutation.type === 'debit' ? 'expense' : 'income',
      amount: mutation.amount,
      note: note || mutation.description,
      transactionDate: mutation.transactionTime,
    });

    await db.runAsync(
      `UPDATE local_bank_mutations SET reconciliation_status = 'created_as_new', matched_transaction_id = ? WHERE id = ?;`,
      [newTx.id, mutationId]
    );
  }
}

export async function deleteLocalBankConnection(id: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM local_bank_mutations WHERE connection_id = ?;`, [id]);
    await db.runAsync(`DELETE FROM local_bank_connections WHERE id = ?;`, [id]);
  });
}

// PRD Section 70: Backup & Restore via Encrypted / Structured JSON (.ukbak)
export async function exportFullLocalBackup(): Promise<string> {
  const db = await getDb();
  const [transactions, accounts, categories, budgets, goals, recurring, pockets] = await Promise.all([
    db.getAllAsync(`SELECT * FROM local_transactions WHERE deleted_at IS NULL;`),
    db.getAllAsync(`SELECT * FROM local_accounts WHERE is_archived = 0;`),
    db.getAllAsync(`SELECT * FROM local_categories WHERE is_archived = 0;`),
    db.getAllAsync(`SELECT * FROM local_budgets;`),
    db.getAllAsync(`SELECT * FROM local_goals;`),
    db.getAllAsync(`SELECT * FROM local_recurring_rules;`),
    db.getAllAsync(`SELECT * FROM local_pockets;`),
  ]);

  const backupData = {
    app: 'UangKu',
    format: 'ukbak_v1',
    exportedAt: new Date().toISOString(),
    itemCounts: {
      transactions: transactions.length,
      accounts: accounts.length,
      categories: categories.length,
      goals: goals.length,
    },
    data: {
      transactions,
      accounts,
      categories,
      budgets,
      goals,
      recurring,
      pockets,
    },
  };

  return JSON.stringify(backupData, null, 2);
}

export async function restoreFullLocalBackup(backupJsonString: string): Promise<{ success: boolean; message: string; restoredCount: number }> {
  try {
    const backup = JSON.parse(backupJsonString);
    if (!backup || backup.app !== 'UangKu' || !backup.data) {
      return { success: false, message: 'Format file cadangan tidak valid (bukan file UangKu .ukbak).', restoredCount: 0 };
    }

    const db = await getDb();
    const now = new Date().toISOString();
    let txCount = 0;

    await db.withTransactionAsync(async () => {
      // Clear current transaction-based records
      await db.execAsync(`
        DELETE FROM local_transactions;
        DELETE FROM mutation_outbox;
        DELETE FROM local_budgets;
        DELETE FROM local_goals;
        DELETE FROM local_recurring_rules;
        DELETE FROM local_pockets;
      `);

      // Restore accounts
      if (Array.isArray(backup.data.accounts)) {
        for (const a of backup.data.accounts) {
          await db.runAsync(
            `INSERT OR REPLACE INTO local_accounts (id, user_id, name, type, currency, initial_balance, reserved_amount, color, is_hidden, sort_order, is_default, is_archived, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              a.id,
              a.user_id || currentActiveUserId,
              a.name,
              a.type || 'bank',
              a.currency || 'IDR',
              a.initial_balance || 0,
              a.reserved_amount || 0,
              a.color || '#D4AF37',
              a.is_hidden || 0,
              a.sort_order || 0,
              a.is_default || 0,
              a.is_archived || 0,
              a.created_at || now,
              now,
            ]
          );
        }
      }

      // Restore categories
      if (Array.isArray(backup.data.categories)) {
        for (const c of backup.data.categories) {
          await db.runAsync(
            `INSERT OR REPLACE INTO local_categories (id, user_id, name, type, icon, is_system, is_archived, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              c.id,
              c.user_id || null,
              c.name,
              c.type,
              c.icon || 'more-horizontal',
              c.is_system || 0,
              c.is_archived || 0,
              c.created_at || now,
              now,
            ]
          );
        }
      }

      // Restore transactions
      if (Array.isArray(backup.data.transactions)) {
        txCount = backup.data.transactions.length;
        for (const t of backup.data.transactions) {
          await db.runAsync(
            `INSERT OR REPLACE INTO local_transactions (id, user_id, account_id, destination_account_id, category_id, pocket_id, type, amount, transfer_fee, currency, note, receipt_url, transaction_date, client_id, version, sync_status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?);`,
            [
              t.id,
              t.user_id || currentActiveUserId,
              t.account_id,
              t.destination_account_id || null,
              t.category_id || null,
              t.pocket_id || null,
              t.type,
              t.amount,
              t.transfer_fee || 0,
              t.currency || 'IDR',
              t.note || null,
              t.receipt_url || null,
              t.transaction_date,
              t.client_id || crypto.randomUUID(),
              t.version || 1,
              t.created_at || now,
              now,
            ]
          );
        }
      }

      // Restore goals
      if (Array.isArray(backup.data.goals)) {
        for (const g of backup.data.goals) {
          await db.runAsync(
            `INSERT OR REPLACE INTO local_goals (id, user_id, name, emoji, target_amount, current_amount, target_date, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              g.id,
              g.user_id || currentActiveUserId,
              g.name,
              g.emoji || 'target',
              g.target_amount,
              g.current_amount || 0,
              g.target_date || null,
              g.status || 'active',
              g.created_at || now,
              now,
            ]
          );
        }
      }

      // Restore budgets
      if (Array.isArray(backup.data.budgets)) {
        for (const b of backup.data.budgets) {
          await db.runAsync(
            `INSERT OR REPLACE INTO local_budgets (id, user_id, category_id, amount, currency, period, is_active, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              b.id,
              b.user_id || currentActiveUserId,
              b.category_id,
              b.amount,
              b.currency || 'IDR',
              b.period || 'monthly',
              b.is_active !== undefined ? b.is_active : 1,
              b.created_at || now,
              now,
            ]
          );
        }
      }

      // Restore pockets
      if (Array.isArray(backup.data.pockets)) {
        for (const p of backup.data.pockets) {
          await db.runAsync(
            `INSERT OR REPLACE INTO local_pockets (id, user_id, account_id, name, emoji, type, allocated_balance, target_amount, is_locked, sort_order, is_shared, invite_code, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              p.id,
              p.user_id || currentActiveUserId,
              p.account_id,
              p.name,
              p.emoji || 'wallet',
              p.type,
              p.allocated_balance || 0,
              p.target_amount || null,
              p.is_locked || 0,
              p.sort_order || 0,
              p.is_shared || 0,
              p.invite_code || null,
              p.created_at || now,
              now,
            ]
          );
        }
      }
    });

    return { success: true, message: `Berhasil memulihkan ${txCount} transaksi dan pengaturan data.`, restoredCount: txCount };
  } catch (err: any) {
    return { success: false, message: `Gagal membaca file cadangan: ${err.message}`, restoredCount: 0 };
  }
}

