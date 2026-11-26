import type { SQLiteDatabase } from 'expo-sqlite';
import type { SyncMutation } from '@uangku/contracts';
import { getActiveUserId, getDb } from '../db/sqlite';
import { getStoredToken } from '../auth/authContext';

const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

async function request(path: string, token: string, body?: unknown) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${baseUrl}/api/v1/sync/${path}`, {
      method: body ? 'POST' : 'GET', signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Sync HTTP ${res.status}`);
    return (await res.json()).data;
  } finally { clearTimeout(timer); }
}

async function references(db: SQLiteDatabase, owner: string, payloads: Record<string, any>[]) {
  const select = (columns: string, table: string, ids: (string | undefined)[]) => {
    const keys = [...new Set(ids.filter((id): id is string => !!id))];
    return keys.length ? db.getAllAsync<any>(`SELECT ${columns} FROM ${table} WHERE user_id=? AND id IN
      (${keys.map(() => '?').join(',')})`, [owner, ...keys]) : [];
  };
  const wallets = await select(`id,name,type,currency,initial_balance AS initialBalance,is_default AS isDefault,is_archived AS isArchived,
    reserved_amount AS reservedAmount,coalesce(color,'#D4AF37') AS color,is_hidden AS isHidden,sort_order AS sortOrder,updated_at AS updatedAt`,
    'local_accounts', payloads.flatMap(p => [p.accountId, p.destinationAccountId]));
  return {
    accounts: wallets.map(a => ({ ...a, isDefault: !!a.isDefault, isArchived: !!a.isArchived, isHidden: !!a.isHidden })),
    categories: (await select('id,name,type,icon,is_archived AS isArchived,updated_at AS updatedAt','local_categories',
      payloads.map(p => p.categoryId))).map(c => ({ ...c, isArchived: !!c.isArchived })),
    pockets: await select(`id,account_id AS accountId,name,type,emoji,allocated_balance AS allocatedBalance,allocated_balance + coalesce((select sum(t.pocket_debit)
      from local_transactions t where t.pocket_id=local_pockets.id and t.user_id=local_pockets.user_id and t.deleted_at is null),0)
      AS openingAllocation,target_amount AS targetAmount`,
      'local_pockets', payloads.map(p => p.pocketId)),
  };
}

export class SyncEngine {
  private static pushing = false;

  public static async processOutbox(owner = getActiveUserId()) {
    let processedCount = 0;
    if (this.pushing) return { processedCount, errors: 1 };
    this.pushing = true;
    try {
      const db = await getDb();
      const token = await getStoredToken(owner);
      if (!token) return { processedCount, errors: 1 };
      const blocked = new Set<string>();
      let afterRow = 0;
      while (owner === getActiveUserId()) {
        const rows = await db.getAllAsync<any>(`SELECT m.rowid AS queue_row,m.* FROM mutation_outbox m
          JOIN local_transactions t ON t.id=m.entity_id WHERE t.user_id=? AND m.status IN ('pending','syncing')
          AND m.rowid>? AND NOT EXISTS (SELECT 1 FROM mutation_outbox older WHERE older.entity_id=m.entity_id
          AND older.rowid<m.rowid AND older.status='failed') ORDER BY m.rowid LIMIT 50`, [owner,afterRow]);
        if (!rows.length) break;
        afterRow = rows[rows.length-1].queue_row;
        const mutations: SyncMutation[] = [];
        for (const m of rows) {
          if (blocked.has(m.entity_id)) continue;
          const payload = JSON.parse(m.payload);
          if (payload.receiptUrl && !/^https?:\/\//i.test(payload.receiptUrl)) {
            const local = payload.receiptUrl;
            try {
              const { mobileStorageService } = await import('../services/storageService');
              payload.receiptUrl = await mobileStorageService.uploadReceiptImage(local, owner);
            } catch { payload.receiptUrl = local; }
            if (!payload.receiptUrl || payload.receiptUrl === local) {
              blocked.add(m.entity_id);
              await db.runAsync("UPDATE mutation_outbox SET last_error='receipt_pending' WHERE id=?", [m.id]);
              continue;
            }
            // Freeze the uploaded URL before push: a lost response must retry the same mutation.
            await db.withTransactionAsync(async () => {
              const result = await db.runAsync('UPDATE mutation_outbox SET payload=? WHERE id=? AND payload=?', [JSON.stringify(payload), m.id,m.payload]);
              if (!result.changes) { blocked.add(m.entity_id); return; }
              await db.runAsync('UPDATE local_transactions SET receipt_url=? WHERE user_id=? AND id=? AND receipt_url=?',
                [payload.receiptUrl, owner, m.entity_id, local]);
            });
            if (blocked.has(m.entity_id)) continue;
          }
          mutations.push({ id: m.id, entityId: m.entity_id, clientId: m.client_id, operation: m.operation,
            entityType: m.entity_type, version: payload.version, payload });
        }
        if (!mutations.length) continue;
        const data = await request('push', token, { ownerId: owner, mutations,
          ...await references(db, owner, mutations.map(m => m.payload)) });
        if (data.protocol !== 2) throw new Error('Server belum mendukung konfirmasi penyimpanan.');
        let errors = 0;
        await db.withTransactionAsync(async () => {
          for (const m of mutations) {
            const ack = data.processed.find((a: any) => a.id === m.id);
            if (ack?.status === 'applied' && ack.serverEntityId === m.entityId &&
                ack.clientId === m.clientId && ack.version === m.version) {
              await db.runAsync('DELETE FROM mutation_outbox WHERE id=?', [m.id]);
              await db.runAsync(`UPDATE local_transactions SET sync_status='synced' WHERE user_id=? AND id=?
                AND version=? AND NOT EXISTS (SELECT 1 FROM mutation_outbox WHERE entity_id=?)`,
                [owner, m.entityId, m.version, m.entityId]);
              processedCount++;
            } else {
              errors++;
              const conflict = data.conflicts.find((c: any) => c.id === m.id);
              const rejected = data.rejected.find((r: any) => r.id === m.id);
              if (conflict || rejected) {
                await db.runAsync(`UPDATE mutation_outbox SET status='failed', last_error=? WHERE id=?`,
                  [rejected?.error ?? `Konflik versi ${conflict.currentServerVersion}`, m.id]);
                if (conflict) await db.runAsync(`UPDATE local_transactions SET sync_status='conflict' WHERE user_id=? AND id=?`, [owner, m.entityId]);
              }
            }
          }
        });
        if (errors) return { processedCount, errors };
      }
      const failed = await db.getFirstAsync<{ n: number }>(`SELECT count(*) AS n FROM mutation_outbox m
        JOIN local_transactions t ON t.id=m.entity_id WHERE t.user_id=? AND m.status='failed'`, [owner]);
      return { processedCount, errors: (failed?.n ?? 0) + blocked.size };
    } catch { return { processedCount, errors: 1 }; }
    finally { this.pushing = false; }
  }

