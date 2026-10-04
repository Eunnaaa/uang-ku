import { z } from 'zod';

export const syncMutationSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  entityType: z.enum(['transaction', 'account', 'category']),
  operation: z.enum(['create', 'update', 'delete']),
  entityId: z.string().uuid(),
  version: z.number().int().positive(),
  payload: z.record(z.unknown()),
});

export const syncPushRequestSchema = z.object({
  mutations: z.array(syncMutationSchema).max(50, 'Maksimal 50 mutasi per request push'),
});

export const syncPullQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export type SyncMutation = z.infer<typeof syncMutationSchema>;
export type SyncPushRequest = z.infer<typeof syncPushRequestSchema>;
export type SyncPullQuery = z.infer<typeof syncPullQuerySchema>;
