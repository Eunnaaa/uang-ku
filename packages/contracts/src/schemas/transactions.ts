import { z } from 'zod';

export const transactionTypeEnum = z.enum(['income', 'expense', 'transfer']);

export const createTransactionSchema = z.object({
  accountId: z.string().uuid('ID Akun tidak valid'),
  destinationAccountId: z.string().uuid('ID Akun tujuan tidak valid').nullable().optional(),
  categoryId: z.string().uuid('ID Kategori tidak valid').nullable().optional(),
  type: transactionTypeEnum,
  amount: z.number().int('Nominal harus bilangan bulat').positive('Nominal harus lebih dari 0').max(999999999999, 'Nominal melebihi batas maksimal'),
  transferFee: z.number().int().min(0, 'Biaya transfer tidak boleh negatif').default(0).optional(),
  currency: z.string().length(3, 'Kode mata uang harus 3 karakter ISO').default('IDR'),
  note: z.string().max(255, 'Catatan maksimal 255 karakter').nullable().optional(),
  transactionDate: z.string().datetime('Format tanggal harus ISO 8601 string'),
  clientId: z.string().uuid('Client ID harus berupa UUID valid'),
}).refine((data) => {
  if (data.type === 'transfer') {
    return Boolean(data.destinationAccountId && data.destinationAccountId !== data.accountId);
  }
  return true;
}, {
  message: 'Pada transfer, akun tujuan wajib diisi dan tidak boleh sama dengan akun asal',
  path: ['destinationAccountId'],
}).refine((data) => {
  if (data.type !== 'transfer') {
    return Boolean(data.categoryId);
  }
  return true;
}, {
  message: 'Kategori wajib dipilih untuk pemasukan dan pengeluaran',
  path: ['categoryId'],
});

export const updateTransactionSchema = z.object({
  accountId: z.string().uuid().optional(),
  destinationAccountId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  type: transactionTypeEnum.optional(),
  amount: z.number().int().positive().max(999999999999).optional(),
  transferFee: z.number().int().min(0).optional(),
  currency: z.string().length(3).optional(),
  note: z.string().max(255).nullable().optional(),
  transactionDate: z.string().datetime().optional(),
  version: z.number().int().positive(),
});

export const queryTransactionSchema = z.object({
  type: transactionTypeEnum.optional(),
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type QueryTransactionInput = z.infer<typeof queryTransactionSchema>;