  public static async pull(owner = getActiveUserId()) {
    let pulledCount = 0;
    try {
      const db = await getDb();
      const token = await getStoredToken(owner);
      if (!token) return { pulledCount, errors: 1 };
      const key = `cursor:${owner}`;
      let cursor = (await db.getFirstAsync<{ value: string }>('SELECT value FROM sync_metadata WHERE key=?', [key]))?.value;
      while (owner === getActiveUserId()) {
        const data = await request(`pull?limit=50${pulledCount === 0 ? '&catalog=1' : ''}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, token);
        if (owner !== getActiveUserId()) return { pulledCount, errors: 1 };
        if (!Array.isArray(data.changes) || (data.changes.length && (!data.nextCursor || data.nextCursor === cursor))) {
          throw new Error('Invalid sync page');
        }
        await db.withTransactionAsync(async () => {
          for (const a of data.accounts) {
            if (a.userId !== owner) throw new Error('Account owner mismatch');
            await db.runAsync(`INSERT INTO local_accounts (id,user_id,name,type,currency,initial_balance,is_default,is_archived,created_at,updated_at,reserved_amount,color,is_hidden,sort_order)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
              name=excluded.name,type=excluded.type,currency=excluded.currency,initial_balance=excluded.initial_balance,
              is_default=excluded.is_default,is_archived=excluded.is_archived,updated_at=excluded.updated_at,
              reserved_amount=excluded.reserved_amount,color=excluded.color,is_hidden=excluded.is_hidden,sort_order=excluded.sort_order
              WHERE user_id=excluded.user_id AND updated_at<excluded.updated_at`,
              [a.id, owner, a.name, a.type, a.currency, a.initialBalance, +a.isDefault, +a.isArchived, a.createdAt, a.updatedAt,
                a.reservedAmount ?? 0,a.color ?? '#D4AF37',a.isHidden ? 1 : 0,a.sortOrder ?? 0]);
          }
          for (const c of data.categories) {
            if (c.userId !== owner && !(c.isSystem && c.userId === null)) throw new Error('Category owner mismatch');
            await db.runAsync(`INSERT INTO local_categories (id,user_id,name,type,icon,is_system,is_archived,created_at,updated_at)
              VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,icon=excluded.icon,type=excluded.type,
              is_archived=excluded.is_archived,updated_at=excluded.updated_at WHERE user_id=excluded.user_id AND updated_at<excluded.updated_at`,
              [c.id, c.userId, c.name, c.type, c.icon, +c.isSystem, +c.isArchived, c.createdAt, c.updatedAt]);
          }
          for (const p of data.pockets) {
            if (p.userId !== owner) throw new Error('Pocket owner mismatch');
            if (p.openingAllocation == null) throw new Error('Perbarui server sebelum menyinkronkan kantong.');
            await db.runAsync(`INSERT INTO local_pockets (id,user_id,account_id,name,type,emoji,allocated_balance,target_amount,is_shared,created_at,updated_at)
              VALUES (?,?,?,?,?,?,? - coalesce((SELECT sum(pocket_debit) FROM local_transactions WHERE pocket_id=? AND user_id=? AND deleted_at IS NULL),0),?,?,?,?)
              ON CONFLICT(id) DO NOTHING`,
              [p.id, owner, p.accountId, p.name, p.type, p.emoji, p.openingAllocation,p.id,owner,p.targetAmount, +p.isShared, p.createdAt, p.updatedAt]);
          }
          for (const t of data.changes) {
            if (t.userId !== owner) throw new Error('Transaction owner mismatch');
            const old = await db.getFirstAsync<{pocket_id: string; pocket_debit: number}>(`SELECT pocket_id,pocket_debit FROM local_transactions
              WHERE user_id=? AND id=? AND pocket_id IS NOT NULL AND deleted_at IS NULL`,[owner,t.id]);
            const updated = await db.runAsync(`INSERT INTO local_transactions
              (id,user_id,client_id,account_id,destination_account_id,category_id,pocket_id,type,amount,transfer_fee,currency,
               note,receipt_url,transaction_date,version,sync_status,created_at,updated_at,deleted_at,pocket_debit)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'synced',?,?,?,?)
              ON CONFLICT(id) DO UPDATE SET account_id=excluded.account_id,destination_account_id=excluded.destination_account_id,
                category_id=excluded.category_id,pocket_id=excluded.pocket_id,type=excluded.type,amount=excluded.amount,
                transfer_fee=excluded.transfer_fee,currency=excluded.currency,note=excluded.note,receipt_url=excluded.receipt_url,
                transaction_date=excluded.transaction_date,version=excluded.version,updated_at=excluded.updated_at,deleted_at=excluded.deleted_at,pocket_debit=excluded.pocket_debit
              WHERE user_id=excluded.user_id AND client_id=excluded.client_id AND version<=excluded.version AND sync_status='synced'`,
              [t.id, owner, t.clientId, t.accountId, t.destinationAccountId, t.categoryId, t.pocketId, t.type,
                t.amount, t.transferFee, t.currency, t.note, t.receiptUrl, t.transactionDate, t.version, t.createdAt, t.updatedAt, t.deletedAt,t.pocketDebit ?? null]);
            if (updated.changes) {
              // Apply the change in funded amount, not the full expense on every pull/replay.
              if (old?.pocket_debit) await db.runAsync('UPDATE local_pockets SET allocated_balance=allocated_balance+? WHERE user_id=? AND id=?',
                [old.pocket_debit,owner,old.pocket_id]);
              if (t.pocketId && t.pocketDebit && !t.deletedAt) await db.runAsync('UPDATE local_pockets SET allocated_balance=allocated_balance-? WHERE user_id=? AND id=?',
                [t.pocketDebit,owner,t.pocketId]);
            }
          }
          if (data.nextCursor) await db.runAsync(`INSERT OR REPLACE INTO sync_metadata (key,value,updated_at) VALUES (?,?,?)`,
            [key, data.nextCursor, new Date().toISOString()]);
        });
        pulledCount += data.changes.length;
        cursor = data.nextCursor;
        if (!data.hasMore) break;
      }
      return { pulledCount, errors: 0 };
    } catch { return { pulledCount, errors: 1 }; }
  }

  public static async syncAll() {
    const owner = getActiveUserId();
    let catalogErrors = 0;
    try {
      const db = await getDb(), token = await getStoredToken(owner);
      if (!token) return { pushed: 0, pulled: 0, errors: 1 };
      const wallets = await db.getAllAsync<{id:string}>('SELECT id FROM local_accounts WHERE user_id=?',[owner]);
      const cats = await db.getAllAsync<{id:string}>('SELECT id FROM local_categories WHERE user_id=?',[owner]);
      for (let offset=0; offset<Math.max(wallets.length,cats.length); offset+=50) {
        if (owner !== getActiveUserId()) return { pushed: 0, pulled: 0, errors: 1 };
        const refs = await references(db,owner,[...wallets.slice(offset,offset+50).map(a=>({accountId:a.id})),
          ...cats.slice(offset,offset+50).map(c=>({categoryId:c.id}))]);
        const ack = await request('catalog',token,{ownerId:owner,accounts:refs.accounts,categories:refs.categories});
        if (ack?.protocol !== 3) throw new Error('Server belum mendukung katalog.');
      }
    } catch { catalogErrors++; }
    const push = await this.processOutbox(owner);
    const pull = await this.pull(owner);
    return { pushed: push.processedCount, pulled: pull.pulledCount, errors: catalogErrors + push.errors + pull.errors };
  }
}
