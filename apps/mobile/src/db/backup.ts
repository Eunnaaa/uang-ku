import type { SQLiteBindValue } from 'expo-sqlite';
import { getActiveUserId, getDb } from './sqlite';

const tables = {
  accounts: ['local_accounts', 'user_id=?'],
  categories: ['local_categories', 'user_id=?'],
  transactions: ['local_transactions', 'user_id=?'],
  budgets: ['local_budgets', 'user_id=?'],
  goals: ['local_goals', 'user_id=?'],
  recurring: ['local_recurring_rules', 'user_id=?'],
  pockets: ['local_pockets', 'user_id=?'],
  templates: ['local_templates', 'user_id=?'],
  connections: ['local_bank_connections', 'user_id=?'],
  mutations: ['local_bank_mutations', 'connection_id IN (SELECT id FROM local_bank_connections WHERE user_id=?)'],
  members: ['local_pocket_members', 'pocket_id IN (SELECT id FROM local_pockets WHERE user_id=?)'],
  contributions: ['local_pocket_contributions', 'pocket_id IN (SELECT id FROM local_pockets WHERE user_id=?)'],
  history: ['local_transaction_history', 'transaction_id IN (SELECT id FROM local_transactions WHERE user_id=?)'],
  outbox: ['mutation_outbox', "entity_type='transaction' AND entity_id IN (SELECT id FROM local_transactions WHERE user_id=?)"],
} as const;

export async function exportFullLocalBackup() {
  const ownerId = getActiveUserId();
  const db = await getDb();
  const data: Record<string, unknown[]> = {};
  await db.withTransactionAsync(async () => {
    for (const [key, [table, scope]] of Object.entries(tables)) {
      data[key] = await db.getAllAsync(`SELECT * FROM ${table} WHERE ${scope} ORDER BY rowid`, [ownerId]);
    }
  });
  return JSON.stringify({ app: 'UangKu', format: 'ukbak_v2', ownerId, exportedAt: new Date().toISOString(),
    itemCounts: Object.fromEntries(Object.entries(data).map(([k, items]) => [k, items.length])), data }, null, 2);
}

export async function restoreFullLocalBackup(text: string) {
  const owner = getActiveUserId();
  try {
    const { app, format, ownerId, data } = JSON.parse(text);
    const legacy = format === 'ukbak_v1';
    if (app !== 'UangKu' || (!legacy && (format !== 'ukbak_v2' || ownerId !== owner))) {
      throw new Error('Format atau pemilik cadangan tidak sesuai.');
    }
    const db = await getDb();
    const entries = Object.entries(tables).filter(([key]) => !legacy ||
      ['transactions','accounts','categories','budgets','goals','recurring','pockets','outbox'].includes(key));
    if (legacy && Array.isArray(data.transactions)) {
      data.outbox = data.transactions.filter((t: any) => t.sync_status !== 'synced').map((t: any) => ({
        id: crypto.randomUUID(), client_id: t.client_id, entity_id: t.id, entity_type: 'transaction',
        operation: t.deleted_at ? 'delete' : t.version > 1 ? 'update' : 'create',
        payload: JSON.stringify({ version: t.version, type: t.type, accountId: t.account_id, destinationAccountId: t.destination_account_id,
          categoryId: t.category_id, pocketId: t.pocket_id, amount: t.amount, transferFee: t.transfer_fee,
          currency: t.currency, note: t.note, transactionDate: t.transaction_date, receiptUrl: t.receipt_url }),
        created_at: t.created_at, updated_at: t.updated_at,
      }));
    }
    if (entries.some(([key]) => !Array.isArray(data?.[key]))) throw new Error('Isi cadangan tidak lengkap.');
    const queued = new Set(data.outbox.map((m: any) => m.entity_id));
    if (data.transactions.some((t: any) => t.sync_status !== 'synced' && !queued.has(t.id))) {
      throw new Error('Transaksi offline tidak memiliki mutasi.');
    }
    await db.withTransactionAsync(async () => {
      for (const [, [table, scope]] of [...entries].reverse()) {
        await db.runAsync(`DELETE FROM ${table} WHERE ${scope}`, [owner]);
      }
      for (const [key, [table, scope]] of entries) {
        const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
        for (const row of data[key]) {
          if (legacy && key === 'categories' && row.is_system && row.user_id === null) continue;
          if (key === 'outbox' && row.status === 'syncing') row.status = 'pending';
          const names = columns.map(c => c.name).filter(name => Object.hasOwn(row, name));
          // Column names come from SQLite, not from the backup file. Never replace another owner's row on collision.
          await db.runAsync(`INSERT INTO ${table} (${names.join(',')}) VALUES (${names.map(() => '?').join(',')})`,
            names.map(name => row[name] as SQLiteBindValue));
          if (!await db.getFirstAsync(`SELECT id FROM ${table} WHERE id=? AND (${scope})`, [row.id, owner])) {
            throw new Error('Cadangan berisi data milik akun lain.');
          }
        }
      }
      await db.runAsync('DELETE FROM sync_metadata WHERE key=?', [`cursor:${owner}`]);
    });
    return { success: true, message: `Berhasil memulihkan ${data.transactions.length} transaksi.`, restoredCount: data.transactions.length };
  } catch (err) {
    return { success: false, message: `Gagal memulihkan cadangan: ${err instanceof Error ? err.message : err}`, restoredCount: 0 };
  }
}
