import { z } from 'zod';
import { createAccountSchema } from './accounts';
import { createCategorySchema } from './categories';

export const syncMutationSchema = z.object({
  id: z.guid(),
  clientId: z.guid(),
  entityType: z.enum(['transaction', 'account', 'category']),
  operation: z.enum(['create', 'update', 'delete']),
  entityId: z.guid(),
  version: z.number().int().positive(),
  payload: z.record(z.string(), z.unknown()),
});

export const syncPushRequestSchema = z.object({
  ownerId: z.guid().optional(),
  accounts: z.array(createAccountSchema.extend({ id: z.guid(), isDefault: z.boolean().optional(),
    reservedAmount: z.number().int().nonnegative().optional(), color: z.string().max(20).optional(),
    isHidden: z.boolean().optional(), sortOrder: z.number().int().optional(),
    isArchived: z.boolean().optional(), updatedAt: z.string().datetime().optional() })).max(100).default([]),
  categories: z.array(createCategorySchema.extend({ id: z.guid(), isArchived: z.boolean().optional(),
    updatedAt: z.string().datetime().optional() })).max(50).default([]),
  pockets: z.array(z.object({
    id: z.guid(), accountId: z.guid(), name: z.string().min(1).max(50),
    type: z.enum(['spending','saving','locked','bills','shared']), emoji: z.string().max(20).nullable(),
    allocatedBalance: z.number().int().nonnegative(), targetAmount: z.number().int().nullable(),
    openingAllocation: z.number().int().nonnegative().optional(),
  })).max(50).default([]),
  mutations: z.array(syncMutationSchema).max(50, 'Maksimal 50 mutasi per request push'),
});

export const syncPullQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

export type SyncMutation = z.infer<typeof syncMutationSchema>;
export type SyncPushRequest = z.infer<typeof syncPushRequestSchema>;
export type SyncPullQuery = z.infer<typeof syncPullQuerySchema>;
