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

        await db.withTransactionAsync(async () => {
          for (const item of processed) {
            // Delete from outbox
            await db.runAsync(`DELETE FROM mutation_outbox WHERE id = ?;`, [item.id]);

            // Update local entity sync_status
            await db.runAsync(
              `UPDATE local_transactions SET sync_status = 'synced' WHERE client_id = ?;`,
              [item.clientId]
            );
          }
        });

        this.isSyncing = false;
        return { processedCount: processed.length, errors: 0 };
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
}
