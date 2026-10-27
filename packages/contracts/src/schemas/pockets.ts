import { z } from 'zod';

export const pocketTypeEnum = z.enum(['spending', 'saving', 'locked', 'bills', 'shared']);

export const createPocketSchema = z.object({
  name: z.string().trim().min(1, 'Nama kantong tidak boleh kosong').max(50, 'Nama kantong maksimal 50 karakter'),
  emoji: z.string().max(20).optional().default('wallet'),
  type: pocketTypeEnum,
  initialAllocation: z.number().int('Alokasi awal harus bilangan bulat').min(0, 'Alokasi awal tidak boleh negatif').optional().default(0),
  targetAmount: z.number().int('Target harus bilangan bulat').positive('Target harus lebih besar dari 0').nullable().optional(),
  sortOrder: z.number().int().optional().default(0),
  isShared: z.boolean().optional().default(false),
  inviteCode: z.string().max(20).optional(),
});

export const updatePocketSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  emoji: z.string().max(10).nullable().optional(),
  type: pocketTypeEnum.optional(),
  targetAmount: z.number().int().positive().nullable().optional(),
  isLocked: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  isShared: z.boolean().optional(),
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

export const joinPocketSchema = z.object({
  inviteCode: z.string().trim().min(3, 'Kode undangan minimal 3 karakter').max(20, 'Kode undangan maksimal 20 karakter'),
  memberName: z.string().trim().min(1, 'Nama anggota wajib diisi').max(50, 'Nama maksimal 50 karakter'),
  avatarEmoji: z.string().max(20).optional().default('user'),
});

export const pocketContributionSchema = z.object({
  memberId: z.string().uuid('ID Anggota tidak valid').optional(),
  memberName: z.string().trim().min(1, 'Nama anggota wajib diisi'),
  memberAvatar: z.string().max(20).optional().default('user'),
  amount: z.number().int('Nominal harus bilangan bulat').positive('Nominal setoran harus lebih dari 0'),
  note: z.string().max(100, 'Catatan maksimal 100 karakter').optional(),
});

export const addPocketMemberSchema = z.object({
  name: z.string().trim().min(1, 'Nama anggota wajib diisi').max(50),
  avatarEmoji: z.string().max(20).optional().default('user'),
  role: z.enum(['owner', 'contributor', 'viewer']).optional().default('contributor'),
});

export type CreatePocketInput = z.infer<typeof createPocketSchema>;
export type UpdatePocketInput = z.infer<typeof updatePocketSchema>;
export type PocketTransferInput = z.infer<typeof pocketTransferSchema>;
export type JoinPocketInput = z.infer<typeof joinPocketSchema>;
export type PocketContributionInput = z.infer<typeof pocketContributionSchema>;
export type AddPocketMemberInput = z.infer<typeof addPocketMemberSchema>;
