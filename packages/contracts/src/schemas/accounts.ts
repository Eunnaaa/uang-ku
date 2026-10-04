import { z } from 'zod';

export const accountTypeEnum = z.enum(['cash', 'bank', 'e_wallet', 'other']);

export const createAccountSchema = z.object({
  name: z.string().min(1, 'Nama dompet wajib diisi').max(50, 'Nama dompet maksimal 50 karakter'),
  type: accountTypeEnum,
  currency: z.string().length(3).default('IDR'),
  initialBalance: z.number().int().min(0, 'Saldo awal tidak boleh negatif').default(0),
});

export const updateAccountSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  type: accountTypeEnum.optional(),
  isArchived: z.boolean().optional(),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
