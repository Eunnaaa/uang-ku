import { getDb } from '../db/sqlite';

export class SyncEngine {
  private static isSyncing = false;
  private static baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

  public static async processOutbox(): Promise<{ processedCount: number; errors: number }> {
    if (this.isSyncing) return { processedCount: 0, errors: 0 };
    this.isSyncing = true;

    try {
      const db = await getDb();
      const pendingMutations = await db.getAllAsync<any>(
        `SELECT * FROM mutation_outbox WHERE status = 'pending' ORDER BY created_at ASC LIMIT 50;`
      );

      if (pendingMutations.length === 0) {
        this.isSyncing = false;
        return { processedCount: 0, errors: 0 };
      }

      // Mark as syncing in local DB
      const ids = pendingMutations.map((m) => `'${m.id}'`).join(',');
      await db.runAsync(`UPDATE mutation_outbox SET status = 'syncing' WHERE id IN (${ids});`);

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

      const res = await fetch(`${this.baseUrl}/api/v1/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer demo-token',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // Reset status to pending with backoff
        await db.runAsync(
          `UPDATE mutation_outbox SET status = 'pending', retry_count = retry_count + 1 WHERE id IN (${ids});`
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
    } catch {
      // Revert syncing status on network exception
      try {
        const db = await getDb();
        await db.runAsync(`UPDATE mutation_outbox SET status = 'pending' WHERE status = 'syncing';`);
      } catch {}
      this.isSyncing = false;
      return { processedCount: 0, errors: 1 };
    }
  }
}
