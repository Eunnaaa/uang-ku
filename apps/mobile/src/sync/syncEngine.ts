import { getDb } from '../db/sqlite';
import { getStoredToken } from '../auth/authContext';

export class SyncEngine {
  private static isSyncing = false;
  private static baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

  public static async processOutbox(): Promise<{ processedCount: number; errors: number }> {
    if (this.isSyncing) return { processedCount: 0, errors: 0 };
    this.isSyncing = true;

    try {
      const db = await getDb();
      const pendingMutations = await db.getAllAsync<any>(
        `SELECT * FROM mutation_outbox WHERE status = 'pending' AND retry_count < 10 ORDER BY created_at ASC LIMIT 50;`
      );

      if (pendingMutations.length === 0) {
        this.isSyncing = false;
        return { processedCount: 0, errors: 0 };
      }

      // Mark as syncing in local DB using parameterized placeholders
      const placeholders = pendingMutations.map(() => '?').join(',');
      const mutationIds = pendingMutations.map((m) => m.id);
      await db.runAsync(`UPDATE mutation_outbox SET status = 'syncing' WHERE id IN (${placeholders});`, mutationIds);

      const payload = {
        mutations: pendingMutations.map((m) => ({
          id: m.id,
          clientId: m.client_id,
          entityType: m.entity_type,
          operation: m.operation,
          entityId: m.entity_id,
          version: 1,
          payload: JSON.parse(m.payload),
        })),
      };

      const token = (await getStoredToken()) || 'demo-token';

      // 8-second network timeout controller
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      try {
        const res = await fetch(`${this.baseUrl}/api/v1/sync/push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          const errText = await res.text().catch(() => 'Server error');
          const isClientError = res.status >= 400 && res.status < 500 && res.status !== 409 && res.status !== 429;
          const targetStatus = isClientError ? 'failed' : 'pending';

          await db.runAsync(
            `UPDATE mutation_outbox
             SET status = CASE WHEN retry_count >= 5 OR ? = 'failed' THEN 'failed' ELSE 'pending' END,
                 retry_count = retry_count + 1,
                 last_error = ?
             WHERE id IN (${placeholders});`,
            [targetStatus, errText.slice(0, 200), ...mutationIds]
          );
          this.isSyncing = false;
          return { processedCount: 0, errors: pendingMutations.length };
        }

        const responseData = await res.json();
        const processed = responseData.data?.processed || [];
        const conflicts = responseData.data?.conflicts || [];
        const rejected = responseData.data?.rejected || [];

        const processedIds = new Set(processed.map((p: any) => p.id));
        const conflictIds = new Set(conflicts.map((c: any) => c.id));
        const rejectedIds = new Set(rejected.map((r: any) => r.id));

        await db.withTransactionAsync(async () => {
          // 1. Process successful mutations
          for (const item of processed) {
            await db.runAsync(`DELETE FROM mutation_outbox WHERE id = ?;`, [item.id]);
            await db.runAsync(
              `UPDATE local_transactions SET sync_status = 'synced', version = ? WHERE client_id = ?;`,
              [item.version || 1, item.clientId]
            );
          }

          // 2. Handle conflicts (server is newer or conflicting state)
          for (const item of conflicts) {
            const errStr = `Konflik versi: server version ${item.currentServerVersion}`;
            await db.runAsync(
              `UPDATE mutation_outbox SET status = 'failed', last_error = ?, retry_count = retry_count + 1 WHERE id = ?;`,
              [errStr, item.id]
            );
            await db.runAsync(
              `UPDATE local_transactions SET sync_status = 'conflict' WHERE client_id = ?;`,
              [item.clientId]
            );
          }

          // 3. Handle rejected mutations
          for (const item of rejected) {
            const errStr = (item.error || 'Ditolak oleh server').slice(0, 200);
            await db.runAsync(
              `UPDATE mutation_outbox SET status = 'failed', last_error = ?, retry_count = retry_count + 1 WHERE id = ?;`,
              [errStr, item.id]
            );
          }

          // 4. Any mutation not in processed, conflicts, or rejected: revert to pending so it's not orphaned
          for (const mId of mutationIds) {
            if (!processedIds.has(mId) && !conflictIds.has(mId) && !rejectedIds.has(mId)) {
              await db.runAsync(
                `UPDATE mutation_outbox SET status = 'pending', retry_count = retry_count + 1 WHERE id = ? AND status = 'syncing';`,
                [mId]
              );
            }
          }
        });

        this.isSyncing = false;
        return { processedCount: processed.length, errors: conflicts.length + rejected.length };
      } catch (networkErr: any) {
        clearTimeout(timeoutId);
        throw networkErr;
      }
    } catch (err: any) {
      // Revert syncing status on network exception
      try {
        const db = await getDb();
        const errMsg = err?.name === 'AbortError' ? 'Koneksi timeout (8s)' : (err?.message || 'Network request failed');
        await db.runAsync(
          `UPDATE mutation_outbox SET status = 'pending', retry_count = retry_count + 1, last_error = ? WHERE status = 'syncing';`,
          [errMsg.slice(0, 200)]
        );
      } catch {}
      this.isSyncing = false;
      return { processedCount: 0, errors: 1 };
    }
  }

  /**
   * Pull incremental updates from the remote server
   */
  public static async pull(): Promise<{ pulledCount: number; errors: number }> {
    try {
      const db = await getDb();
      const metaRow = await db.getFirstAsync<{ value: string }>(
        `SELECT value FROM sync_metadata WHERE key = 'last_sync_cursor';`
      );
      const cursor = metaRow?.value || '';

      const token = (await getStoredToken()) || 'demo-token';
      const url = new URL(`${this.baseUrl}/api/v1/sync/pull`);
      if (cursor) {
        url.searchParams.set('cursor', cursor);
      }
      url.searchParams.set('limit', '50');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        return { pulledCount: 0, errors: 1 };
      }

      const body = await res.json();
      const changes: any[] = body.data?.changes || [];
      const nextCursor: string | null = body.data?.nextCursor || null;

      if (changes.length > 0) {
        const now = new Date().toISOString();
        await db.withTransactionAsync(async () => {
          for (const item of changes) {
            // Check if transaction already exists locally by client_id or id
            const existing = await db.getFirstAsync<any>(
              `SELECT id, version, sync_status FROM local_transactions WHERE client_id = ? OR id = ?;`,
              [item.clientId, item.id]
            );

            if (existing) {
              // Only overwrite if remote version is >= local version and local isn't currently pending sync
              if ((item.version || 1) >= (existing.version || 1) && existing.sync_status !== 'pending_sync') {
                if (item.deletedAt) {
                  await db.runAsync(
                    `UPDATE local_transactions SET deleted_at = ?, version = ?, sync_status = 'synced', updated_at = ? WHERE id = ?;`,
                    [item.deletedAt, item.version || 1, now, existing.id]
                  );
                } else {
                  await db.runAsync(
                    `UPDATE local_transactions 
                     SET account_id = ?, destination_account_id = ?, category_id = ?, pocket_id = ?, type = ?, amount = ?, transfer_fee = ?,
                         currency = ?, note = ?, receipt_url = ?, transaction_date = ?, version = ?, sync_status = 'synced', updated_at = ?
                     WHERE id = ?;`,
                    [
                      item.accountId,
                      item.destinationAccountId || null,
                      item.categoryId || null,
                      item.pocketId || null,
                      item.type,
                      item.amount,
                      item.transferFee || 0,
                      item.currency || 'IDR',
                      item.note || null,
                      item.receiptUrl || null,
                      item.transactionDate,
                      item.version || 1,
                      now,
                      existing.id,
                    ]
                  );
                }
              }
            } else {
              // Remote transaction created elsewhere - insert into local db
              if (!item.deletedAt) {
                await db.runAsync(
                  `INSERT INTO local_transactions (id, user_id, account_id, destination_account_id, category_id, pocket_id, type, amount, transfer_fee, currency, note, receipt_url, transaction_date, client_id, version, sync_status, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?);`,
                  [
                    item.id,
                    item.userId,
                    item.accountId,
                    item.destinationAccountId || null,
                    item.categoryId || null,
                    item.pocketId || null,
                    item.type,
                    item.amount,
                    item.transferFee || 0,
                    item.currency || 'IDR',
                    item.note || null,
                    item.receiptUrl || null,
                    item.transactionDate,
                    item.clientId,
                    item.version || 1,
                    item.createdAt || now,
                    item.updatedAt || now,
                  ]
                );
              }
            }
          }

          // Save next cursor
          if (nextCursor) {
            await db.runAsync(
              `INSERT INTO sync_metadata (key, value, updated_at) VALUES ('last_sync_cursor', ?, ?)
               ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
              [nextCursor, now]
            );
          }
        });
      }

      return { pulledCount: changes.length, errors: 0 };
    } catch {
      return { pulledCount: 0, errors: 1 };
    }
  }

  /**
   * Bi-directional synchronization: pushes outbox then pulls remote changes
   */
  public static async syncAll(): Promise<{ pushed: number; pulled: number; errors: number }> {
    const pushResult = await this.processOutbox();
    const pullResult = await this.pull();
    return {
      pushed: pushResult.processedCount,
      pulled: pullResult.pulledCount,
      errors: pushResult.errors + pullResult.errors,
    };
  }
}

