import { z } from 'zod';

export const pocketTypeEnum = z.enum(['spending', 'saving', 'locked', 'bills']);

export const createPocketSchema = z.object({
  name: z.string().trim().min(1, 'Nama kantong tidak boleh kosong').max(50, 'Nama kantong maksimal 50 karakter'),
  emoji: z.string().max(10).optional().default('💰'),
  type: pocketTypeEnum,
  initialAllocation: z.number().int('Alokasi awal harus bilangan bulat').min(0, 'Alokasi awal tidak boleh negatif').optional().default(0),
  targetAmount: z.number().int('Target harus bilangan bulat').positive('Target harus lebih besar dari 0').nullable().optional(),
  sortOrder: z.number().int().optional().default(0),
});

export const updatePocketSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  emoji: z.string().max(10).nullable().optional(),
  type: pocketTypeEnum.optional(),
  targetAmount: z.number().int().positive().nullable().optional(),
  isLocked: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const pocketTransferSchema = z.object({
  accountId: z.string().uuid('ID Akun tidak valid'),
  sourcePocketId: z.string().uuid('ID Kantong asal tidak valid').nullable(),
  destinationPocketId: z.string().uuid('ID Kantong tujuan tidak valid').nullable(),
  amount: z.number().int('Nominal harus bilangan bulat').positive('Nominal transfer alokasi harus lebih dari 0'),
}).refine((data) => data.sourcePocketId !== data.destinationPocketId, {
  message: 'Kantong asal dan kantong tujuan alokasi tidak boleh sama',
  path: ['destinationPocketId'],
});

export type CreatePocketInput = z.infer<typeof createPocketSchema>;
export type UpdatePocketInput = z.infer<typeof updatePocketSchema>;
export type PocketTransferInput = z.infer<typeof pocketTransferSchema>;
